<?php
header('Content-Type: application/json');
// Busca a conexão na pasta pai por segurança
require_once '../db.php';

$cpf = isset($_GET['cpf']) ? preg_replace('/\D/', '', $_GET['cpf']) : '';

if (strlen($cpf) !== 11) {
    echo json_encode(['exists' => false]);
    exit;
}

try {
    // Verifica se o CPF do aluno já existe na tabela inscricoes
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inscricoes WHERE cpf_aluno = ?");
    $stmt->execute([$cpf]);
    $count = $stmt->fetchColumn();

    echo json_encode(['exists' => $count > 0]);
} catch (Exception $e) {
    echo json_encode(['error' => true]);
}

// Encerra conexão
$pdo = null;
?>