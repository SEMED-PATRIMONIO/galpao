<?php
// /var/www/informes/scripts/import_rh.php
require_once __DIR__ . '/../config/database.php';

$csvFile = __DIR__ . '/../rh.csv';
if (!file_exists($csvFile)) die("Arquivo rh.csv não encontrado.\n");

// Função para formatar o CPF com máscara
function formatarCpfComMascara($valor) {
    // 1. Remove qualquer coisa que não seja número
    $numeros = preg_replace('/[^0-9]/', '', $valor);
    
    // 2. Garante que tenha 11 dígitos (adiciona zeros à esquerda se o Excel removeu)
    $limpo = str_pad($numeros, 11, '0', STR_PAD_LEFT);
    
    // 3. Aplica a máscara 000.000.000-00
    return preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $limpo);
}

$handle = fopen($csvFile, "r");
$count = 0;

while (($data = fgetcsv($handle, 1000, ";")) !== FALSE) {
    $cpfFormatado = formatarCpfComMascara($data[0]);
    $matricula = trim($data[1]);

    if (!empty($matricula)) {
        $stmt = $pdo->prepare("INSERT INTO ir_colaboradores_dados (cpf, matricula) VALUES (?, ?) ON CONFLICT (cpf) DO UPDATE SET matricula = EXCLUDED.matricula");
        $stmt->execute([$cpfFormatado, $matricula]);
        $count++;
    }
}
fclose($handle);
echo "Sucesso! $count colaboradores importados com CPF formatado.\n";