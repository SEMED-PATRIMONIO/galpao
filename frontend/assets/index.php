<?php
// /var/www/informes/public/index.php

require_once __DIR__ . '/../config/database.php';

// --- LOGICA DE SERVIÇO DO PDF (Para o iframe) ---
if (isset($_GET['view'])) {
    $fileHash = preg_replace('/[^a-f0-9]/', '', $_GET['view']);
    $path = __DIR__ . '/../storage/reports/' . $fileHash . '.pdf';
    
    if (file_exists($path)) {
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="informe.pdf"');
        readfile($path);
        exit;
    }
    die("Arquivo não encontrado.");
}

$erro = "";
$pdfParaAbrir = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cpfLimpo = preg_replace('/[^0-9]/', '', $_POST['cpf']);
    $cpfLimpo = str_pad($cpfLimpo, 11, '0', STR_PAD_LEFT);
    $cpfHash = hash('sha256', $cpfLimpo);
    $cpfMascarado = preg_replace("/(\d{3})(\d{3})(\d{3})(\d{2})/", "$1.$2.$3-$4", $cpfLimpo);
    $matricula = trim($_POST['matricula']);

    // Consulta (Lógica preservada)
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
        // Em vez de readfile, passamos o hash para o Modal
        $pdfParaAbrir = $cpfHash;
    } else {
        $erro = "Dados não conferem com nossos registros.";
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe de Rendimentos 2026</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            height: 100vh; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            font-family: 'Segoe UI', sans-serif;
            background: url('fundo.png') no-repeat center center fixed; 
            background-size: cover;
        }

        /* Overlay para escurecer o fundo levemente */
        body::before {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.4);
            z-index: 0;
        }

        .glass-card { 
            position: relative;
            z-index: 1;
            width: 90%; 
            max-width: 400px; 
            padding: 40px; 
            border-radius: 25px; 
            background: rgba(255, 255, 255, 0.1); 
            backdrop-filter: blur(15px); 
            -webkit-backdrop-filter: blur(15px); 
            border: 1px solid rgba(255, 255, 255, 0.2); 
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
            text-align: center; 
            color: white; 
        }

        h2 { font-weight: 300; margin-bottom: 30px; letter-spacing: 1px; }

        input { 
            width: 100%; 
            padding: 15px; 
            margin-bottom: 20px; 
            border: none; 
            border-radius: 12px; 
            background: rgba(255, 255, 255, 0.2); 
            color: white; 
            font-size: 16px;
            outline: none;
            transition: 0.3s;
        }
        input::placeholder { color: rgba(255,255,255,0.7); }
        input:focus { background: rgba(255, 255, 255, 0.3); }

        button { 
            width: 100%; 
            padding: 15px; 
            background: #ffcc00; 
            color: #003366; 
            border: none; 
            border-radius: 12px; 
            font-size: 16px; 
            font-weight: bold; 
            cursor: pointer;
            transition: 0.3s;
        }
        button:hover { background: #e6b800; transform: translateY(-2px); }

        .error { color: #ff6b6b; margin-top: 15px; font-size: 14px; }

        /* Modal do PDF */
        #pdfModal { 
            display: <?= $pdfParaAbrir ? 'flex' : 'none' ?>; 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); 
            z-index: 100; justify-content: center; align-items: center; flex-direction: column;
        }
        .modal-content { width: 90%; height: 80%; background: white; border-radius: 15px; overflow: hidden; position: relative; }
        iframe { width: 100%; height: 100%; border: none; }
        
        .btn-voltar { 
            margin-top: 20px; 
            padding: 12px 30px; 
            background: #ff4444; 
            color: white; 
            border: none; 
            border-radius: 50px; 
            cursor: pointer; 
            font-weight: bold;
        }
    </style>
</head>
<body>

    <div class="glass-card">
        <h2>Informe 2026</h2>
        <form id="formInforme" method="POST" autocomplete="off">
            <input type="tel" name="cpf" id="cpf" placeholder="CPF" required autocomplete="off">
            <input type="text" name="matricula" id="matricula" placeholder="Matrícula" required autocomplete="off">
            <button type="submit">Visualizar Documento</button>
        </form>
        <?php if($erro): ?><div class="error"><?= $erro ?></div><?php endif; ?>
    </div>

    <div id="pdfModal">
        <div class="modal-content">
            <?php if($pdfParaAbrir): ?>
                <iframe src="index.php?view=<?= $pdfParaAbrir ?>"></iframe>
            <?php endif; ?>
        </div>
        <button class="btn-voltar" onclick="fecharLimpar()">← VOLTAR E NOVA CONSULTA</button>
    </div>

    <script>
        // Máscara do CPF
        document.getElementById('cpf').addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });

        // Função de Voltar: Fecha modal, reseta formulário e limpa URL para evitar re-envio
        function fecharLimpar() {
            document.getElementById('pdfModal').style.display = 'none';
            document.getElementById('formInforme').reset();
            // Limpa o cache de busca e redireciona para a página limpa (sem POST na memória)
            window.location.href = 'index.php'; 
        }

        // Impede que o navegador sugira preenchimento automático mesmo após o reset
        window.onload = function() {
            document.getElementById('formInforme').reset();
        };
    </script>
</body>
</html>