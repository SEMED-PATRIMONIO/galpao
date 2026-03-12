<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

try {
    require_once __DIR__ . '/../config/database.php';
} catch (Exception $e) {
    die("Erro ao carregar configuracao: " . $e->getMessage());
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'];
$ua = $_SERVER['HTTP_USER_AGENT'];
$erro = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cpfLimpo = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $cpfLimpo = str_pad($cpfLimpo, 11, '0', STR_PAD_LEFT);
    $cpfHash = hash('sha256', $cpfLimpo);
    $cpfMascarado = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfLimpo);
    $matricula = trim($_POST['matricula']);

    // Busca o arquivo e valida o colaborador
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
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, resultado) VALUES (?, ?, 'SUCESSO')")->execute([$cpfMascarado, $ip]);
        $path = __DIR__ . '/../storage/reports/' . $res['nome_arquivo'];
        if (file_exists($path)) {
            header('Content-Type: application/pdf');
            readfile($path);
            exit;
        } else { $erro = "Documento em processamento. Aguarde."; }
    } else {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, resultado) VALUES (?, ?, 'FALHA')")->execute([$cpfMascarado, $ip]);
        $erro = "Dados não conferem.";
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe de Rendimentos</title>
    <style>
        body { margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center; font-family: sans-serif; background: radial-gradient(circle at top, #004a99, #002244); }
        .card { width: 320px; padding: 40px; border-radius: 20px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); text-align: center; color: white; }
        input { width: 100%; padding: 12px; margin: 10px 0; border-radius: 8px; border: none; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #ffcc00; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .error { color: #ff6b6b; margin-top: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Informe 2026</h2>
        <form method="POST">
            <input type="text" name="cpf" id="cpf" placeholder="CPF" required>
            <input type="text" name="matricula" placeholder="Matrícula" required>
            <button type="submit">Acessar PDF</button>
        </form>
        <?php if($erro): ?><div class="error"><?= $erro ?></div><?php endif; ?>
    </div>
    <script>
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });
    </script>
</body>
</html>