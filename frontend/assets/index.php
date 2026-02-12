<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Rede Alunos - Queimados</title>
    <style>
        :root {
            --glass: rgba(255, 255, 255, 0.15);
            --blue: #1e3a8a;
            --error: #ff0000;
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

        body, html {
            margin: 0; padding: 0; width: 100%; height: 100%;
            overflow: hidden;
            font-family: 'Segoe UI', Roboto, sans-serif;
            background: url('fundo.png') no-repeat center center fixed;
            background-size: cover;
            display: flex; justify-content: center; align-items: center;
        }

        #progress-container {
            position: fixed; top: 0; left: 0; width: 100%; height: 6px;
            background: rgba(255,255,255,0.1); z-index: 1000;
        }
        #progress-bar {
            width: 0%; height: 100%; background: #2ecc71;
            transition: width 0.4s ease; box-shadow: 0 0 10px #2ecc71;
        }

        .glass-panel {
            background: var(--glass);
            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 25px;
            width: 90%; max-width: 450px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            color: white;
        }

        .step { display: none; }
        .step.active { display: block; animation: fadeIn 0.5s; }

        h2 { margin-top: 0; font-size: 1.4rem; text-transform: uppercase; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
        label { display: block; margin: 15px 0 5px; font-weight: bold; font-size: 0.9rem; }
        
        input, select, textarea {
            width: 100%; padding: 12px; border-radius: 10px; border: none;
            background: rgba(255,255,255,0.9); color: #333; font-size: 1rem;
            outline: none; transition: 0.3s;
        }
        input:disabled, select:disabled { background: rgba(255,255,255,0.3); color: #666; cursor: not-allowed; }

        .btn-avancar {
            width: 100%; padding: 15px; margin-top: 25px; border-radius: 12px;
            border: none; background: var(--blue); color: white;
            font-weight: bold; font-size: 1.1rem; cursor: pointer;
            transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .btn-avancar:disabled { background: #555; opacity: 0.6; }

        /* Alerta de Erro Piscante */
        @keyframes piscar { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .alerta-erro {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: red; color: white; padding: 25px; border-radius: 15px;
            z-index: 5000; font-weight: bold; text-align: center;
            animation: piscar 0.5s infinite; box-shadow: 0 0 30px rgba(0,0,0,0.5);
        }

        /* Modais */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(10px);
            display: flex; justify-content: center; align-items: center; z-index: 4000;
        }
        .modal-content { width: 85%; max-width: 380px; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>

<div id="progress-container"><div id="progress-bar"></div></div>

<form id="formPrincipal">
    <div class="glass-panel">
        
        <div class="step active" id="step1">
            <h2>Identificação</h2>
            <label>NOME COMPLETO:</label>
            <input type="text" name="nome_aluno" id="nome_aluno" required oninput="limparEntrada(this); ativarData(this)">
            
            <label>DATA DE NASCIMENTO:</label>
            <input type="date" name="data_nasc" id="data_nasc" disabled required onchange="ativarCPF(this)">
            
            <label>CPF DO ESTUDANTE:</label>
            <input type="text" name="cpf_aluno" id="cpf_aluno" maxlength="14" disabled placeholder="000.000.000-00" oninput="processarCPF(this)">
        </div>

        <div class="step" id="step2">
            <h2>Identificação Estudantil</h2>
            <label>SEXO:</label>
            <select name="sexo" id="sexo" required onchange="validarPasso2()">
                <option value="" disabled selected>SELECIONE...</option>
                <option value="FEMININO">FEMININO</option>
                <option value="MASCULINO">MASCULINO</option>
                <option value="NÃO RELACIONADO">NÃO RELACIONADO</option>
            </select>
            
            <label>COR / RAÇA (ETNIA):</label>
            <select name="etnia" id="etnia" required onchange="validarPasso2()">
                <option value="" disabled selected>SELECIONE...</option>
                <option value="BRANCA">BRANCA</option>
                <option value="PRETA">PRETA</option>
                <option value="PARDA">PARDA</option>
                <option value="AMARELA">AMARELA</option>
                <option value="INDÍGENA">INDÍGENA</option>
                <option value="PREFERE NÃO DECLARAR">PREFERE NÃO DECLARAR</option>
            </select>
            <input type="hidden" name="idade" id="idade_hidden">
            <button type="button" class="btn-avancar" id="btn2" disabled onclick="proximo(3)">AVANÇAR</button>
        </div>

        <div class="step" id="step3">
            <h2>Informações Sociais</h2>
            <label>É PESSOA COM DEFICIÊNCIA (PCD)?</label>
            <select name="pcd" id="pcd" onchange="verificarPCD(this.value)">
                <option value="NÃO">NÃO</option>
                <option value="SIM">SIM</option>
            </select>
            <input type="hidden" name="pcd_descricao" id="pcd_desc_hidden">

            <label>BENEFICIÁRIO DO BOLSA FAMÍLIA?</label>
            <select name="bolsa_familia">
                <option value="NÃO">NÃO</option>
                <option value="SIM">SIM</option>
            </select>
            <button type="button" class="btn-avancar" onclick="proximo(4)">AVANÇAR</button>
        </div>

        <div class="step" id="step4">
            <h2>Situação Escolar</h2>
            <label>ESTÁ ATUALMENTE MATRICULADO?</label>
            <select name="matriculado_atualmente" id="matriculado" required onchange="fluxoMatricula(this.value)">
                <option value="" disabled selected>SELECIONE...</option>
                <option value="NÃO">NÃO</option>
                <option value="SIM">SIM</option>
            </select>
            
            <label>MOTIVO DA SOLICITAÇÃO:</label>
            <select name="motivo_matricula" id="motivo_matricula" disabled required>
                <option value="" disabled selected>AGUARDANDO...</option>
                <option value="POR NÃO ESTAR MATRICULADO NO MOMENTO" id="opt_a">POR NÃO ESTAR MATRICULADO NO MOMENTO</option>
                <option value="BUSCA POR ESCOLA MAIS PRÓXIMA">BUSCA POR ESCOLA MAIS PRÓXIMA</option>
                <option value="MUDANÇA DE ENDEREÇO">MUDANÇA DE ENDEREÇO</option>
                <option value="ORGANIZAÇÃO FAMILIAR">ORGANIZAÇÃO FAMILIAR</option>
                <option value="OUTRO MOTIVO">OUTRO MOTIVO</option>
            </select>
            <input type="hidden" name="tempo_fora_escola" id="tempo_fora_hidden">
            <input type="hidden" name="rede_origem" id="rede_origem_hidden">
            <button type="button" class="btn-avancar" id="btn4" disabled onclick="proximo(5)">AVANÇAR</button>
        </div>

        <div class="step" id="step5">
            <h2>Modalidade Pretendida</h2>
            <div id="area_modalidade"></div>
            <p id="nota_eja" style="display:none; font-size:0.7rem; margin-top:10px;">* Opcional conforme Resolução CNE/CEB nº03/2010.</p>
            <button type="button" class="btn-avancar" onclick="proximo(6)">AVANÇAR</button>
        </div>

        <div class="step" id="step6">
            <h2>Preferência</h2>
            <label>UNIDADE DE PREFERÊNCIA:</label>
            <select name="unidade_preferencia" id="unidade_pref" required></select>
            
            <label>TURNO:</label>
            <select name="turno_pretendido" required>
                <option value="MANHÃ">MANHÃ</option>
                <option value="TARDE">TARDE</option>
                <option value="NOITE">NOITE</option>
                <option value="INTEGRAL">INTEGRAL</option>
                <option value="INDIFERENTE">INDIFERENTE</option>
            </select>
            <button type="button" class="btn-avancar" onclick="proximo(7)">AVANÇAR</button>
        </div>

        <div class="step" id="step7">
            <h2>Endereço</h2>
            <label>INFORME O CEP:</label>
            <input type="text" name="cep" id="cep" maxlength="9" placeholder="00000-000" oninput="processarCEP(this)">
            <p style="font-size:0.8rem; opacity:0.8;">Aguarde a localização automática...</p>
        </div>

        <div class="step" id="step8">
            <h2>Responsável Legal</h2>
            <label>NOME COMPLETO:</label>
            <input type="text" name="nome_responsavel" required oninput="limparEntrada(this)">
            <label>CPF:</label>
            <input type="text" name="cpf_responsavel" maxlength="14" oninput="maskCPF(this); validarCPFResp(this)" required>
            <label>PARENTESCO:</label>
            <select name="parentesco">
                <option value="MÃE">MÃE</option>
                <option value="PAI">PAI</option>
                <option value="OUTRO">OUTRO</option>
            </select>
            <button type="button" class="btn-avancar" onclick="proximo(9)">AVANÇAR</button>
        </div>

        <div class="step" id="step9">
            <h2>Contatos</h2>
            <label>TELEFONE PRINCIPAL:</label>
            <input type="text" name="telefone" maxlength="15" oninput="maskTel(this)" required>
            <label>TELEFONE SECUNDÁRIO:</label>
            <input type="text" name="telefone_secundario" maxlength="15" oninput="maskTel(this)">
            <label>E-MAIL (OPCIONAL):</label>
            <input type="email" name="email" style="text-transform:lowercase;">
            <button type="button" class="btn-avancar" onclick="proximo(10)">AVANÇAR</button>
        </div>

        <div class="step" id="step10">
            <h2>Relato</h2>
            <label>DIFICULDADE ENFRENTADA (OPCIONAL):</label>
            <textarea name="dificuldade_descricao" rows="4" oninput="limparEntrada(this)"></textarea>
            <button type="button" class="btn-avancar" onclick="proximo(11)">AVANÇAR</button>
        </div>

        <div class="step" id="step11">
            <h2>Declaração e Consentimento</h2>
            <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:10px; font-size:0.85rem; height:200px; overflow-y:auto; text-align:justify;">
                <b>DECLARAÇÃO E CONSENTIMENTO - LGPD</b><br><br>
                Declaro que as informações prestadas são verdadeiras e autorizo a Secretaria Municipal de Educação de Queimados a utilizar os dados exclusivamente para fins de:
                <ul>
                    <li>Planejamento e organização da oferta de vagas;</li>
                    <li>Estudos técnicos de demanda escolar;</li>
                    <li>Formulação de políticas públicas educacionais;</li>
                </ul>
                Nos termos da Lei Federal Nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD).
            </div>
            <div style="margin-top:15px; display:flex; align-items:center; gap:10px;">
                <input type="checkbox" id="concordo" style="width:25px; height:25px;" onchange="document.getElementById('btn_final').disabled = !this.checked">
                <label for="concordo" style="margin:0">CONCORDO</label>
            </div>
            <button type="button" id="btn_final" class="btn-avancar" style="background:#2ecc71" disabled onclick="enviarFormulario()">ENVIAR INSCRIÇÃO</button>
        </div>

    </div>
</form>

<div id="modalPCD" class="modal-overlay" style="display:none;">
    <div class="glass-panel modal-content">
        <h3>QUAL A DEFICIÊNCIA?</h3>
        <input type="text" id="pcd_temp" placeholder="DESCREVA..." oninput="limparEntrada(this)">
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn-avancar" style="background:#e74c3c; margin:0" onclick="fecharModalPCD(false)">CANCELA</button>
            <button class="btn-avancar" style="background:#2ecc71; margin:0" onclick="fecharModalPCD(true)">CONFIRMA</button>
        </div>
    </div>
</div>

<div id="modalEndereco" class="modal-overlay" style="display:none;">
    <div class="glass-panel modal-content">
        <h3>ENDEREÇO ENCONTRADO</h3>
        <label>RUA:</label><input type="text" id="rua" readonly>
        <label>BAIRRO:</label><input type="text" id="bairro" readonly>
        <label>Nº:</label><input type="text" id="num" oninput="limparEntrada(this)">
        <label>COMPL.:</label><input type="text" id="compl" oninput="limparEntrada(this)">
        <button class="btn-avancar" onclick="finalizarEnd()">CONFIRMAR</button>
    </div>
</div>

<script>
    let tentativas = 0;
    const escolas = ["CRECHE M. CLOTILDES LEMOS", "CRECHE M. IRACEMA GARCIA", "E.M. ALLAN KARDEC", "E.M. PAULO FREIRE", "E.M. TIRADENTES"]; // Adicione a lista completa aqui

    function limparEntrada(el) {
        if(el.type !== 'email') el.value = el.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/^\s+/, '');
    }

    function ativarData(el) { if(el.value.length > 3) document.getElementById('data_nasc').disabled = false; }
    function ativarCPF(el) { if(el.value !== "") document.getElementById('cpf_aluno').disabled = false; }

    async function processarCPF(el) {
        maskCPF(el);
        let v = el.value.replace(/\D/g, '');
        if(v.length === 11) {
            if(!validarCPF(v)) {
                tentativas++;
                mostrarErro("NÚMERO INFORMADO NÃO É VÁLIDO");
                el.value = "";
                if(tentativas >= 4) window.location.href = "about:blank";
                return;
            }
            const res = await fetch('check_cpf.php?cpf=' + v);
            const data = await res.json();
            if(data.exists) {
                mostrarErro("ESTE CPF JÁ ESTÁ CADASTRADO");
                el.value = "";
            } else {
                calcularIdadeAutomatico();
                proximo(2);
            }
        }
    }

    function calcularIdadeAutomatico() {
        const nasc = new Date(document.getElementById('data_nasc').value);
        const hoje = new Date();
        let idade = hoje.getFullYear() - nasc.getFullYear();
        if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--;
        document.getElementById('idade_hidden').value = idade;
        
        // Lógica de Modalidade para 31/03/2026
        const corte = new Date('2026-03-31');
        let mesesTotal = (corte.getFullYear() - nasc.getFullYear()) * 12 + (corte.getMonth() - nasc.getMonth());
        if(corte.getDate() < nasc.getDate()) mesesTotal--;
        const anosC = Math.floor(mesesTotal / 12);

        let mod = "";
        if(mesesTotal >= 4 && mesesTotal <= 11) mod = "CRECHE I";
        else if(anosC === 1) mod = "CRECHE II";
        else if(anosC === 2) mod = "CRECHE III";
        else if(anosC === 3) mod = "CRECHE IV";
        else if(anosC === 4) mod = "PRÉ I";
        else if(anosC === 5) mod = "PRÉ II";
        else if(anosC === 6) mod = "1º ANO";
        
        const area = document.getElementById('area_modalidade');
        if(mod !== "") {
            area.innerHTML = `<label>MODALIDADE AUTOMÁTICA:</label><div style="background:rgba(255,255,255,0.2);padding:15px;border-radius:10px;text-align:center;font-weight:bold">${mod}</div><input type="hidden" name="ano_pretendido" value="${mod}">`;
        } else {
            // Lógica para seletores de 7 a 18+ anos (Regular/EJA)
            let ops = anosC < 15 ? ["2º ANO","3º ANO","4º ANO","5º ANO","6º ANO","7º ANO","8º ANO","9º ANO"] : ["EJA I","EJA II","EJA III"];
            area.innerHTML = `<label>SELECIONE O ANO:</label><select name="ano_pretendido">${ops.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
        }
    }

    function proximo(n) {
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        document.getElementById('step' + n).classList.add('active');
        document.getElementById('progress-bar').style.width = ((n/11)*100) + '%';
    }

    function mostrarErro(msg) {
        const div = document.createElement('div');
        div.className = 'alerta-erro';
        div.innerText = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // Máscaras e Validações Genéricas
    function maskCPF(i){ i.value=i.value.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2") }
    function maskTel(i){ i.value=i.value.replace(/\D/g,"").replace(/^(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2") }
    
    function validarCPF(c){
        if(!c || c.length!=11 || /^(\d)\1+$/.test(c)) return false;
        let s = 0, r;
        for(let i=1;i<=9;i++) s += parseInt(c[i-1])*(11-i);
        r = (s*10)%11; if(r==10||r==11) r=0; if(r!=parseInt(c[9])) return false;
        s=0; for(let i=1;i<=10;i++) s += parseInt(c[i-1])*(12-i);
        r = (s*10)%11; if(r==10||r==11) r=0; return r==parseInt(c[10]);
    }

    // Populando Escolas
    const selE = document.getElementById('unidade_pref');
    escolas.forEach(e => { let o = document.createElement('option'); o.value=e; o.text=e; selE.add(o); });

    async function processarCEP(el) {
        let v = el.value.replace(/\D/g,'');
        if(v.length===8) {
            const r = await fetch(`https://viacep.com.br/ws/${v}/json/`);
            const d = await r.json();
            if(!d.erro) {
                document.getElementById('rua').value = d.logradouro.toUpperCase();
                document.getElementById('bairro').value = d.bairro.toUpperCase();
                document.getElementById('modalEndereco').style.display = 'flex';
            }
        }
    }

    async function enviarFormulario() {
        const f = document.getElementById('formPrincipal');
        const d = new FormData(f);
        const r = await fetch('salvar.php', { method:'POST', body:d });
        if(r.ok) window.location.href = 'sucesso.php';
        else mostrarErro("ERRO AO SALVAR");
    }
</script>
</body>
</html>