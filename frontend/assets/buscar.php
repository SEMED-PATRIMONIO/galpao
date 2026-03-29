<?php
header('Content-Type: application/json');
$escola = $_GET['escola'] ?? '';
$turma = $_GET['turma'] ?? '';
$arquivo = 'cadastros_olitemq.csv';

if (file_exists($arquivo)) {
    $handle = fopen($arquivo, "r");
    fgetcsv($handle); // pula cabeçalho
    while (($linha = fgetcsv($handle)) !== FALSE) {
        if ($linha[1] == $escola && $linha[4] == $turma) {
            $dados = [
                'email' => $linha[3], 'ano' => $linha[2], 'turno' => $linha[5],
                'alunos' => array_slice($linha, 6)
            ];
            echo json_encode(['encontrado' => true, 'dados' => $dados]);
            exit;
        }
    }
    fclose($handle);
}
echo json_encode(['encontrado' => false]);
?>