<?php
// /var/www/informes/scripts/split_reports.php
require_once __DIR__ . '/../config/database.php';

$masterPdf = __DIR__ . '/../storage/master/principal.PDF';
$outputDir = __DIR__ . '/../storage/reports/';
$tempDir   = __DIR__ . '/../storage/temp/';

// Garante que as pastas existem
if (!is_dir($tempDir)) mkdir($tempDir, 0777, true);
if (!is_dir($outputDir)) mkdir($outputDir, 0777, true);

$totalPages = (int)shell_exec("pdfinfo " . escapeshellarg($masterPdf) . " | grep Pages | awk '{print $2}'");
echo "Iniciando processamento de $totalPages páginas...\n";

for ($i = 1; $i <= $totalPages; $i++) {
    $prefix = $tempDir . "p_$i";
    
    // Converte a página
    shell_exec("pdftoppm -f $i -l $i -png -r 150 " . escapeshellarg($masterPdf) . " $prefix");

    // Localiza o arquivo gerado (pode ser p_i-1.png ou p_i-i.png)
    $files = glob($prefix . "-*.png");
    $imagePath = $files[0] ?? null;

    if (!$imagePath || !file_exists($imagePath)) {
        echo "Página $i: Falha ao gerar imagem temporária.\n";
        continue;
    }

    // OCR na página inteira
    $text = shell_exec("tesseract " . escapeshellarg($imagePath) . " stdout -l por");

    if (preg_match('/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/', $text, $matches)) {
        $cpfLimpo = preg_replace('/[^0-9]/', '', $matches[0]);
        $cpfLimpo = str_pad($cpfLimpo, 11, '0', STR_PAD_LEFT);
        $cpfHash = hash('sha256', $cpfLimpo);
        $novoNome = $cpfHash . ".pdf";

        // Extrai a página
        shell_exec("qpdf " . escapeshellarg($masterPdf) . " --pages . $i -- " . escapeshellarg($outputDir . $novoNome));
        
        $stmt = $pdo->prepare("INSERT INTO ir_arquivos_split (cpf_hash, nome_arquivo) VALUES (?, ?) ON CONFLICT (cpf_hash) DO UPDATE SET nome_arquivo = EXCLUDED.nome_arquivo");
        $stmt->execute([$cpfHash, $novoNome]);

        echo "Página $i: CPF " . $matches[0] . " processado.\n";
    } else {
        echo "Página $i: CPF não encontrado.\n";
    }

    // LIMPEZA IMEDIATA: Apaga a imagem logo após usar para não travar o disco
    if ($imagePath) @unlink($imagePath);
}
echo "Processamento finalizado!\n";