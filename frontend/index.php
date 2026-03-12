<?php
// Ativar exibição de erros temporariamente para debug se a tela continuar branca
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
$ua = $_SERVER['HTTP_USER_AGENT'];
$erro = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Limpa e garante 11 dígitos (zeros à esquerda)
    $cpfNumeros = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $cpfNumeros = str_pad($cpfNumeros, 11, '0', STR_PAD_LEFT);
    
    // 2. Gera o HASH para buscar o arquivo físico
    $cpfHash = hash('sha256', $cpfNumeros);
    
    // 3. Formata com MÁSCARA para buscar na sua tabela ir_colaboradores_dados
    $cpfMascarado = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfNumeros);
    
    $matricula = trim($_POST['matricula']);

    // 4. Consulta Única: Valida o RH e busca o arquivo ao mesmo tempo
    $stmt = $pdo->prepare("
        SELECT a.nome_arquivo 
        FROM ir_arquivos_split a
        WHERE a.cpf_hash = ? 
        AND EXISTS (
            SELECT 1 FROM ir_colaboradores_dados v 
            WHERE v.cpf = ? AND v.matricula = ?
        )
    ");
    
    $stmt->execute([$cpfHash, $cpfMascarado, $matricula]);
    $res = $stmt->fetch();

    if ($res) {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'SUCESSO')")->execute([$cpfMascarado, $ip, $ua]);
        
        $caminho = __DIR__ . '/../storage/reports/' . $res['nome_arquivo'];
        
        if (file_exists($caminho)) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="informe.pdf"');
            readfile($caminho);
            exit;
        } else {
            $erro = "PDF gerado, mas arquivo não encontrado no servidor.";
        }
    } else {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'FALHA')")->execute([$cpfMascarado, $ip, $ua]);
        $erro = "CPF ou Matrícula não conferem.";
    }
} else {
    // Registra apenas a visita inicial ao carregar a página
    $pdo->prepare("INSERT INTO ir_auditoria_acessos (ip_origem, user_agent, resultado) VALUES (?, ?, 'VISITA')")->execute([$ip, $ua]);
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Informe de Rendimentos</title>
    <style>
        body { margin: 0; padding: 0; height: 100vh; display: flex; justify-content: center; align-items: center; font-family: 'Segoe UI', sans-serif; background: radial-gradient(circle at top, #004a99, #002244); overflow: hidden; }
        .glass-card { width: 85%; max-width: 380px; padding: 40px 25px; border-radius: 25px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 15px 35px rgba(0,0,0,0.3); text-align: center; color: white; }
        input { width: 100%; padding: 16px; margin-bottom: 15px; border: none; border-radius: 12px; background: rgba(255,255,255,0.9); font-size: 16px; box-sizing: border-box; outline: none; }
        button { width: 100%; padding: 16px; background: #ffcc00; color: #003366; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: <?= $erro ? 'flex' : 'none' ?>; justify-content: center; align-items: center; z-index: 100; }
        .modal-content { background: white; color: #333; padding: 30px; border-radius: 20px; width: 80%; max-width: 300px; text-align: center; }
    </style>
</head>
<body>
    <div class="glass-card">
        <h2 style="font-weight: 300; margin-bottom: 30px;">Informe 2026</h2>
        <form method="POST">
            <input type="tel" name="cpf" id="cpf" placeholder="CPF" required autocomplete="off">
            <input type="text" name="matricula" placeholder="Matrícula" required autocomplete="off">
            <button type="submit">Visualizar Documento</button>
        </form>
    </div>

    <div class="modal" id="modalErro" onclick="this.style.display='none'">
        <div class="modal-content">
            <h3 style="color: #c0392b;">Aviso</h3>
            <p><?= $erro ?></p>
            <button style="background: #333; color: white; padding: 10px; border-radius: 5px; width: 100%; border: none;">Voltar</button>
        </div>
    </div>

    <script>
        // Máscara automática de CPF
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });
    </script>
</body>
</html>