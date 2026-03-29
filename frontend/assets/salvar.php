<?php
$data = json_decode(file_get_contents('php://input'), true);
if ($data) {
    $arquivo = 'cadastros_olitemq.csv';
    $rows = [];
    $atualizou = false;

    if (file_exists($arquivo)) {
        $handle = fopen($arquivo, "r");
        while (($linha = fgetcsv($handle)) !== FALSE) {
            if ($linha[1] == $data['escola'] && $linha[4] == $data['turma']) {
                $linha = array_merge([date('Y-m-d H:i:s'), $data['escola'], $data['ano'], $data['email'], $data['turma'], $data['turno']], $data['alunos']);
                $atualizou = true;
            }
            $rows[] = $linha;
        }
        fclose($handle);
    }

    if (!$atualizou) {
        if (!file_exists($arquivo)) {
            $headers = ['Data', 'Escola', 'Ano', 'Email', 'Turma', 'Turno'];
            for($i=1;$i<=15;$i++) $headers[] = "Aluno $i";
            $rows[] = $headers;
        }
        $rows[] = array_merge([date('Y-m-d H:i:s'), $data['escola'], $data['ano'], $data['email'], $data['turma'], $data['turno']], $data['alunos']);
    }

    $handle = fopen($arquivo, "w");
    foreach ($rows as $row) {
        fputcsv($handle, $row);
    }
    fclose($handle);
    echo json_encode(['success' => true]);
}
?>