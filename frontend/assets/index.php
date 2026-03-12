<?php
// Força a exibição de erros para não ficar em branco
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

try {
    require_once __DIR__ . '/../config/database.php';

    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
    $ua = $_SERVER['HTTP_USER_AGENT'];
    $erro = "";

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // 1. Prepara os dados de entrada
        $cpfNumeros = preg_replace('/[^0-9]/', '', $_POST['cpf']);
        $cpfNumeros = str_pad($cpfNumeros, 11, '0', STR_PAD_LEFT); // Zeros à esquerda
        $cpfHash = hash('sha256', $cpfNumeros);
        $cpfMascarado = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfNumeros);
        $matricula = trim($_POST['matricula']);

        // 2. Consulta: Primeiro verifica se o colaborador existe no RH
        $stmtColab = $pdo->prepare("SELECT cpf FROM ir_colaboradores_dados WHERE cpf = ? AND matricula = ?");
        $stmtColab->execute([$cpfMascarado, $matricula]);
        $colaborador = $stmtColab->fetch();

        if ($colaborador) {
            // 3. Se o RH validou, busca o arquivo gerado pelo OCR
            $stmtArq = $pdo->prepare("SELECT nome_arquivo FROM ir_arquivos_split WHERE cpf_hash = ?");
            $stmtArq->execute([$cpfHash]);
            $arquivo = $stmtArq->fetch();

            if ($arquivo) {
                $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'SUCESSO')")->execute([$cpfMascarado, $ip, $ua]);
                
                $caminho = __DIR__ . '/../storage/reports/' . $arquivo['nome_arquivo'];
                if (file_exists($caminho)) {
                    header('Content-Type: application/pdf');
                    header('Content-Disposition: inline; filename="informe.pdf"');
                    readfile($caminho);
                    exit;
                } else {
                    $erro = "Seu informe foi identificado, mas o arquivo físico ainda não foi gerado. Tente em alguns minutos.";
                }
            } else {
                $erro = "Usuário validado, mas o processamento do seu PDF ainda não foi concluído pelo sistema.";
            }
        } else {
            $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'FALHA')")->execute([$cpfMascarado, $ip, $ua]);
            $erro = "CPF ou Matrícula não conferem com nossos registros.";
        }
    } else {
        // Grava a visita de forma segura
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (ip_origem, user_agent, resultado) VALUES (?, ?, 'VISITA')")->execute([$ip, $ua]);
    }
} catch (Exception $e) {
    die("Erro Crítico de Sistema: " . $e->getMessage());
}
?>