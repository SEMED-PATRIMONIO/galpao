<?php
// /var/www/informes/config/database.php
ini_set('session.cookie_domain', '.paiva.api.br'); // Compartilha sessão entre portas/subdomínios
session_start();

$host = 'localhost';
$db   = 'estoque_central'; // Seu banco principal
$user = 'postgres';        // Seu usuário do banco
$pass = 'Gatosap2009*2';       // Altere para sua senha real

try {
    $pdo = new PDO("pgsql:host=$host;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    error_log("Erro de conexão: " . $e->getMessage());
    die("Indisponibilidade momentânea no banco de dados.");
}