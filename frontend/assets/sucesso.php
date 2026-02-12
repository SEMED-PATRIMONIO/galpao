<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sucesso - Rede Alunos</title>
    <style>
        body { 
            margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
            background: url('fundo.png') no-repeat center center fixed; background-size: cover;
            font-family: sans-serif; color: white; text-align: center;
        }
        .glass { 
            background: rgba(255,255,255,0.15); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            padding: 40px; border-radius: 25px; border: 1px solid rgba(255,255,255,0.2);
            width: 90%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h1 { color: #2ecc71; font-size: 3rem; margin: 0; }
        p { font-size: 1.1rem; line-height: 1.5; }
        button { 
            margin-top: 20px; padding: 12px 25px; border-radius: 10px; border: none; 
            background: #1e3a8a; color: white; font-weight: bold; cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="glass">
        <h1>✅</h1>
        <h2>CADASTRO REALIZADO!</h2>
        <p>As informações foram enviadas com sucesso para a Secretaria de Educação de Queimados.</p>
        <button onclick="window.location.href='index.php'">NOVO CADASTRO</button>
    </div>
</body>
</html>