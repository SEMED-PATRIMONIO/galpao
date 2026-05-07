<?php
/**
 * VISION SCAN - Motor de Correção OMR & OCR
 * Desenvolvido para SEMED - Queimados/RJ
 */

// 1. Configurações de Streaming e Memória
set_time_limit(0); 
ini_set('memory_limit', '512M');
error_reporting(0); // Desativa erros brutos para não quebrar o JSON

// Cabeçalhos para forçar o envio imediato dos dados (evita travar em 0%)
header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); 
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);

while (ob_get_level()) { ob_end_flush(); }
ob_implicit_flush(true);

$uploadDir = __DIR__ . '/uploads/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

$action = $_POST['action'] ?? '';

// --- ROTEAMENTO ---

if ($action === 'preview') {
    handlePreview($uploadDir);
} elseif ($action === 'process') {
    handleProcess($uploadDir);
} else {
    echo json_encode(['error' => 'Ação não reconhecida.']);
}

// --- LOGICA DE PROCESSAMENTO ---

function handlePreview($uploadDir) {
    try {
        if (!isset($_FILES['file'])) throw new Exception("Arquivo não enviado.");
        $temp = $_FILES['file']['tmp_name'];
        $prefix = $uploadDir . 'prev_' . time();
        
        // Usa pdftoppm (mais rápido que Imagick para PDFs grandes)
        shell_exec("pdftoppm -f 1 -l 1 -jpeg -r 100 " . escapeshellarg($temp) . " " . $prefix);
        
        $files = glob($prefix . "-*.jpg");
        if (!$files) throw new Exception("Falha ao gerar preview. Verifique se o 'poppler-utils' está instalado.");
        
        echo json_encode(['image' => 'uploads/' . basename($files[0])]);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function handleProcess($uploadDir) {
    try {
        $coords = json_decode($_POST['coords'], true);
        $gabaritoPath = $_FILES['gabarito']['tmp_name'];
        $provasPath = $_FILES['provas']['tmp_name'];
        $prefix = $uploadDir . 'proc_' . uniqid();

        // 1. Processa o Gabarito Mestre para criar o gabarito de comparação
        shell_exec("pdftoppm -f 1 -l 1 -jpeg -r 200 " . escapeshellarg($gabaritoPath) . " " . $prefix . "_gab");
        $gabFiles = glob($prefix . "_gab-*.jpg");
        if (!$gabFiles) throw new Exception("Erro ao processar arquivo do gabarito.");

        $imgGab = new Imagick($gabFiles[0]);
        $mapaGabarito = detectarMarcacoes($imgGab, $coords['grid'], 0.90); // 90% de confiança
        $imgGab->destroy();
        @unlink($gabFiles[0]);

        // 2. Converte as Provas (Bulk Conversion)
        shell_exec("pdftoppm -jpeg -r 150 " . escapeshellarg($provasPath) . " " . $prefix);
        $paginas = glob($prefix . "-*.jpg");
        $total = count($paginas);
        $resultados = [];

        foreach ($paginas as $index => $path) {
            $img = new Imagick($path);
            
            // Otimização de imagem para OCR/OMR
            $img->transformImageColorSpace(Imagick::COLORSPACE_GRAY);
            $img->blackThresholdImage("gray(50%)");
            $img->whiteThresholdImage("gray(50%)");

            // OCR do Nome
            $nome = extrairTextoOCR($img, $coords['name']);
            
            // OMR das Respostas
            $respostas = detectarMarcacoes($img, $coords['grid'], 0.90);
            
            // Comparação com o Gabarito Mestre
            $stats = compararResultados($mapaGabarito, $respostas);

            $resultados[] = [
                'aluno' => $nome,
                'acertos' => $stats['acertos'],
                'brancos' => $stats['brancos'],
                'rasuras' => $stats['rasuras']
            ];

            // Envia progresso em tempo real
            enviarStatus($index + 1, $total, $nome);

            $img->clear();
            $img->destroy();
            @unlink($path);
        }

        // Finaliza o stream enviando todos os dados
        enviarStatus($total, $total, "Processamento Finalizado", true, $resultados);

    } catch (Exception $e) {
        // Envia o erro em formato JSON para não quebrar o JS
        echo json_encode(['error' => $e->getMessage()]);
    }
}

// --- FUNÇÕES MOTORAS (OMR/OCR) ---

function detectarMarcacoes($img, $c, $threshold) {
    $realW = $img->getImageWidth(); 
    $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; 
    $scaleY = $realH / $c['imgH'];
    
    $gridX = $c['x'] * $scaleX; 
    $gridY = $c['y'] * $scaleY;
    $gridW = $c['w'] * $scaleX; 
    $gridH = $c['h'] * $scaleY;

    $rowH = $gridH / 50; // Assume-se 50 questões conforme o código antigo
    $colW = $gridW / 5;  // A, B, C, D, E
    $respostas = [];

    for ($q = 0; $q < 50; $q++) {
        $marcacoes = [];
        for ($a = 0; $a < 5; $a++) {
            $posX = $gridX + ($a * $colW) + ($colW / 4);
            $posY = $gridY + ($q * $rowH) + ($rowH / 4);
            
            $regiao = $img->getImageRegion($colW / 2, $rowH / 2, $posX, $posY);
            $stats = $regiao->getImageStatistics();
            $media = (($stats['red']['mean'] ?? 0) + ($stats['green']['mean'] ?? 0) + ($stats['blue']['mean'] ?? 0)) / 3;

            // Se a média for baixa (perto de 0), a área está pintada (preto)
            if ($media < (65535 * (1 - $threshold))) {
                $marcacoes[] = chr(65 + $a);
            }
            $regiao->destroy();
        }
        
        if (count($marcacoes) === 1) {
            $respostas[$q + 1] = $marcacoes[0];
        } elseif (count($marcacoes) > 1) {
            $respostas[$q + 1] = "RASURA:" . implode($marcacoes);
        } else {
            $respostas[$q + 1] = "BRANCO";
        }
    }
    return $respostas;
}

function extrairTextoOCR($img, $c) {
    $realW = $img->getImageWidth(); $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; $scaleY = $realH / $c['imgH'];
    
    $crop = clone $img;
    $crop->cropImage($c['w'] * $scaleX, $c['h'] * $scaleY, $c['x'] * $scaleX, $c['y'] * $scaleY);
    
    $tmp = __DIR__ . '/uploads/ocr_' . uniqid() . '.jpg';
    $crop->writeImage($tmp);

    // Usa o Tesseract para ler o nome do aluno
    $cmd = "tesseract " . escapeshellarg($tmp) . " stdout -l por --psm 7 2>/dev/null";
    $txt = shell_exec($cmd);

    @unlink($tmp);
    $crop->destroy();
    
    $txt = trim($txt);
    $txt = preg_replace('/[^\p{L}\p{N}\s]/u', '', $txt);
    return $txt ?: "Não identificado";
}

function compararResultados($gab, $alu) {
    $ac = 0; $br = 0; $rs = 0;
    foreach ($gab as $q => $correta) {
        $r = $alu[$q] ?? 'BRANCO';
        if ($r === $correta) $ac++;
        elseif ($r === "BRANCO") $br++;
        elseif (strpos($r, "RASURA") !== false) $rs++;
    }
    return ['acertos' => $ac, 'brancos' => $br, 'rasuras' => $rs];
}

function enviarStatus($at, $to, $al, $co = false, $re = []) {
    echo json_encode([
        'atual' => $at, 
        'total' => $to, 
        'aluno' => $al, 
        'concluido' => $co, 
        'resultados' => $re
    ]) . "\n";
    
    // Força a saída para o navegador não travar em 0%
    @ob_flush();
    @flush();
}