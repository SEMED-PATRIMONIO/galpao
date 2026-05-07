<?php
set_time_limit(0); 
ini_set('memory_limit', '512M');

header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); 

$action = $_POST['action'] ?? '';
$uploadDir = __DIR__ . '/uploads/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

if ($action === 'preview') {
    try {
        $temp = $_FILES['file']['tmp_name'];
        $prefix = $uploadDir . 'prev_' . time();
        
        // USO DO PDFTOPPM (Igual ao seu script rápido)
        // Extrai apenas a 1ª página em resolução menor para o preview
        shell_exec("pdftoppm -f 1 -l 1 -jpeg -r 100 " . escapeshellarg($temp) . " " . $prefix);
        
        $files = glob($prefix . "-*.jpg");
        if (!$files) throw new Exception("Falha ao gerar preview. Verifique se o poppler-utils está instalado.");
        
        echo json_encode(['image' => 'uploads/' . basename($files[0])]);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'process') {
    $coords = json_decode($_POST['coords'], true);
    $gabaritoPath = $_FILES['gabarito']['tmp_name'];
    $provasPath = $_FILES['provas']['tmp_name'];
    $prefixProvas = $uploadDir . 'proc_' . uniqid();

    try {
        // 1. Extrai o Gabarito Mestre
        shell_exec("pdftoppm -f 1 -l 1 -jpeg -r 200 " . escapeshellarg($gabaritoPath) . " " . $prefixProvas . "_gab");
        $gabImgPath = glob($prefixProvas . "_gab-*.jpg")[0];
        $imgGab = new Imagick($gabImgPath);
        $mapaGabarito = detectarMarcacoes($imgGab, $coords['grid'], 0.90);

        // 2. Extrai TODAS as páginas das provas de uma vez (Alta Velocidade)
        shell_exec("pdftoppm -jpeg -r 150 " . escapeshellarg($provasPath) . " " . $prefixProvas);
        $paginas = glob($prefixProvas . "-*.jpg");
        $total = count($paginas);
        $resultados = [];

        foreach ($paginas as $index => $path) {
            $img = new Imagick($path);
            $img->transformImageColorSpace(Imagick::COLORSPACE_GRAY);
            $img->blackThresholdImage("gray(50%)");
            $img->whiteThresholdImage("gray(50%)");

            $nome = extrairNomeOCR($img, $coords['name']);
            $respostas = detectarMarcacoes($img, $coords['grid'], 0.90);
            $stats = compararResultados($mapaGabarito, $respostas);

            $resultados[] = [
                'aluno' => $nome,
                'acertos' => $stats['acertos'],
                'brancos' => $stats['brancos'],
                'rasuras' => $stats['rasuras'],
                'detalhes' => $stats['detalhes']
            ];

            enviarStatus($index + 1, $total, $nome);
            $img->clear(); $img->destroy();
            @unlink($path); // Limpa o rastro
        }

        @unlink($gabImgPath);
        enviarStatus($total, $total, "Concluído", true, $resultados);

    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// --- FUNÇÕES DE APOIO ---

function detectarMarcacoes($img, $c, $threshold) {
    $realW = $img->getImageWidth(); $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; $scaleY = $realH / $c['imgH'];
    $gridX = $c['x'] * $scaleX; $gridY = $c['y'] * $scaleY;
    $gridW = $c['w'] * $scaleX; $gridH = $c['h'] * $scaleY;

    $rowH = $gridH / 50; $colW = $gridW / 5;
    $respostas = [];

    for ($q = 0; $q < 50; $q++) {
        $marcacoes = [];
        for ($a = 0; $a < 5; $a++) {
            $posX = $gridX + ($a * $colW) + ($colW / 4);
            $posY = $gridY + ($q * $rowH) + ($rowH / 4);
            $regiao = $img->getImageRegion($colW / 2, $rowH / 2, $posX, $posY);
            $media = $regiao->getImageStatistics()[Imagick::METRIC_MEAN]['mean'];
            if ($media < (65535 * (1 - $threshold))) $marcacoes[] = chr(65 + $a);
            $regiao->destroy();
        }
        $respostas[$q + 1] = (count($marcacoes) === 1) ? $marcacoes[0] : (count($marcacoes) > 1 ? "RASURA:".implode($marcacoes) : "BRANCO");
    }
    return $respostas;
}

function extrairNomeOCR($img, $c) {
    $realW = $img->getImageWidth(); $realH = $img->getImageHeight();
    $scaleX = $realW / $c['imgW']; $scaleY = $realH / $c['imgH'];
    $crop = clone $img;
    $crop->cropImage($c['w'] * $scaleX, $c['h'] * $scaleY, $c['x'] * $scaleX, $c['y'] * $scaleY);
    $tmp = 'uploads/n'.uniqid().'.jpg';
    $crop->writeImage($tmp);
    $txt = shell_exec("tesseract $tmp stdout -l por --psm 7"); // PSM 7 é melhor para uma única linha de texto
    @unlink($tmp);
    return trim($txt) ?: "Não identificado";
}

function compararResultados($gab, $alu) {
    $ac = 0; $br = 0; $rs = 0; $det = [];
    foreach ($gab as $q => $correta) {
        $r = $alu[$q];
        if ($r === $correta) $ac++;
        elseif ($r === "BRANCO") $br++;
        elseif (strpos($r, "RASURA") !== false) { $rs++; $det[] = "Q$q:$r"; }
    }
    return ['acertos' => $ac, 'brancos' => $br, 'rasuras' => $rs, 'detalhes' => implode('|', $det)];
}

function enviarStatus($at, $to, $al, $co = false, $re = []) {
    echo json_encode(['atual' => $at, 'total' => $to, 'aluno' => $al, 'concluido' => $co, 'resultados' => $re]) . "\n";
    ob_flush(); flush();
}