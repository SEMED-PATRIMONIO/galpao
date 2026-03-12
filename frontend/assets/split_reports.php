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
    
    // 1. Converte página do PDF em imagem (Alta resolução)
    shell_exec("pdftoppm -f $i -l $i -png -r 300 " . escapeshellarg($masterPdf) . " $prefix");
    $imagePath = $prefix . "-1.png";

    if (!file_exists($imagePath)) {
        echo "Erro na página $i: Imagem não gerada.\n";
        continue;
    }

    // 2. OCR na página inteira (Mais lento, porém infalível contra erros de posição)
    $text = shell_exec("tesseract " . escapeshellarg($imagePath) . " stdout -l por");

    // 3. Busca o padrão de CPF (000.000.000-00 ou apenas números)
    if (preg_match('/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/', $text, $matches)) {
        $cpfOriginal = $matches[0];
        $cpfLimpo = preg_replace('/[^0-9]/', '', $cpfOriginal);
        $cpfLimpo = str_pad($cpfLimpo, 11, '0', STR_PAD_LEFT);
        $cpfHash = hash('sha256', $cpfLimpo);
        $novoNome = $cpfHash . ".pdf";

        // 4. Extrai a página PDF original para o arquivo individual
        shell_exec("qpdf " . escapeshellarg($masterPdf) . " --pages . $i -- " . escapeshellarg($outputDir . $novoNome));
        
        // 5. Indexa no banco de dados
        $stmt = $pdo->prepare("INSERT INTO ir_arquivos_split (cpf_hash, nome_arquivo) VALUES (?, ?) ON CONFLICT (cpf_hash) DO UPDATE SET nome_arquivo = EXCLUDED.nome_arquivo");
        $stmt->execute([$cpfHash, $novoNome]);

        echo "Página $i: CPF $cpfOriginal indexado com sucesso.\n";
    } else {
        echo "Página $i: CPF não detectado na imagem.\n";
    }

    // Limpa imagem temporária para não lotar o disco
    @unlink($imagePath);
}
echo "Processamento finalizado!\n";