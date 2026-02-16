<?php
error_reporting(0);
ob_start();
require_once '../db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // --- FUNÇÃO 1: TRADUTOR DE BOOLEANO (SIM/NÃO -> true/false) ---
        $toBool = function($val) {
            $v = strtoupper(trim($val ?? ''));
            return ($v === 'SIM' || $v === 'ON' || $v === 'TRUE') ? 'true' : 'false';
        };

        // --- FUNÇÃO 2: TRADUTOR DE DATA (DD-MM-AAAA -> YYYY-MM-DD) ---
        $toDate = function($val) {
            if (empty($val)) return null;
            // Substitui traço por barra para o PHP entender o formato brasileiro/europeu
            $date = str_replace('-', '/', $val);
            return date('Y-m-d', strtotime($date));
        };

        $sql = "INSERT INTO inscricoes (
            cpf_aluno, nome_aluno, data_nasc, sexo, idade, etnia, 
            bolsa_familia, pcd, pcd_descricao,
            nome_responsavel, cpf_responsavel, parentesco,
            cep, rua, bairro, cidade, numero, complemento,
            ano_pretendido, unidade_preferencia, turno_pretendido,
            telefone, telefone_secundario, email,
            matriculado_atualmente, tempo_fora_escola, rede_origem, 
            motivo_matricula, dificuldade_descricao
        ) VALUES (
            :cpf_aluno, :nome_aluno, :data_nasc, :sexo, :idade, :etnia, 
            :bolsa, :pcd, :pcd_desc,
            :nome_resp, :cpf_resp, :parentesco,
            :cep, :rua, :bairro, :cidade, :numero, :complemento,
            :ano, :escola, :turno,
            :tel1, :tel2, :email,
            :matriculado, :tempo_fora, :rede_origem, 
            :motivo, :dificuldade
        )";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ':cpf_aluno'      => preg_replace('/\D/', '', $_POST['cpf_aluno'] ?? ''),
            ':nome_aluno'     => strtoupper($_POST['nome_aluno'] ?? 'NÃO INFORMADO'),
            ':data_nasc'      => $toDate($_POST['data_nasc']),
            ':sexo'           => $_POST['sexo'] ?? 'OUTRO',
            ':idade'          => (int)($_POST['idade'] ?? 0),
            ':etnia'          => $_POST['etnia'] ?? 'NÃO DECLARADA',
            ':bolsa'          => $toBool($_POST['bolsa_familia'] ?? 'NÃO'),
            ':pcd'            => $toBool($_POST['pcd'] ?? 'NÃO'),
            ':pcd_desc'       => $_POST['pcd_descricao'] ?? null,
            ':nome_resp'      => strtoupper($_POST['nome_responsavel'] ?? 'NÃO INFORMADO'),
            ':cpf_resp'       => preg_replace('/\D/', '', $_POST['cpf_responsavel'] ?? ''),
            ':parentesco'     => $_POST['parentesco'] ?? 'MÃE',
            ':cep'            => $_POST['cep'] ?? null,
            ':rua'            => strtoupper($_POST['rua'] ?? null),
            ':bairro'         => strtoupper($_POST['bairro'] ?? null),
            ':cidade'         => strtoupper($_POST['cidade'] ?? 'QUEIMADOS'),
            ':numero'         => $_POST['numero'] ?? null,
            ':complemento'    => strtoupper($_POST['complemento'] ?? null),
            ':ano'            => $_POST['ano_pretendido'] ?? 'NÃO INFORMADO',
            ':escola'         => $_POST['unidade_preferencia'] ?? 'NÃO INFORMADA',
            ':turno'          => $_POST['turno_pretendido'] ?? 'INDIFERENTE',
            ':tel1'           => $_POST['telefone'] ?? '00000000000',
            ':tel2'           => $_POST['telefone_secundario'] ?? null,
            ':email'          => !empty($_POST['email']) ? strtolower($_POST['email']) : null,
            ':matriculado'    => $toBool($_POST['matriculado_atualmente'] ?? 'NÃO'),
            ':tempo_fora'     => $_POST['tempo_fora_escola'] ?? null,
            ':rede_origem'    => $_POST['rede_origem'] ?? null,
            ':motivo'         => $_POST['motivo_matricula'] ?? 'NÃO INFORMADO',
            ':dificuldade'    => $_POST['dificuldade_descricao'] ?? null
        ]);

        ob_clean();
        echo json_encode(["status" => "success"]);

    } catch (PDOException $e) {
        ob_clean();
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
?>