<?php
ob_start();
require_once '../db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Função para garantir booleano real no Postgres
        $toBool = function($val) { 
            $v = strtoupper($val ?? '');
            return ($v === 'SIM' || $v === 'ON' || $v === 'TRUE' || $v === '1') ? true : false; 
        };

        $sql = "INSERT INTO inscricoes (
            nome_aluno, cpf_aluno, data_nasc, sexo, idade, etnia, 
            pcd, pcd_descricao, bolsa_familia, 
            matriculado_atualmente, tempo_fora_escola, rede_origem, motivo_matricula, 
            ano_pretendido, unidade_preferencia, turno_pretendido, 
            nome_responsavel, cpf_responsavel, parentesco, telefone, telefone_secundario, 
            email, dificuldade_descricao, cidade
        ) VALUES (
            :nome_aluno, :cpf_aluno, :data_nasc, :sexo, :idade, :etnia, 
            :pcd, :pcd_desc, :bolsa, 
            :matriculado, :tempo_fora, :rede_origem, :motivo, 
            :ano, :escola, :turno, 
            :nome_resp, :cpf_resp, :parentesco, :tel1, :tel2, 
            :email, :dificuldade, :cidade
        )";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ':nome_aluno'   => $_POST['nome_aluno'] ?? 'NÃO INFORMADO',
            ':cpf_aluno'    => !empty($_POST['cpf_aluno']) ? preg_replace('/\D/', '', $_POST['cpf_aluno']) : null,
            ':data_nasc'    => !empty($_POST['data_nasc']) ? $_POST['data_nasc'] : '2000-01-01',
            ':sexo'         => $_POST['sexo'] ?? 'NÃO INF.',
            ':idade'        => (int)($_POST['idade'] ?? 0),
            ':etnia'        => $_POST['etnia'] ?? 'NÃO DECLARADA',
            ':pcd'          => $toBool($_POST['pcd'] ?? 'NÃO'),
            ':pcd_desc'     => $_POST['pcd_descricao'] ?? null,
            ':bolsa'        => $toBool($_POST['bolsa_familia'] ?? 'NÃO'),
            ':matriculado'  => $toBool($_POST['matriculado_atualmente'] ?? 'NÃO'),
            ':tempo_fora'   => $_POST['tempo_fora_escola'] ?? null,
            ':rede_origem'  => $_POST['rede_origem'] ?? null,
            ':motivo'       => $_POST['motivo_matricula'] ?? 'NÃO INFORMADO',
            ':ano'          => $_POST['ano_pretendido'] ?? 'NÃO INFORMADO',
            ':escola'       => $_POST['unidade_preferencia'] ?? 'NÃO INFORMADA',
            ':turno'        => $_POST['turno_pretendido'] ?? 'NÃO INFORMADO',
            ':nome_resp'    => $_POST['nome_responsavel'] ?? 'NÃO INFORMADO',
            ':cpf_resp'     => !empty($_POST['cpf_responsavel']) ? preg_replace('/\D/', '', $_POST['cpf_responsavel']) : '00000000000',
            ':parentesco'   => $_POST['parentesco'] ?? 'MÃE',
            ':tel1'         => $_POST['telefone'] ?? '00000000000',
            ':tel2'         => $_POST['telefone_secundario'] ?? null,
            ':email'        => !empty($_POST['email']) ? strtolower($_POST['email']) : null,
            ':dificuldade'  => $_POST['dificuldade_descricao'] ?? null,
            ':cidade'       => 'QUEIMADOS' // Valor padrão fixo já que removemos do formulário
        ]);

        ob_clean();
        echo json_encode(["status" => "success"]);

    } catch (PDOException $e) {
        ob_clean();
        http_response_code(500);
        // Retorna o erro exato para você ver no F12 -> Network -> Response
        echo json_encode(["status" => "error", "message" => "Erro Banco: " . $e->getMessage()]);
    }
}
?>