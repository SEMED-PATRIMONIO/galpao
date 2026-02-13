<?php
require_once 'db.php'; // Certifique-se de que o db.php está na mesma pasta

// 1. Totais Gerais
$total = $pdo->query("SELECT count(*) FROM inscricoes")->fetchColumn();
$pcd = $pdo->query("SELECT count(*) FROM inscricoes WHERE pcd = true")->fetchColumn();
$bolsa = $pdo->query("SELECT count(*) FROM inscricoes WHERE bolsa_familia = true")->fetchColumn();

// 2. Gênero
$generos = $pdo->query("SELECT sexo, count(*) as qtd FROM inscricoes GROUP BY sexo")->fetchAll(PDO::FETCH_ASSOC);

// 3. Etnia
$etnias = $pdo->query("SELECT etnia, count(*) as qtd FROM inscricoes GROUP BY etnia ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);

// 4. Escolas (Unidade de Preferência)
$escolas = $pdo->query("SELECT unidade_preferencia, count(*) as qtd FROM inscricoes GROUP BY unidade_preferencia ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);

// 5. Bairros
$bairros = $pdo->query("SELECT bairro, count(*) as qtd FROM inscricoes GROUP BY bairro ORDER BY qtd DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Dashboard - Rede Alunos</title>
    <style>
        :root {
            --glass: rgba(255, 255, 255, 0.12);
            --glass-border: rgba(255, 255, 255, 0.2);
            --text: #ffffff;
        }

        body {
            margin: 0; padding: 20px;
            font-family: 'Segoe UI', sans-serif;
            background: #0f172a url('fundo.png') no-repeat center center fixed;
            background-size: cover;
            color: var(--text);
        }

        /* Layout em Grid para Desktop */
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: auto;
            gap: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }

        /* Cartão Vitrificado */
        .card {
            background: var(--glass);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transition: transform 0.3s ease;
        }
        .card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.4); }

        .card-title {
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.8;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .big-number { font-size: 2.5rem; font-weight: bold; }

        /* Estilo para as contagens por gênero */
        .gender-box {
            display: flex;
            justify-content: space-around;
            align-items: center;
            padding: 10px 0;
        }
        .gender-item { text-align: center; }
        .gender-icon { font-size: 3rem; display: block; margin-bottom: 5px; }
        
        /* Tabelas elegantes dentro dos cards */
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; }
        td:last-child { text-align: right; font-weight: bold; }
        tr:last-child td { border: none; }

        .tag {
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 5px;
            font-size: 0.75rem;
        }

        /* Destaque para o Título Principal */
        .header-main {
            grid-column: span 4;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>

<div class="dashboard-grid">
    
    <div class="header-main">
        <h1 style="margin:0;">📊 Painel Estratégico - Rede Alunos</h1>
        <div class="card" style="padding: 10px 25px; border-radius: 50px;">
            Total Geral: <span style="font-size:1.5rem; font-weight:bold;"> <?php echo $total; ?> </span>
        </div>
    </div>

    <div class="card" style="grid-column: span 2;">
        <div class="card-title">Distribuição por Gênero</div>
        <div class="gender-box">
            <?php foreach($generos as $g): 
                $icon = ($g['sexo'] == 'FEMININO') ? '👧' : (($g['sexo'] == 'MASCULINO') ? '👦' : '👤');
                $cor = ($g['sexo'] == 'FEMININO') ? '#ff9eb5' : (($g['sexo'] == 'MASCULINO') ? '#9ec9ff' : '#fff');
            ?>
            <div class="gender-item">
                <span class="gender-icon"><?php echo $icon; ?></span>
                <span style="color:<?php echo $cor; ?>; font-weight:bold;"><?php echo $g['sexo']; ?></span>
                <div class="big-number"><?php echo $g['qtd']; ?></div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <div class="card" style="grid-column: span 2;">
        <div class="card-title">Indicadores Sociais</div>
        <div style="display: flex; justify-content: space-around; padding-top:10px;">
            <div style="text-align:center;">
                <span style="font-size:2.5rem;">♿</span>
                <p>PCD</p>
                <div class="big-number"><?php echo $pcd; ?></div>
            </div>
            <div style="text-align:center;">
                <span style="font-size:2.5rem;">💰</span>
                <p>Bolsa Família</p>
                <div class="big-number"><?php echo $bolsa; ?></div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">🎨 Perfil Étnico</div>
        <table>
            <?php foreach($etnias as $e): ?>
            <tr>
                <td><?php echo $e['etnia']; ?></td>
                <td><?php echo $e['qtd']; ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <div class="card">
        <div class="card-title">📍 Top 10 Bairros</div>
        <table>
            <?php foreach($bairros as $b): ?>
            <tr>
                <td><?php echo (!empty($b['bairro']) ? $b['bairro'] : 'NÃO INFORMADO'); ?></td>
                <td><?php echo $b['qtd']; ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <div class="card" style="grid-column: span 2;">
        <div class="card-title">🏫 Demanda por Unidade Escolar</div>
        <div style="max-height: 300px; overflow-y: auto; padding-right:10px;">
            <table>
                <?php foreach($escolas as $esc): ?>
                <tr>
                    <td><?php echo $esc['unidade_preferencia']; ?></td>
                    <td><span class="tag"><?php echo $esc['qtd']; ?> inscritos</span></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
    </div>

</div>

</body>
</html>