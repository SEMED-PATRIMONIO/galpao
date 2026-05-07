<?php
/**
 * VISION SCAN - Motor de Correção OMR & OCR
 * Versão Corrigida: Unificação de Lógica + Estabilidade de Stream
 */

// 1. Configurações de Ambiente e Memória
set_time_limit(0); 
ini_set('memory_limit', '512M');
error_reporting(E_ALL); // Ative para ver erros se necessário, mas o try/catch cuidará disso

// 2. Cabeçalhos Anti-Buffering (Impede que o progresso trave em 0%)
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
    echo json_encode(['error' => 'Ação inválida.']);
}

// --- FUNÇÕES PRINCIPAIS ---

function handlePreview($uploadDir) {
    try {
        if (!isset($_FILES['file'])) throw new Exception("Arquivo não enviado.");
        $temp = $_FILES['file']['tmp_name'];
        $prefix = $uploadDir . 'prev_' . time();
        
        // Converte apenas a pág 1 para o canvas de mapeamento
        shell_exec("pdftoppm -f 1 -l 1 -jpeg -r 100 " . escapeshellarg($temp) . " " . $prefix);
        
        $files = glob($prefix . "-*.jpg");
        if (!$files) throw new Exception("Erro ao gerar imagem. Verifique se o 'poppler-utils' (pdftoppm) está instalado.");
        
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

        // 1. Processa o Gabarito Mestre (Mapeia as respostas corretas)
        shell_exec("pdftoppm -f 1 -l 1 -jpeg -r 200 " . escapeshellarg($gabaritoPath) . " " . $prefix . "_gab");
        $gabFiles = glob($prefix . "_gab-*.jpg");
        if (!$gabFiles) throw new Exception("Falha ao ler gabarito mestre.");

        $imgGab = new Imagick($gabFiles[0]);
        $mapaGabarito = detectarMarcacoes($imgGab, $coords['grid'], 0.90);
        $imgGab->destroy();
        @unlink($gabFiles[0]);

        // 2. Processa as Provas (Lote)
        shell_exec("pdftoppm -jpeg -r 150 " . escapeshellarg($provasPath) . " " . $prefix);
        $paginas = glob($prefix . "-*.jpg");
        $total = count($paginas);
        $resultados = [];

        foreach ($paginas as $index => $path) {
            $img = new Imagick($path);
            
            // Tratamento de imagem para melhorar OCR/OMR
            $img->transformImageColorSpace(Imagick::COLORSPACE_GRAY);
            $img->blackThresholdImage("gray(50%)");
            $img->whiteThresholdImage("gray(50%)");

            // OCR do Nome
            $nome = extrairTextoOCR($img, $coords['name']);
            
            // OMR das Respostas
            $respostas = detectarMarcacoes($img, $coords['grid'], 0.90);
            
            // Compara com gabarito mestre
            $stats = compararResultados($mapaGabarito, $respostas);

            $res = [
                'aluno' => $nome,
                'acertos' => $stats['acertos'],
                'brancos' => $stats['brancos'],
                'rasuras' => $stats['rasuras']
            ];
            $resultados[] = $res;

            // Envia atualização para o navegador em tempo real
            enviarStatus($index + 1, $total, $nome);

            $img->clear();
            $img->destroy();
            @unlink($path);
        }

        // Finaliza enviando o array completo de resultados
        enviarStatus($total, $total, "Finalizado", true, $resultados);

    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
}

// --- MOTOR OMR / OCR ---

function detectarMarcacoes($img, $c, $threshold) {
    $realW = $img->getImageWidth(); 
    $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; 
    $scaleY = $realH / $c['imgH'];
    
    $gridX = $c['x'] * $scaleX; 
    $gridY = $c['y'] * $scaleY;
    $gridW = $c['w'] * $scaleX; 
    $gridH = $c['h'] * $scaleY;

    $rowH = $gridH / 50; // Assume 50 questões
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

            if ($media < (65535 * (1 - $threshold))) {
                $marcacoes[] = chr(65 + $a);
            }
            $regiao->destroy();
        }
        
        if (count($marcacoes) === 1) $respostas[$q + 1] = $marcacoes[0];
        elseif (count($marcacoes) > 1) $respostas[$q + 1] = "RASURA";
        else $respostas[$q + 1] = "BRANCO";
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

    $cmd = "tesseract " . escapeshellarg($tmp) . " stdout -l por --psm 7 2>/dev/null";
    $txt = shell_exec($cmd);

    @unlink($tmp);
    $crop->destroy();
    
    $txt = trim($txt);
    return preg_replace('/[^\p{L}\p{N}\s]/u', '', $txt) ?: "Não identificado";
}

function compararResultados($gab, $alu) {
    $ac = 0; $br = 0; $rs = 0;
    foreach ($gab as $q => $correta) {
        $r = $alu[$q] ?? 'BRANCO';
        if ($r === $correta) $ac++;
        elseif ($r === "BRANCO") $br++;
        elseif ($r === "RASURA") $rs++;
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
    @ob_flush();
    @flush();
}