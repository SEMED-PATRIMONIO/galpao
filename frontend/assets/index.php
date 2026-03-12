<?php
require_once __DIR__ . '/../config/database.php';

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
$ua = $_SERVER['HTTP_USER_AGENT'];
$erro = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Pega o CPF e remove qualquer máscara para gerar o HASH do arquivo
    $cpfPuro = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $cpfPuro = str_pad($cpfPuro, 11, '0', STR_PAD_LEFT); // Garante os zeros à esquerda
    $cpfHash = hash('sha256', $cpfPuro);
    
    // 2. Formata o CPF com máscara para bater com a sua tabela ir_colaboradores_dados
    $cpfParaBanco = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfPuro);
    
    $matricula = trim($_POST['matricula']);

    // 3. Consulta ajustada para comparar formatos iguais
    $stmt = $pdo->prepare("
        SELECT a.nome_arquivo 
        FROM ir_arquivos_split a
        WHERE a.cpf_hash = ? 
        AND EXISTS (
            SELECT 1 FROM ir_colaboradores_dados v 
            WHERE v.cpf = ? AND v.matricula = ?
        )
    ");
    
    $stmt->execute([$cpfHash, $cpfParaBanco, $matricula]);
    $res = $stmt->fetch();

    if ($res) {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'SUCESSO')")->execute([$cpfParaBanco, $ip, $ua]);
        
        $caminhoArquivo = __DIR__ . '/../storage/reports/' . $res['nome_arquivo'];
        
        if (file_exists($caminhoArquivo)) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="informe_rendimentos.pdf"');
            readfile($caminhoArquivo);
            exit;
        } else {
            $erro = "Arquivo processado, mas não encontrado no servidor.";
        }
    } else {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'FALHA')")->execute([$cpfParaBanco, $ip, $ua]);
        $erro = "CPF ou Matrícula não localizados.";
    }
} else {
    $pdo->prepare("INSERT INTO ir_auditoria_acessos (ip_origem, user_agent, resultado) VALUES (?, ?, 'VISITA')")->execute([$ip, $ua]);
}
?>