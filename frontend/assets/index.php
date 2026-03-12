<?php
require_once __DIR__ . '/../config/database.php';

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
$ua = $_SERVER['HTTP_USER_AGENT'];
$erro = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cpf = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $matricula = trim($_POST['matricula']);
    $cpfHash = hash('sha256', $cpf);

    // Validação: CPF + Matrícula
    $stmt = $pdo->prepare("
        SELECT a.nome_arquivo 
        FROM ir_arquivos_split a
        JOIN ir_colaboradores_dados v ON v.cpf = ?
        WHERE a.cpf_hash = ? AND v.matricula = ?
    ");
    $stmt->execute([$cpf, $cpfHash, $matricula]);
    $res = $stmt->fetch();

    if ($res) {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'SUCESSO')")->execute([$cpf, $ip, $ua]);
        header('Content-Type: application/pdf');
        readfile(__DIR__ . '/../storage/reports/' . $res['nome_arquivo']);
        exit;
    } else {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'FALHA')")->execute([$cpf, $ip, $ua]);
        $erro = "CPF ou Matrícula incorretos.";
    }
} else {
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
        :root { --gov-blue: #003366; --glass: rgba(255, 255, 255, 0.12); }
        body { margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center; font-family: 'Segoe UI', sans-serif; background: radial-gradient(circle at top, #004a99, #002244); overflow: hidden; }
        .glass-card { width: 85%; max-width: 380px; padding: 40px 25px; border-radius: 24px; background: var(--glass); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center; color: white; }
        input { width: 100%; padding: 16px; margin-bottom: 15px; border: none; border-radius: 10px; background: rgba(255,255,255,0.95); font-size: 16px; box-sizing: border-box; }
        button { width: 100%; padding: 16px; background: #ffcc00; color: #003366; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
        button:active { transform: scale(0.98); }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: <?= $erro ? 'flex' : 'none' ?>; justify-content: center; align-items: center; }
        .modal-content { background: white; color: #333; padding: 25px; border-radius: 20px; text-align: center; width: 280px; }
    </style>
</head>
<body>
    <div class="glass-card">
        <h2 style="font-weight: 300;">Informe de Rendimentos</h2>
        <p style="font-size: 14px; opacity: 0.8; margin-bottom: 30px;">Acesse seu documento 2026</p>
        <form method="POST">
            <input type="tel" name="cpf" id="cpf" placeholder="CPF (apenas números)" required>
            <input type="text" name="matricula" placeholder="Número da Matrícula" required>
            <button type="submit">Visualizar PDF</button>
        </form>
    </div>

    <div class="modal" id="errorModal" onclick="this.style.display='none'">
        <div class="modal-content">
            <h3 style="color: #c0392b;">Acesso Negado</h3>
            <p><?= $erro ?></p>
            <button style="background: #333; color: white; padding: 10px;">Tentar Novamente</button>
        </div>
    </div>

    <script>
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });
    </script>
</body>
</html>