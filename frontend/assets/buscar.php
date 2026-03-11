<?php
header('Content-Type: application/json');
$escola = $_GET['escola'] ?? '';
$ano = $_GET['ano'] ?? '';
$arquivo = 'cadastros_alunos.csv';

if (file_exists($arquivo)) {
    $handle = fopen($arquivo, "r");
    fgetcsv($handle); // pula cabeçalho
    while (($linha = fgetcsv($handle)) !== FALSE) {
        if ($linha[1] == $escola && $linha[2] == $ano) {
            $dados = [
                'email' => $linha[3], 'turma' => $linha[4], 'turno' => $linha[5]
            ];
            for($i=1; $i<=15; $i++) { $dados['aluno'.$i] = $linha[5+$i] ?? ''; }
            echo json_encode(['encontrado' => true, 'dados' => $dados]);
            exit;
        }
    }
}
echo json_encode(['encontrado' => false]);
?>