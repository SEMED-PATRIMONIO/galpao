<?php
// Configurações do Banco de Dados
$host   = "localhost";
$port   = "5432";
$db     = "redalun";
$user   = "super";
$pw     = "semed";

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$db", $user, $pw);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode(['error' => 'Falha na conexão: ' . $e->getMessage()]));
}
?>