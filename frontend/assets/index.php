<?php
// /var/www/informes/public/index.php

// 1. SERVIÇO DE ENTREGA DO PDF (Necessário para o Modal carregar o arquivo)
if (isset($_GET['view'])) {
    require_once __DIR__ . '/../config/database.php';
    $fileHash = preg_replace('/[^a-f0-9]/', '', $_GET['view']);
    $path = __DIR__ . '/../storage/reports/' . $fileHash . '.pdf';
    
    if (file_exists($path)) {
        if (ob_get_level()) ob_end_clean();
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="informe_2025.pdf"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, max-age=0, must-revalidate');
        readfile($path);
        exit;
    }
    die("Documento não localizado.");
}

require_once __DIR__ . '/../config/database.php';

// 2. LIMITE DE 30 USUÁRIOS SIMULTÂNEOS (Últimos 2 minutos)
$stmtCount = $pdo->query("SELECT COUNT(DISTINCT ip_origem) FROM ir_auditoria_acessos WHERE data_hora > NOW() - INTERVAL '2 minutes'");
$usuariosAtivos = $stmtCount->fetchColumn();

if ($usuariosAtivos >= 30 && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    die("<body style='background:#002244;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;'>
            <div style='padding:20px;'>
                <h2>Servidor Ocupado</h2>
                <p>Muitas pessoas acessando agora. Tente novamente em 1 ou 2 minutos.</p>
                <button onclick='window.location.reload()' style='padding:10px 20px;background:#ffcc00;border:none;border-radius:5px;cursor:pointer;'>Tentar Novamente</button>
            </div>
         </body>");
}

// Captura dados para auditoria
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'Desconhecido';
$ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Desconhecido';
$erro = "";
$pdfParaAbrir = "";

// 3. PROCESSAMENTO DO FORMULÁRIO (POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cpfNumeros = preg_replace('/[^0-9]/', '', $_POST['cpf'] ?? '');
    $cpfNumeros = str_pad($cpfNumeros, 11, '0', STR_PAD_LEFT);
    $cpfHash = hash('sha256', $cpfNumeros);
    $cpfMascarado = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfNumeros);
    $matricula = trim($_POST['matricula'] ?? '');

    // Consulta validando RH e buscando arquivo
    $stmt = $pdo->prepare("SELECT a.nome_arquivo FROM ir_arquivos_split a WHERE a.cpf_hash = ? AND EXISTS (SELECT 1 FROM ir_colaboradores_dados v WHERE v.cpf = ? AND v.matricula = ?)");
    $stmt->execute([$cpfHash, $cpfMascarado, $matricula]);
    $res = $stmt->fetch();

    if ($res) {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'SUCESSO')")->execute([$cpfMascarado, $ip, $ua]);
        $pdfParaAbrir = $cpfHash;
    } else {
        $pdo->prepare("INSERT INTO ir_auditoria_acessos (cpf_tentativa, ip_origem, user_agent, resultado) VALUES (?, ?, ?, 'FALHA')")->execute([$cpfMascarado, $ip, $ua]);
        $erro = "Os dados informados não conferem.";
    }
} else {
    // Registro de Visita Inicial
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
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { 
            height: 100vh; display: flex; justify-content: center; align-items: center; 
            font-family: 'Segoe UI', sans-serif;
            background: url('fundo.png') no-repeat center center fixed; 
            background-size: cover; overflow: hidden;
        }
        body::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 20, 50, 0.5); z-index: 0; }
        
        .glass-card { 
            position: relative; z-index: 1; width: 90%; max-width: 420px; padding: 45px 30px; 
            border-radius: 30px; background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(20px); 
            -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.25); 
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4); text-align: center; color: white; 
        }
        h1 { font-size: 22px; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
        p.subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 35px; font-weight: 300; }

        input { width: 100%; padding: 16px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 15px; background: rgba(255, 255, 255, 0.1); color: white; font-size: 16px; text-align: center; outline: none; }
        input:focus { background: rgba(255, 255, 255, 0.2); border-color: #ffcc00; }
        
        .btn-consultar { width: 100%; padding: 16px; background: #ffcc00; color: #002244; border: none; border-radius: 15px; font-size: 16px; font-weight: 800; text-transform: uppercase; cursor: pointer; box-shadow: 0 10px 20px rgba(255, 204, 0, 0.2); transition: 0.3s; }
        .btn-consultar:hover { background: #fff; transform: translateY(-2px); }

        /* MODAL E FERRAMENTAS */
        #pdfModal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; display: <?= ($pdfParaAbrir || $erro) ? 'flex' : 'none' ?>; flex-direction: column; justify-content: center; align-items: center; backdrop-filter: blur(10px); }
        .modal-content { width: 95%; height: 80%; background: white; border-radius: 20px; overflow: hidden; position: relative; }
        .toolbar { display: flex; gap: 10px; margin-bottom: 15px; }
        .btn-tool { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 15px; border-radius: 12px; cursor: pointer; font-size: 11px; text-align: center; min-width: 85px; backdrop-filter: blur(10px); }
        .btn-tool:hover { background: rgba(255,255,255,0.4); }
        .error-box { padding: 40px; text-align: center; color: #333; }
    </style>
</head>
<body>

    <div class="glass-card">
        <h1>INFORME DE RENDIMENTOS</h1>
        <p class="subtitle">Ano Calendário: 2025</p>

        <form id="formMain" method="POST" autocomplete="off">
            <input type="tel" name="cpf" id="cpf" placeholder="000.000.000-00" required maxlength="14">
            <small style="display: block; margin-bottom: 15px; font-size: 12px; color: rgba(255,255,255,0.7);">Somente números (sem pontos ou hífen)</small>

            <input type="text" name="matricula" placeholder="Sua Matrícula" required>
            <small title="p.ex.: se no contracheque aparece com '/' use a barra" style="display: block; margin-bottom: 25px; font-size: 12px; color: rgba(255,255,255,0.7); cursor: help;">Digitar exatamente igual ao contracheque</small>

            <button type="submit" class="btn-consultar">Consultar Agora</button>
        </form>
    </div>

    <div id="pdfModal">
        <?php if ($pdfParaAbrir): ?>
        <div class="toolbar">
            <button class="btn-tool" onclick="document.getElementById('pdfFrame').contentWindow.print()" title="Imprimir o documento">🖨️<br>IMPRIMIR</button>
            <button class="btn-tool" onclick="baixarPDF()" title="Salvar uma cópia no dispositivo">💾<br>SALVAR PDF</button>
            <button class="btn-tool" onclick="compartilharPDF()" title="Compartilhar via WhatsApp, E-mail...">🔗<br>PARTILHAR</button>
        </div>
        <?php endif; ?>

        <div class="modal-content">
            <?php if($pdfParaAbrir): ?>
                <iframe id="pdfFrame" src="index.php?view=<?= $pdfParaAbrir ?>#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>
            <?php else: ?>
                <div class="error-box"><h3>Aviso</h3><p><?= $erro ?></p></div>
            <?php endif; ?>
        </div>
        <button onclick="window.location.href='index.php'" style="margin-top: 15px; padding: 12px 35px; background: #ffcc00; border: none; border-radius: 12px; font-weight: bold; cursor: pointer;">← VOLTAR</button>
    </div>

    <script>
        // Temporizador de Ociosidade (2 minutos)
        let timer = setTimeout(() => { if("<?= $pdfParaAbrir ?>") window.location.href='index.php'; }, 120000);

        function baixarPDF() {
            const link = document.createElement('a');
            link.href = 'index.php?view=<?= $pdfParaAbrir ?>';
            link.download = 'Informe_Rendimentos_2025.pdf';
            link.click();
        }

        function compartilharPDF() {
            if (navigator.share) {
                navigator.share({ title: 'Informe de Rendimentos', url: 'index.php?view=<?= $pdfParaAbrir ?>' });
            } else { alert("Navegador sem suporte a partilha direta. Copie o link da barra de endereços."); }
        }

        // Máscara CPF
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });

        // Impede reenvio ao atualizar
        if ( window.history.replaceState ) { window.history.replaceState( null, null, window.location.href ); }
    </script>
</body>
</html>