<?php
// Ativação de erros para diagnóstico
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once '../db.php';; 

// 1. Captura de Filtros
$filtroEscola = $_GET['escola'] ?? 'TODAS';

try {
    // 2. Construção da cláusula WHERE para filtros
    $where = ($filtroEscola === 'TODAS') ? "" : " WHERE unidade_preferencia = " . $pdo->quote($filtroEscola);

    // 3. Consultas Estatísticas (Respeitando o filtro)
    $total = $pdo->query("SELECT count(*) FROM inscricoes $where")->fetchColumn() ?: 0;
    $pcd = $pdo->query("SELECT count(*) FROM inscricoes " . ($where ? "$where AND pcd = true" : "WHERE pcd = true"))->fetchColumn() ?: 0;
    $bolsa = $pdo->query("SELECT count(*) FROM inscricoes " . ($where ? "$where AND bolsa_familia = true" : "WHERE bolsa_familia = true"))->fetchColumn() ?: 0;

    // Gênero (com agrupamento)
    $generos = $pdo->query("SELECT sexo, count(*) as qtd FROM inscricoes $where GROUP BY sexo")->fetchAll(PDO::FETCH_ASSOC);

    // Turnos
    $turnos = $pdo->query("SELECT turno_pretendido, count(*) as qtd FROM inscricoes $where GROUP BY turno_pretendido ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);

    // Ano Escolar
    $anos_escolares = $pdo->query("SELECT ano_pretendido, count(*) as qtd FROM inscricoes $where GROUP BY ano_pretendido ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);

    // Etnia
    $etnias = $pdo->query("SELECT etnia, count(*) as qtd FROM inscricoes $where GROUP BY etnia ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);

    // Bairros (Top 10)
    $bairros = $pdo->query("SELECT bairro, count(*) as qtd FROM inscricoes $where GROUP BY bairro ORDER BY qtd DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);

    $escolas = $pdo->query("SELECT unidade_preferencia, count(*) as qtd FROM inscricoes $where GROUP BY unidade_preferencia ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);
    // Ranking de Escolas
    $locais = $pdo->query("SELECT unidade_preferencia, count(*) as qtd FROM inscricoes $where GROUP BY unidade_preferencia ORDER BY qtd DESC")->fetchAll(PDO::FETCH_ASSOC);

    // Lista de Escolas para o filtro
    $listaEscolas = $pdo->query("SELECT DISTINCT unidade_preferencia FROM inscricoes ORDER BY 1")->fetchAll(PDO::FETCH_COLUMN);

} catch (PDOException $e) {
    die("Erro Crítico no Banco de Dados: " . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Estratégico - Formulários Preenchidos</title>
    <style>
        :root {
            --glass: rgba(255, 255, 255, 0.12);
            --glass-border: rgba(255, 255, 255, 0.2);
            --text: #ffffff;
            --success: #2ecc71;
            --error: #ef4444;
        }

        body {
            margin: 0; padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a url('fundo.png') no-repeat center center fixed;
            background-size: cover;
            color: var(--text);
        }

        /* Grid Desktop de 4 Colunas */
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            max-width: 1500px;
            margin: 0 auto;
        }

        /* Cartão Vitrificado com Cantos Arredondados */
        .card {
            background: var(--glass);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid var(--glass-border);
            border-radius: 25px;
            padding: 22px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transition: 0.3s ease;
        }
        .card:hover { border-color: rgba(255,255,255,0.4); transform: translateY(-3px); }

        .card-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            opacity: 0.7;
            margin-bottom: 15px;
            font-weight: bold;
        }

        .big-number { font-size: 2.8rem; font-weight: bold; line-height: 1; }
        
        /* Controles e Filtros */
        .header-main {
            grid-column: span 4;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
        }

        select, button {
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid var(--glass-border);
            background: rgba(0,0,0,0.4);
            color: white;
            font-size: 0.9rem;
            cursor: pointer;
            outline: none;
            transition: 0.2s;
        }
        button:hover { background: rgba(255,255,255,0.1); }

        /* Tabelas Internas */
        .scroll-box { max-height: 250px; overflow-y: auto; margin-top: 10px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; }
        td:last-child { text-align: right; font-weight: bold; }

        /* Estilo para PDF (Impressão) */
        @media print {
            body { background: white !important; color: black !important; }
            .card { background: white !important; border: 1px solid #ddd !important; color: black !important; box-shadow: none !important; }
            .no-print { display: none !important; }
            .big-number { color: black !important; }
        }
    </style>
</head>
<body>

<div class="dashboard-grid">
    
    <div class="header-main no-print">
        <h1 style="margin:0;">📊 Central de Inteligência <small style="font-size:0.9rem; opacity:0.6;">SEMED 2026</small></h1>
        
        <div style="display:flex; gap:10px;">
            <form method="GET" id="formFiltro" style="display:flex; gap:10px;">
                <select name="escola" onchange="this.form.submit()">
                    <option value="TODAS">REDE MUNICIPAL (GERAL)</option>
                    <?php foreach($listaEscolas as $esc): ?>
                        <option value="<?php echo $esc; ?>" <?php echo ($filtroEscola == $esc ? 'selected' : ''); ?>>
                            <?php echo $esc; ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </form>
            <button onclick="exportarExcel()" class="btn-excel" style="background:#217346; border:none;">📗 EXCEL</button>
            <button onclick="window.print()" class="btn-pdf" style="background:#ad0b00; border:none;">📕 PDF</button>
        </div>
    </div>

    <div class="card" style="text-align:center; display:flex; flex-direction:column; justify-content:center;">
        <div class="card-title">Total de Inscrições</div>
        <div class="big-number"><?php echo $total; ?></div>
        <p style="font-size:0.8rem; opacity:0.6; margin-top:10px;">Registros em tempo real</p>
    </div>

    <div class="card" style="grid-column: span 2;">
        <div class="card-title">Perfil por Gênero</div>
        <div style="display: flex; justify-content: space-around; align-items: center;">
            <?php 
            $f = 0; $m = 0; $ni = 0;
            foreach($generos as $g) {
                if($g['sexo'] == 'FEMININO') $f = $g['qtd'];
                elseif($g['sexo'] == 'MASCULINO') $m = $g['qtd'];
                else $ni += $g['qtd']; // Captura 'PREFIRO NÃO INFORMAR' ou outros
            }
            ?>
            <div style="text-align:center;">
                <span style="font-size:3.5rem; display:block;">🚺</span>
                <span style="color:#ff9eb5; font-weight:bold;">FEMININO</span>
                <div class="big-number"><?php echo $f; ?></div>
            </div>
            <div style="text-align:center;">
                <span style="font-size:3.5rem; display:block;">🚹</span>
                <span style="color:#9ec9ff; font-weight:bold;">MASCULINO</span>
                <div class="big-number"><?php echo $m; ?></div>
            </div>
            <div style="text-align:center;">
                <span style="font-size:3.5rem; display:block;">👤</span>
                <span style="color:#cccccc; font-weight:bold;">PREFERE NÃO INFORMAR</span>
                <div class="big-number"><?php echo $ni; ?></div>
            </div>
        </div>
    </div>

    <div class="card" style="text-align:center;">
        <div class="card-title">Inclusão e Social</div>
        <div style="display:flex; justify-content:space-around; margin-top:15px;">
            <div><span style="font-size:2rem;">♿</span><p>PCD</p><b><?php echo $pcd; ?></b></div>
            <div><span style="font-size:2rem;">💰</span><p>BOLSA</p><b><?php echo $bolsa; ?></b></div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⏰ Demanda por Turno</div>
        <table>
            <?php foreach($turnos as $t): ?>
            <tr><td><?php echo $t['turno_pretendido']; ?></td><td><?php echo $t['qtd']; ?></td></tr>
            <?php endforeach; ?>
        </table>
    </div>

    <div class="card" style="grid-column: span 2;">
        <div class="card-title">📚 Inscrições por Ano Escolar</div>
        <div class="scroll-box">
            <table>
                <?php foreach($anos_escolares as $ae): ?>
                <tr><td><?php echo $ae['ano_pretendido']; ?></td><td><?php echo $ae['qtd']; ?></td></tr>
                <?php endforeach; ?>
            </table>
        </div>
    </div>

    <div class="card">
        <div class="card-title">🎨 Perfil Étnico</div>
        <table>
            <?php foreach($etnias as $e): ?>
            <tr><td><?php echo $e['etnia']; ?></td><td><?php echo $e['qtd']; ?></td></tr>
            <?php endforeach; ?>
        </table>
    </div>

    <div class="card" style="grid-column: span 2;">
        <div class="card-title">📍 Top 10 Bairros com maior demanda</div>
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
        <div class="card-title">🏫 Escolas mais procuradas</div>
        <div class="scroll-box">
            <table>
                <?php foreach($locais as $esc): ?>
                    <tr>
                        <td><?php echo $esc['unidade_preferencia']; ?></td>
                        <td><span style="background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:5px;"><?php echo $esc['qtd']; ?></span></td>
                    </tr>
                <?php endforeach; ?>'
            </table>
        </div>
    </div>

</div>

<div id="modalLimpeza" class="no-print" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); z-index:10000; justify-content:center; align-items:center;">
    <div class="card" style="max-width:400px; text-align:center;">
        <h2 style="color:var(--error);">⚠️ ATENÇÃO</h2>
        <p>Você está prestes a apagar TODA a base de inscrições. Esta ação não pode ser desfeita.</p>
        <input type="password" id="senha_semed" placeholder="SENHA DE AUTORIZAÇÃO" style="width:100%; margin-top:15px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); padding:12px; border-radius:10px;">
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button onclick="confirmarExclusao()" style="background:var(--error); flex:1; border:none;">APAGAR TUDO</button>
            <button onclick="document.getElementById('modalLimpeza').style.display='none'" style="flex:1; background:rgba(255,255,255,0.1); border:none;">CANCELAR</button>
        </div>
    </div>
</div>

<script>
    // 1. Exportação para Excel (CSV)
    function exportarExcel() {
        let rows = [["Categoria", "Valor"]];
        rows.push(["Total Geral", "<?php echo $total; ?>"]);
        rows.push(["PCD", "<?php echo $pcd; ?>"]);
        rows.push(["Bolsa Familia", "<?php echo $bolsa; ?>"]);
        
        let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        let encodedUri = encodeURI(csvContent);
        let link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "relatorio_semed_2026.csv");
        document.body.appendChild(link);
        link.click();
    }

    // 2. Lógica de Limpeza de Banco
    function abrirModalLimpeza() {
        document.getElementById('modalLimpeza').style.display = 'flex';
        document.getElementById('senha_semed').value = "";
    }

    async function confirmarExclusao() {
        const senha = document.getElementById('senha_semed').value;
        if(senha !== "SEMED2026") { alert("SENHA INCORRETA!"); return; }
        
        if(!confirm("CONFIRMA A EXCLUSÃO TOTAL?")) return;

        const fd = new FormData();
        fd.append('senha', senha);

        const res = await fetch('limpar_dados.php', { method: 'POST', body: fd });
        const json = await res.json();
        
        if(json.status === "success") {
            alert("REGISTROS APAGADOS COM SUCESSO!");
            window.location.reload();
        } else {
            alert("ERRO: " + json.message);
        }
    }
</script>

</body>
</html>