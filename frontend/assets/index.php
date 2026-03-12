<?php
require_once __DIR__ . '/../config/database.php';

// Auditoria Imediata ao Acessar (LGPD Compliance)
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
$ua = $_SERVER['HTTP_USER_AGENT'];
$logAcesso = $pdo->prepare("INSERT INTO ir_auditoria_acessos (ip_origem, user_agent, resultado) VALUES (?, ?, 'VISITA')");
$logAcesso->execute([$ip, $ua]);

$erro = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cpf = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $nasc = $_POST['nascimento'];
    $cpfHash = hash('sha256', $cpf);

    $stmt = $pdo->prepare("
        SELECT a.nome_arquivo 
        FROM ir_arquivos_split a
        JOIN ir_colaboradores_dados v ON v.cpf = ?
        WHERE a.cpf_hash = ? AND v.data_nascimento = ?
    ");
    $stmt->execute([$cpf, $cpfHash, $nasc]);
    $res = $stmt->fetch();

    if ($res) {
        $pdo->prepare("UPDATE ir_auditoria_acessos SET cpf_tentativa = ?, resultado = 'SUCESSO' WHERE ip_origem = ? AND resultado = 'VISITA' ORDER BY id DESC LIMIT 1")->execute([$cpf, $ip]);
        header('Content-Type: application/pdf');
        readfile(__DIR__ . '/../storage/reports/' . $res['nome_arquivo']);
        exit;
    } else {
        $pdo->prepare("UPDATE ir_auditoria_acessos SET cpf_tentativa = ?, resultado = 'FALHA' WHERE ip_origem = ? AND resultado = 'VISITA' ORDER BY id DESC LIMIT 1")->execute([$cpf, $ip]);
        $erro = "Dados não conferem.";
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Portal de Informes</title>
    <style>
        :root { --gov-blue: #003366; --glass: rgba(255, 255, 255, 0.15); }
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: 'Segoe UI', sans-serif; }
        
        /* Fundo Azul Governamental */
        body {
            background: radial-gradient(circle at top, #004a99, var(--gov-blue));
            display: flex; justify-content: center; align-items: center;
        }

        /* Container Principal */
        .app-container {
            width: 90%; max-width: 400px;
            padding: 30px; border-radius: 25px;
            background: var(--glass);
            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
            text-align: center; color: white;
        }

        h2 { font-weight: 300; margin-bottom: 30px; letter-spacing: 1px; }

        input {
            width: 100%; padding: 18px; margin-bottom: 15px;
            border: none; border-radius: 12px;
            background: rgba(255,255,255,0.9);
            font-size: 18px; box-sizing: border-box;
            outline: none; color: #333;
        }

        button {
            width: 100%; padding: 18px;
            background: #ffcc00; color: #003366;
            border: none; border-radius: 12px;
            font-size: 18px; font-weight: bold;
            text-transform: uppercase; cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .alert-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(10px);
            display: <?= $erro ? 'flex' : 'none' ?>;
            justify-content: center; align-items: center; z-index: 100;
        }

        .modal-content {
            background: white; color: #333;
            padding: 30px; border-radius: 20px; width: 80%;
            max-width: 300px; text-align: center;
        }
    </style>
</head>
<body>

    <div class="app-container">
        <img src="logobrasao.png" style="height: 60px; margin-bottom: 20px;">
        <h2>Informe de Rendimentos Ano Base 2025</h2>
        
        <form method="POST">
            <input type="tel" name="cpf" id="cpf" placeholder="000.000.000-00" required>
            <input type="date" name="nascimento" required>
            <p style="font-size: 12px; opacity: 0.8; margin-bottom: 20px;">
                Dica: Use sua data de nascimento para validar o acesso.
            </p>
            <button type="submit">Acessar Documento</button>
        </form>
    </div>

    <?php if ($erro): ?>
    <div class="alert-modal" id="modalErro" onclick="this.style.display='none'">
        <div class="modal-content">
            <h3 style="color: #d93025;">Ops!</h3>
            <p><?= $erro ?></p>
            <button style="background: #333; color: white; padding: 10px;">Fechar</button>
        </div>
    </div>
    <?php endif; ?>

    <script>
        // Máscara de CPF automática
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });
    </script>
</body>
</html>