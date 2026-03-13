<?php
// /var/www/informes/public/index.php

// 1. SERVICE DE ENTREGA DO PDF (Corrigido para Android)
if (isset($_GET['view'])) {
    require_once __DIR__ . '/../config/database.php';
    
    $fileHash = preg_replace('/[^a-f0-9]/', '', $_GET['view']);
    $path = __DIR__ . '/../storage/reports/' . $fileHash . '.pdf';
    
    if (file_exists($path)) {
        // Limpa qualquer lixo de memória para não corromper o PDF
        if (ob_get_level()) ob_end_clean();
        
        // Força o navegador a entender que é um PDF
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="informe_rendimentos_2025.pdf"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, max-age=0, must-revalidate');
        header('Pragma: public');
        
        readfile($path);
        exit;
    }
    die("Documento não localizado.");
}

require_once __DIR__ . '/../config/database.php';

$erro = "";
$pdfParaAbrir = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cpfLimpo = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $cpfLimpo = str_pad($cpfLimpo, 11, '0', STR_PAD_LEFT);
    $cpfHash = hash('sha256', $cpfLimpo);
    $cpfMascarado = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfLimpo);
    $matricula = trim($_POST['matricula']);

    $stmt = $pdo->prepare("
        SELECT a.nome_arquivo 
        FROM ir_arquivos_split a
        WHERE a.cpf_hash = ? 
        AND EXISTS (SELECT 1 FROM ir_colaboradores_dados v WHERE v.cpf = ? AND v.matricula = ?)
    ");
    $stmt->execute([$cpfHash, $cpfMascarado, $matricula]);
    $res = $stmt->fetch();

    if ($res) {
        $pdfParaAbrir = $cpfHash;
    } else {
        $erro = "Os dados informados não conferem.";
    }
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
            height: 100vh; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: url('fundo.png') no-repeat center center fixed; 
            background-size: cover;
            overflow: hidden;
        }

        /* Camada de vidro sobre o fundo */
        body::before {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 20, 50, 0.5);
            z-index: 0;
        }

        .glass-card { 
            position: relative;
            z-index: 1;
            width: 90%; 
            max-width: 420px; 
            padding: 45px 30px; 
            border-radius: 30px; 
            background: rgba(255, 255, 255, 0.12); 
            backdrop-filter: blur(20px); 
            -webkit-backdrop-filter: blur(20px); 
            border: 1px solid rgba(255, 255, 255, 0.25); 
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
            text-align: center; 
            color: white; 
        }

        h1 { font-size: 22px; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
        p.subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 35px; font-weight: 300; }

        input { 
            width: 100%; 
            padding: 16px; 
            margin-bottom: 18px; 
            border: 1px solid rgba(255,255,255,0.2); 
            border-radius: 15px; 
            background: rgba(255, 255, 255, 0.1); 
            color: white; 
            font-size: 16px;
            text-align: center;
            outline: none;
            transition: all 0.3s;
        }
        input:focus { background: rgba(255, 255, 255, 0.2); border-color: #ffcc00; }
        input::placeholder { color: rgba(255,255,255,0.5); }

        button.btn-consultar { 
            width: 100%; 
            padding: 16px; 
            background: #ffcc00; 
            color: #002244; 
            border: none; 
            border-radius: 15px; 
            font-size: 16px; 
            font-weight: 800; 
            text-transform: uppercase;
            cursor: pointer;
            transition: 0.3s;
            box-shadow: 0 10px 20px rgba(255, 204, 0, 0.2);
        }
        button.btn-consultar:hover { background: #fff; transform: translateY(-2px); }

        .error { background: rgba(231, 76, 60, 0.2); padding: 10px; border-radius: 10px; margin-top: 15px; font-size: 14px; border: 1px solid rgba(231, 76, 60, 0.3); }

        /* MODAL E IFRAME */
        #pdfModal { 
            display: <?= $pdfParaAbrir ? 'flex' : 'none' ?>; 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.9); 
            z-index: 1000; justify-content: center; align-items: center; flex-direction: column;
        }
        .modal-content { width: 95%; height: 85%; background: #333; border-radius: 20px; overflow: hidden; position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        iframe { width: 100%; height: 100%; border: none; }
        
        .btn-voltar { 
            margin-top: 20px; 
            padding: 15px 40px; 
            background: #fff; 
            color: #333; 
            border: none; 
            border-radius: 50px; 
            cursor: pointer; 
            font-weight: 700;
            text-transform: uppercase;
            font-size: 13px;
            box-shadow: 0 5px 15px rgba(255,255,255,0.2);
        }
    </style>
</head>
<body>

    <div class="glass-card">
        <h1>INFORME DE RENDIMENTOS</h1>
        <p class="subtitle">Ano Calendário: 2025</p>

        <form id="formMain" method="POST" autocomplete="off">
            <input type="tel" name="cpf" id="cpf" placeholder="000.000.000-00" required maxlength="14">
            <input type="text" name="matricula" id="mat" placeholder="Sua Matrícula" required>
            <button type="submit" class="btn-consultar">Consultar Agora</button>
        </form>

        <?php if($erro): ?>
            <div class="error"><?= $erro ?></div>
        <?php endif; ?>
    </div>

    <div id="pdfModal">
        <div class="modal-content">
            <?php if($pdfParaAbrir): ?>
                <iframe src="index.php?view=<?= $pdfParaAbrir ?>#toolbar=0"></iframe>
            <?php endif; ?>
        </div>
        <button class="btn-voltar" onclick="resetAll()">← Nova Consulta</button>
    </div>

    <script>
        // Máscara CPF
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });

        // Limpeza total para nova consulta
        function resetAll() {
            document.getElementById('pdfModal').style.display = 'none';
            // Redireciona para si mesmo sem dados de POST
            window.location.href = window.location.pathname;
        }

        // Impede reenvio de formulário ao atualizar (F5)
        if ( window.history.replaceState ) {
            window.history.replaceState( null, null, window.location.href );
        }
    </script>
</body>
</html>