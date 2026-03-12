<?php
// /var/www/informes/scripts/split_reports.php
require_once __DIR__ . '/../config/database.php';

$masterPdf = __DIR__ . '/../storage/master/principal.PDF';
$outputDir = __DIR__ . '/../storage/reports/';
$tempDir   = __DIR__ . '/../storage/temp/';

$totalPages = (int)shell_exec("pdfinfo " . escapeshellarg($masterPdf) . " | grep Pages | awk '{print $2}'");

for ($i = 1; $i <= $totalPages; $i++) {
    $prefix = $tempDir . "p_$i";
    // Extrai a página
    shell_exec("pdftoppm -f $i -l $i -png -r 300 " . escapeshellarg($masterPdf) . " $prefix");
    $imagePath = $prefix . "-1.png";

    // Otimização: Corta a imagem na região do CPF (Aprox. topo esquerdo do quadro 2)
    // Coordenadas aproximadas para o padrão RFB em 300DPI
    $cropPath = $tempDir . "crop_$i.png";
    shell_exec("convert " . escapeshellarg($imagePath) . " -crop 1000x400+150+650 " . escapeshellarg($cropPath));

    // OCR apenas no recorte
    $text = shell_exec("tesseract " . escapeshellarg($cropPath) . " stdout -l por");

    if (preg_match('/(\d{3}\.\d{3}\.\d{3}-\d{2})/', $text, $matches)) {
        $cpfComMascara = $matches[0]; // Aqui ele já vem com pontos e traço do OCR
        $cpfLimpo = preg_replace('/[^0-9]/', '', $cpfComMascara); // Apenas números para o HASH
        $cpfHash = hash('sha256', $cpfLimpo);
        $novoNome = $cpfHash . ".pdf";

        shell_exec("qpdf " . escapeshellarg($masterPdf) . " --pages . $i -- " . escapeshellarg($outputDir . $novoNome));
        
        // Salva o HASH para a busca, mas poderíamos salvar o CPF original se quiséssemos
        $pdo->prepare("INSERT INTO ir_arquivos_split (cpf_hash, nome_arquivo) VALUES (?, ?) ON CONFLICT (cpf_hash) DO UPDATE SET nome_arquivo = EXCLUDED.nome_arquivo")
            ->execute([$cpfHash, $novoNome]);
    }
    @unlink($imagePath); @unlink($cropPath);
}
