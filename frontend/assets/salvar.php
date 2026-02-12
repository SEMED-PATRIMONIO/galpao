<?php
/**
 * Script de Salvamento - Rede Alunos Queimados
 * Este ficheiro processa os dados e encerra a ligação ao banco de dados imediatamente após.
 */

// 1. Ligação ao Banco de Dados (na pasta superior por segurança)
require_once '../db.php';

// 2. Verifica se a requisição é do tipo POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Função auxiliar para converter "SIM"/"NÃO" para booleano real do Postgres
        $toBool = function($val) { 
            return (isset($val) && strtoupper($val) === 'SIM') ? 'true' : 'false'; 
        };

        // Limpeza de CPFs (remove pontos e traços)
        $cpf_aluno = preg_replace('/\D/', '', $_POST['cpf_aluno']);
        $cpf_resp  = preg_replace('/\D/', '', $_POST['cpf_responsavel']);

        // 3. Preparação da Query SQL com todos os campos novos
        $sql = "INSERT INTO inscricoes (
            nome_aluno, data_nasc, cpf_aluno, sexo, etnia, idade, 
            pcd, pcd_descricao, bolsa_familia, 
            matriculado_atualmente, tempo_fora_escola, rede_origem, motivo_matricula, 
            ano_pretendido, unidade_preferencia, turno_pretendido, 
            cep, rua, bairro, cidade, numero, complemento, 
            nome_responsavel, cpf_responsavel, parentesco, telefone, telefone_secundario, 
            email, dificuldade_descricao
        ) VALUES (
            :nome_aluno, :data_nasc, :cpf_aluno, :sexo, :etnia, :idade, 
            :pcd, :pcd_desc, :bolsa, 
            :matriculado, :tempo_fora, :rede_origem, :motivo, 
            :ano, :escola, :turno, 
            :cep, :rua, :bairro, :cidade, :numero, :complemento, 
            :nome_resp, :cpf_resp, :parentesco, :tel1, :tel2, 
            :email, :dificuldade
        )";

        $stmt = $pdo->prepare($sql);

        // 4. Execução com mapeamento de dados
        $stmt->execute([
            ':nome_aluno'   => $_POST['nome_aluno'],
            ':data_nasc'    => $_POST['data_nasc'],
            ':cpf_aluno'    => $cpf_aluno,
            ':sexo'         => $_POST['sexo'],
            ':etnia'        => $_POST['etnia'] ?? 'NÃO DECLARADA',
            ':idade'        => (int)$_POST['idade'],
            ':pcd'          => $toBool($_POST['pcd']),
            ':pcd_desc'     => $_POST['pcd_descricao'] ?? null,
            ':bolsa'        => $toBool($_POST['bolsa_familia']),
            ':matriculado'  => $toBool($_POST['matriculado_atualmente']),
            ':tempo_fora'   => $_POST['tempo_fora_escola'] ?? null,
            ':rede_origem'  => $_POST['rede_origem'] ?? null,
            ':motivo'       => $_POST['motivo_matricula'],
            ':ano'          => $_POST['ano_pretendido'],
            ':escola'       => $_POST['unidade_preferencia'],
            ':turno'        => $_POST['turno_pretendido'],
            ':cep'          => $_POST['cep'],
            ':rua'          => $_POST['rua'],
            ':bairro'       => $_POST['bairro'],
            ':cidade'       => $_POST['cidade'] ?? 'QUEIMADOS',
            ':numero'       => $_POST['numero'],
            ':complemento'  => $_POST['complemento'] ?? null,
            ':nome_resp'    => $_POST['nome_responsavel'],
            ':cpf_resp'     => $cpf_resp,
            ':parentesco'   => $_POST['parentesco'],
            ':tel1'         => $_POST['telefone'],
            ':tel2'         => $_POST['telefone_secundario'] ?? null,
            ':email'        => !empty($_POST['email']) ? strtolower($_POST['email']) : null,
            ':dificuldade'  => $_POST['dificuldade_descricao'] ?? null
        ]);

        // 5. Libertar recursos: Fecha a ligação ao banco imediatamente
        $pdo = null;

        // Retorna resposta de sucesso para o AJAX no index.php
        http_response_code(200);
        echo json_encode(["status" => "success"]);

    } catch (Exception $e) {
        // Em caso de erro, retorna o código 500
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    // Bloqueia acessos diretos via URL
    http_response_code(405);
    echo "Método não permitido.";
}
?>