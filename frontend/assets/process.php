<?php
set_time_limit(0); 
ini_set('memory_limit', '1G');

header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); 

$action = $_POST['action'] ?? '';

// Função auxiliar para logs de erro do sistema
function logError($msg) {
    file_put_contents('error_log.txt', date('[Y-m-d H:i:s] ') . $msg . PHP_EOL, FILE_APPEND);
}

if ($action === 'preview') {
    try {
        if (!isset($_FILES['file'])) throw new Exception('Arquivo não recebido.');
        
        $temp = $_FILES['file']['tmp_name'];
        if (!is_dir('uploads')) mkdir('uploads', 0777, true);

        $im = new Imagick();
        $im->setResolution(150, 150);
        // Tenta ler a primeira página. Importante: PDF com espaços no nome podem falhar em alguns servidores.
        $im->readImage($temp . '[0]');
        $im->setImageFormat('jpeg');
        
        $previewName = 'uploads/preview_' . time() . '.jpg';
        $im->writeImage($previewName);
        
        echo json_encode(['image' => $previewName]);
    } catch (Exception $e) {
        logError("Erro no Preview: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'process') {
    $coords = json_decode($_POST['coords'], true);
    $gabaritoPath = $_FILES['gabarito']['tmp_name'];
    $provasPath = $_FILES['provas']['tmp_name'];
    $thresholdPreenchimento = 0.90; 
    $sensibilidadeBinaria = "50%";

    try {
        $imgGab = prepararImagem($gabaritoPath, 0, $sensibilidadeBinaria);
        $mapaGabarito = detectarMarcacoes($imgGab, $coords['grid'], $thresholdPreenchimento);

        $imProvas = new Imagick($provasPath);
        $totalPaginas = $imProvas->getNumberImages();
        $resultadosAcumulados = [];

        for ($i = 0; $i < $totalPaginas; $i++) {
            $pagina = prepararImagem($provasPath, $i, $sensibilidadeBinaria);
            $nomeInfo = extrairNomeOCR($pagina, $coords['name']);
            $respostasAluno = detectarMarcacoes($pagina, $coords['grid'], $thresholdPreenchimento);
            
            $stats = compararResultados($mapaGabarito, $respostasAluno);
            
            $resultadoFinal = [
                'aluno' => $nomeInfo,
                'acertos' => $stats['acertos'],
                'brancos' => $stats['brancos'],
                'rasuras' => $stats['rasuras'],
                'detalhes_anulacao' => $stats['detalhes_anulacao'] // Novo campo para auditoria
            ];

            $resultadosAcumulados[] = $resultadoFinal;
            enviarStatus($i + 1, $totalPaginas, $nomeInfo);
            
            $pagina->clear();
            $pagina->destroy();
        }

        // SALVAR EM CSV AUTOMATICAMENTE
        $csvName = 'uploads/resultado_' . date('Ymd_His') . '.csv';
        $fp = fopen($csvName, 'w');
        fputcsv($fp, ['Aluno/Turma', 'Acertos', 'Brancos', 'Rasuras', 'Detalhes de Questões Anuladas']);
        foreach ($resultadosAcumulados as $row) {
            fputcsv($fp, [$row['aluno'], $row['acertos'], $row['brancos'], $row['rasuras'], $row['detalhes_anulacao']]);
        }
        fclose($fp);

        enviarStatus($totalPaginas, $totalPaginas, "Concluído", true, $resultadosAcumulados);

    } catch (Exception $e) {
        logError("Erro no Processamento: " . $e->getMessage());
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// --- FUNÇÕES DE VISÃO ---

function prepararImagem($path, $page, $sensibilidade) {
    $img = new Imagick();
    $img->setResolution(200, 200);
    $img->readImage($path . "[$page]");
    $img->setImageFormat('jpeg');
    $img->transformImageColorSpace(Imagick::COLORSPACE_GRAY);
    $img->blackThresholdImage("gray($sensibilidade)");
    $img->whiteThresholdImage("gray($sensibilidade)");
    return $img;
}

function detectarMarcacoes($img, $c, $threshold) {
    $realW = $img->getImageWidth(); $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; $scaleY = $realH / $c['imgH'];
    $gridX = $c['x'] * $scaleX; $gridY = $c['y'] * $scaleY;
    $gridW = $c['w'] * $scaleX; $gridH = $c['h'] * $scaleY;

    $rowH = $gridH / 50;
    $colW = $gridW / 5;
    $respostas = [];

    for ($q = 0; $q < 50; $q++) {
        $marcacoesNaLinha = [];
        for ($a = 0; $a < 5; $a++) {
            $posX = $gridX + ($a * $colW) + ($colW / 4);
            $posY = $gridY + ($q * $rowH) + ($rowH / 4);
            
            $regiao = $img->getImageRegion($colW / 2, $rowH / 2, $posX, $posY);
            $stats = $regiao->getImageStatistics();
            $mediaCinza = $stats[Imagick::METRIC_MEAN]['mean'];

            if ($mediaCinza < (65535 * (1 - $threshold))) {
                $marcacoesNaLinha[] = chr(65 + $a);
            }
            $regiao->destroy();
        }

        $numQ = $q + 1;
        if (count($marcacoesNaLinha) === 1) {
            $respostas[$numQ] = $marcacoesNaLinha[0];
        } elseif (count($marcacoesNaLinha) > 1) {
            // REGISTRA QUAIS FORAM MARCADAS PARA COMPROVAÇÃO
            $respostas[$numQ] = "RASURA:[" . implode(',', $marcacoesNaLinha) . "]";
        } else {
            $respostas[$numQ] = "BRANCO";
        }
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
    
    // Tesseract deve estar instalado no servidor
    $texto = shell_exec("tesseract $tempNome stdout -l por");
    @unlink($tempNome);
    return trim($texto) ?: "Identificação não detectada";
}

function compararResultados($gabarito, $aluno) {
    $acertos = 0; $brancos = 0; $rasuras = 0;
    $motivos = [];

    foreach ($gabarito as $q => $correta) {
        $resp = $aluno[$q];
        if ($resp === $correta) {
            $acertos++;
        } elseif (strpos($resp, 'RASURA') !== false) {
            $rasuras++;
            $motivos[] = "Q$q: $resp"; // Ex: Q5: RASURA:[A,B]
        } elseif ($resp === "BRANCO") {
            $brancos++;
        }
    }
    return [
        'acertos' => $acertos, 
        'brancos' => $brancos, 
        'rasuras' => $rasuras,
        'detalhes_anulacao' => implode(' | ', $motivos)
    ];
}

function enviarStatus($atual, $total, $aluno, $concluido = false, $resultados = []) {
    echo json_encode(['atual' => $atual, 'total' => $total, 'aluno' => $aluno, 'concluido' => $concluido, 'resultados' => $resultados]) . "\n";
    ob_flush(); flush();
}