<?php
// Configurações de Servidor para Processamento Pesado
set_time_limit(0); 
ini_set('memory_limit', '1G');

// Headers para permitir o envio de progresso em tempo real (Stream)
header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); 

$action = $_POST['action'] ?? '';

/**
 * 1. AÇÃO DE PREVIEW: Converte a primeira página do gabarito em imagem
 * para que o usuário possa desenhar as áreas de recorte no navegador.
 */
if ($action === 'preview') {
    if (!isset($_FILES['file'])) die(json_encode(['error' => 'Arquivo não enviado']));
    
    $temp = $_FILES['file']['tmp_name'];
    $im = new Imagick();
    $im->setResolution(150, 150); // Resolução suficiente para o preview visual
    $im->readImage($temp . '[0]');
    $im->setImageFormat('jpeg');
    
    if (!is_dir('uploads')) mkdir('uploads', 0777, true);
    $previewName = 'uploads/preview_' . time() . '.jpg';
    $im->writeImage($previewName);
    
    echo json_encode(['image' => $previewName]);
    exit;
}

/**
 * 2. AÇÃO DE PROCESSAMENTO: O "Cérebro" do Aplicativo
 */
if ($action === 'process') {
    $coords = json_decode($_POST['coords'], true);
    $gabaritoPath = $_FILES['gabarito']['tmp_name'];
    $provasPath = $_FILES['provas']['tmp_name'];
    
    // Sensibilidade baseada no seu feedback (90%)
    $thresholdPreenchimento = 0.90; 
    $sensibilidadeBinaria = "50%";

    try {
        // --- ETAPA A: APRENDER O GABARITO ---
        // Prepara a imagem do gabarito oficial com 200 DPI para precisão
        $imgGab = prepararImagem($gabaritoPath, 0, $sensibilidadeBinaria);
        $mapaGabarito = detectarMarcacoes($imgGab, $coords['grid'], $thresholdPreenchimento);

        // --- ETAPA B: PROCESSAR PROVAS ---
        $imProvas = new Imagick($provasPath);
        $totalPaginas = $imProvas->getNumberImages();
        $resultadosAcumulados = [];

        for ($i = 0; $i < $totalPaginas; $i++) {
            $pagina = prepararImagem($provasPath, $i, $sensibilidadeBinaria);
            
            // Extração do Nome (OCR) usando a área que o usuário marcou
            $nomeAluno = extrairNomeOCR($pagina, $coords['name']);
            
            // Extração das Respostas usando a área da grade que o usuário marcou
            $respostasAluno = detectarMarcacoes($pagina, $coords['grid'], $thresholdPreenchimento);
            
            // Comparação e Cálculo
            $stats = compararResultados($mapaGabarito, $respostasAluno);
            
            $resultadoFinal = [
                'aluno' => $nomeAluno,
                'acertos' => $stats['acertos'],
                'brancos' => $stats['brancos'],
                'rasuras' => $stats['rasuras']
            ];

            $resultadosAcumulados[] = $resultadoFinal;

            // Envia progresso para a barra azul no navegador
            enviarStatus($i + 1, $totalPaginas, $nomeAluno);
            
            $pagina->clear();
            $pagina->destroy();
        }

        // Finaliza enviando o sinal de concluído e os dados para a tabela
        enviarStatus($totalPaginas, $totalPaginas, "Concluído", true, $resultadosAcumulados);

    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// --- FUNÇÕES CORE (VISÃO COMPUTACIONAL) ---

function prepararImagem($path, $page, $sensibilidade) {
    $img = new Imagick();
    $img->setResolution(200, 200); // Resolução padrão para OMR
    $img->readImage($path . "[$page]");
    $img->setImageFormat('jpeg');
    $img->transformImageColorSpace(Imagick::COLORSPACE_GRAY);
    $img->blackThresholdImage("gray($sensibilidade)");
    $img->whiteThresholdImage("gray($sensibilidade)");
    return $img;
}

function detectarMarcacoes($img, $c, $threshold) {
    // Cálculo de Escala (Traduz coordenadas do navegador para o PDF real)
    $realW = $img->getImageWidth();
    $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW'];
    $scaleY = $realH / $c['imgH'];

    $gridX = $c['x'] * $scaleX;
    $gridY = $c['y'] * $scaleY;
    $gridW = $c['w'] * $scaleX;
    $gridH = $c['h'] * $scaleY;

    // Divide a grade marcada em 50 linhas e 5 colunas
    $rowH = $gridH / 50;
    $colW = $gridW / 5;
    
    $respostas = [];

    for ($q = 0; $q < 50; $q++) {
        $marcacoesNaLinha = [];
        for ($a = 0; $a < 5; $a++) {
            // Define o centro do círculo de cada alternativa
            $posX = $gridX + ($a * $colW) + ($colW / 4);
            $posY = $gridY + ($q * $rowH) + ($rowH / 4);
            
            // Recorta uma pequena área (círculo) para análise
            $regiao = $img->getImageRegion($colW / 2, $rowH / 2, $posX, $posY);
            $stats = $regiao->getImageStatistics();
            $mediaCinza = $stats[Imagick::METRIC_MEAN]['mean'];

            // Se a média de escuridão for > 90% (pixels pretos na binarização)
            // No Imagick binarizado, 0 costuma ser preto absoluto
            if ($mediaCinza < (65535 * (1 - $threshold))) {
                $marcacoesNaLinha[] = chr(65 + $a);
            }
            $regiao->destroy();
        }

        $numQ = $q + 1;
        if (count($marcacoesNaLinha) === 1) $respostas[$numQ] = $marcacoesNaLinha[0];
        elseif (count($marcacoesNaLinha) > 1) $respostas[$numQ] = "RASURA";
        else $respostas[$numQ] = "BRANCO";
    }
    return $respostas;
}

function extrairNomeOCR($img, $c) {
    $realW = $img->getImageWidth(); $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; $scaleY = $realH / $c['imgH'];

    $crop = clone $img;
    $crop->cropImage($c['w'] * $scaleX, $c['h'] * $scaleY, $c['x'] * $scaleX, $c['y'] * $scaleY);
    $tempNome = 'uploads/name_' . uniqid() . '.jpg';
    $crop->writeImage($tempNome);
    
    $texto = shell_exec("tesseract $tempNome stdout -l por");
    @unlink($tempNome); // Limpa arquivo temporário
    return trim($texto) ?: "Aluno Desconhecido";
}

function compararResultados($gabarito, $aluno) {
    $acertos = 0; $brancos = 0; $rasuras = 0;
    foreach ($gabarito as $q => $correta) {
        $resp = $aluno[$q];
        if ($resp === $correta) $acertos++;
        elseif ($resp === "BRANCO") $brancos++;
        elseif ($resp === "RASURA") $rasuras++;
    }
    return ['acertos' => $acertos, 'brancos' => $brancos, 'rasuras' => $rasuras];
}

function enviarStatus($atual, $total, $aluno, $concluido = false, $resultados = []) {
    echo json_encode([
        'atual' => $atual,
        'total' => $total,
        'aluno' => $aluno,
        'concluido' => $concluido,
        'resultados' => $resultados
    ]) . "\n";
    ob_flush();
    flush();
}