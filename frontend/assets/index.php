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
            background: url('fundo.png?v=2') no-repeat center center fixed;
            background-size: 1200px;
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

        #modalSucesso {
            display: none; /* Escondido por padrão */
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }

        .sucesso-content {
            text-align: center;
            padding: 40px;
            max-width: 400px;
            width: 85%;
        }

        .icone-sucesso {
            font-size: 4rem;
            color: #2ecc71;
            margin-bottom: 20px;
            display: block;
        }

        .btn-finalizar {
            background: #2ecc71 !important;
            margin-top: 30px !important;
        }        

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
                <select name="unidade_preferencia" id="unidade_pref" required onchange="validarPasso6()">
                    <option value="" disabled selected>SELECIONE A UNIDADE...</option>
                </select>
                    
                <label>TURNO:</label>
                <select name="turno_pretendido" required onchange="validarPasso6()">
                    <option value="" disabled selected>SELECIONE O TURNO...</option>
                    <option value="MANHÃ">MANHÃ</option>
                    <option value="TARDE">TARDE</option>
                    <option value="NOITE">NOITE</option>
                    <option value="INTEGRAL">INTEGRAL</option>
                    <option value="INDIFERENTE">INDIFERENTE</option>
                </select>
                <button type="button" class="btn-avancar" id="btn6" disabled onclick="proximo(8)">AVANÇAR</button>
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

    <script>
let tentativas = 0;
    const escolas = [
        "CRECHE MUNICIPAL CLOTILDES MARTINS LEMOS", "CRECHE MUNICIPAL IRACEMA GARCIA", "CRECHE MUNICIPAL PROFESSORA VANDA GONCALVES",
        "CRECHE MUNICIPAL GIL DO GLORIA", "E.M. ALLAN KARDEC", "E.M. CARLOS PEREIRA NETO", "E.M. DR. CLEDON CAVALCANTE",
        "E.M. DR FRANCISCO MANOEL BRANDAO", "E.M. ELOI DIAS TEIXEIRA", "E.M. JOSE ANASTÁCIO RODRIGUES",
        "E.M. JOSE BITTENCOURT DE OLIVEIRA", "E.M. JOSE DE ANCHIETA", "E.M. LUIZ DE CAMOES", "E.M. METODISTA",
        "E.M. MONTEIRO LOBATO", "E.M. OSCAR WEINSCHENCK", "E.M. PAULO FREIRE", "E.M. PASTOR ARSENIO",
        "E.M. PROF. ALBERTO PIRRO", "E.M. PROF GILVANEI PEREIRA DA FONSECA", "E.M. JOAQUIM DE FREITAS",
        "E.M. LEOPOLDO MACHADO", "E.M. PROF. SEBASTIÃO VERISSIMO", "E.M. PROF. UBIRAJARA FERREIRA",
        "E.M. WASHINGTON MANOEL DE SOUSA", "E.M. ANNA MARIA PEROBELLI", "E.M. DIVA TEIXEIRA MARTINS",
        "E.M. MARIA CORÁGIO PEREIRA XANCHAO", "E.M. SCINTILLA EXEL", "E.M. PROF. VALCIRA SANTANA",
        "E.M. SANTO EXPEDITO", "E.M. SAO JOSÉ", "E.M. SENADOR NELSON CARNEIRO", "E.M. TIRADENTES",
        "E.M. WALDICK CUNEGUNDES PEREIRA"
    ];

    // --- 1. FUNÇÕES DE UTILIDADE (LIMPEZA E MÁSCARAS) ---
    function limparEntrada(el) {
        if(el.type !== 'email') {
            el.value = el.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/^\s+/, '');
        }
    }

    function maskCPF(i){ i.value=i.value.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2") }
    function maskTel(i){ i.value=i.value.replace(/\D/g,"").replace(/^(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2") }

    function ativarData(el) { if(el.value.length > 3) document.getElementById('data_nasc').disabled = false; }
    function ativarCPF(el) { if(el.value !== "") document.getElementById('cpf_aluno').disabled = false; }

    // --- 2. NAVEGAÇÃO ---
    function proximo(n) {
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        document.getElementById('step' + n).classList.add('active');
        document.getElementById('progress-bar').style.width = ((n / 11) * 100) + '%';
        window.scrollTo(0,0);
    }

    // --- 3. VALIDAÇÕES ESPECÍFICAS ---
    async function processarCPF(el) {
        maskCPF(el);
        let v = el.value.replace(/\D/g, '');
        if(v.length === 11) {
            const res = await fetch('check_cpf.php?cpf=' + v);
            const data = await res.json();
            if(data.exists) {
                alert("ESTE CPF JÁ ESTÁ CADASTRADO!");
                el.value = "";
            } else {
                calcularIdadeAutomatico();
                proximo(2);
            }
        }
    }

    function validarPasso2() {
        const sexo = document.getElementById('sexo').value;
        const etnia = document.getElementById('etnia').value;
        document.getElementById('btn2').disabled = (sexo === "" || etnia === "");
    }

    function verificarPCD(v) {
        if (v === 'SIM') document.getElementById('modalPCD').style.display = 'flex';
    }

    function fecharModalPCD(confirmar) {
        if (confirmar) document.getElementById('pcd_desc_hidden').value = document.getElementById('pcd_temp').value;
        document.getElementById('modalPCD').style.display = 'none';
    }

    function fluxoMatricula(v) {
        const motivo = document.getElementById('motivo_matricula');
        motivo.disabled = false;
        document.getElementById('btn4').disabled = false;
    }

    // --- 4. CÁLCULO DE IDADE E ENDEREÇO ---
    function calcularIdadeAutomatico() {
        const nasc = new Date(document.getElementById('data_nasc').value);
        const hoje = new Date();
        let idade = hoje.getFullYear() - nasc.getFullYear();
        document.getElementById('idade_hidden').value = idade;
        
        const area = document.getElementById('area_modalidade');
        // Simplificado para teste, você pode usar a lógica completa de Creche/EJA aqui
        area.innerHTML = `<label>ANO ESCOLAR:</label><select name="ano_pretendido" required><option value="1º ANO">1º ANO</option><option value="2º ANO">2º ANO</option></select>`;
    }

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

    function finalizarEnd() {
        // Captura o valor do campo número
        const numero = document.getElementById('num').value.trim();

        // Validação: Não permite avançar sem o número (obrigatório no banco)
        if (numero === '') {
            alert('Por favor, informe o NÚMERO da residência antes de confirmar.');
            document.getElementById('num').focus();
            return; // Interrompe a função aqui
        }

        // Se estiver tudo ok, fecha o modal e avança para o Passo 8
        document.getElementById('modalEndereco').style.display = 'none';
        proximo(8);
    }

    // --- 5. ENVIO ---
    async function enviarFormulario() {
        const btn = document.getElementById('btn_final');
        btn.disabled = true;
        btn.innerText = "GRAVANDO...";
        const formData = new FormData(document.getElementById('formPrincipal'));
        const response = await fetch('salvar.php', { method: 'POST', body: formData });
        const result = await response.json();
        if(result.status === "success") {
            document.getElementById('modalSucesso').style.display = 'flex';
        }
    }

    // Popular Escolas ao carregar
    const selE = document.getElementById('unidade_pref');
    escolas.forEach(e => { let o = document.createElement('option'); o.value=e; o.text=e; selE.add(o); });
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
            const dataNascInput = document.getElementById('data_nasc').value;
            if (!dataNascInput) return;

            const nasc = new Date(dataNascInput);
            const corte = new Date('2026-03-31');
            
            // Cálculo exato de meses e anos na data de corte
            let mesesTotal = (corte.getFullYear() - nasc.getFullYear()) * 12 + (corte.getMonth() - nasc.getMonth());
            if (corte.getDate() < nasc.getDate()) mesesTotal--;
            
            const anosCompletos = Math.floor(mesesTotal / 12);
            document.getElementById('idade_hidden').value = anosCompletos;

            const area = document.getElementById('area_modalidade');
            const notaEja = document.getElementById('nota_eja');
            let mod = "";
            let selectHTML = "";

            // 1. REGRAS AUTOMÁTICAS (Creche ao 1º Ano)
            if (mesesTotal >= 4 && mesesTotal <= 11) mod = "CRECHE I";
            else if (anosCompletos === 1) mod = "CRECHE II";
            else if (anosCompletos === 2) mod = "CRECHE III";
            else if (anosCompletos === 3) mod = "CRECHE IV";
            else if (anosCompletos === 4) mod = "PRÉ I";
            else if (anosCompletos === 5) mod = "PRÉ II";
            else if (anosCompletos === 6) mod = "1º ANO";

            if (mod !== "") {
                // Exibe apenas o texto, sem opção de escolha (automático)
                area.innerHTML = `
                    <p>De acordo com a idade do estudante a Modalidade será:</p>
                    <div style="background:rgba(255,255,255,0.2); padding:15px; border-radius:10px; text-align:center; font-weight:bold; font-size:1.2rem;">
                        ${mod}
                    </div>
                    <input type="hidden" name="ano_pretendido" value="${mod}">`;
                notaEja.style.display = 'none';
            } 
            // 2. REGRAS DE SELEÇÃO (7 a 14 anos - Regular)
            else if (anosCompletos >= 7 && anosCompletos <= 14) {
                const anos = ["2º ANO", "3º ANO", "4º ANO", "5º ANO", "6º ANO", "7º ANO", "8º ANO", "9º ANO"];
                selectHTML = gerarSelect(anos);
                area.innerHTML = `<label>SELECIONE O ANO ESCOLAR:</label>${selectHTML}`;
                notaEja.style.display = 'none';
            }
            // 3. REGRAS MISTAS (15 a 17 anos - Regular ou EJA opcional)
            else if (anosCompletos >= 15 && anosCompletos <= 17) {
                const mix = ["2º ANO", "3º ANO", "4º ANO", "5º ANO", "6º ANO", "7º ANO", "8º ANO", "9º ANO", 
                            "EJA I", "EJA II", "EJA III", "EJA IV", "EJA V", "EJA VI", "EJA VII", "EJA VIII", "EJA IX"];
                selectHTML = gerarSelect(mix);
                area.innerHTML = `<label>SELECIONE O ANO OU MODALIDADE EJA:</label>${selectHTML}`;
                notaEja.style.display = 'block'; // Mostra a nota legal da EJA
            }
            // 4. REGRAS EJA (18 anos ou mais)
            else if (anosCompletos >= 18) {
                const ejas = ["EJA I", "EJA II", "EJA III", "EJA IV", "EJA V", "EJA VI", "EJA VII", "EJA VIII", "EJA IX"];
                selectHTML = gerarSelect(ejas);
                area.innerHTML = `<label>SELECIONE A MODALIDADE EJA:</label>${selectHTML}`;
                notaEja.style.display = 'none';
            }
        }

        function gerarSelect(opcoes) {
            return `<select name="ano_pretendido" required>
                        <option value="" disabled selected>ESCOLHA UMA OPÇÃO...</option>
                        ${opcoes.map(o => `<option value="${o}">${o}</option>`).join('')}
                    </select>`;
        }

        function proximo(n) {
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
            document.getElementById('step' + n).classList.add('active');
            document.getElementById('progress-bar').style.width = ((n/11)*100) + '%';
        }

        function validarPasso2() {
            const sexo = document.getElementById('sexo').value;
            const etnia = document.getElementById('etnia').value;
            const btn = document.getElementById('btn2');

            // Se ambos os campos estiverem preenchidos, libera o botão
            if (sexo !== "" && etnia !== "") {
                btn.disabled = false;
            } else {
                btn.disabled = true;
            }
        }

        function validarPasso4() {
            const mat = document.getElementById('matriculado').value;
            const mot = document.getElementById('motivo_matricula').value;
            const btn = document.getElementById('btn4');
            btn.disabled = (mat === "" || mot === "");
        }

        // Libera Passo 6 (Escola e Turno)
        function validarPasso6() {
            const esc = document.getElementById('unidade_pref').value;
            const tur = document.querySelector('select[name="turno_pretendido"]').value;
            const btn = document.getElementById('btn6'); // Verifique se o ID no HTML é btn6
            btn.disabled = (esc === "" || tur === "");
        }

        function verificarPCD(v) {
            if (v === 'SIM') {
                document.getElementById('modalPCD').style.display = 'flex';
            } else {
                document.getElementById('pcd_desc_hidden').value = "";
            }
        }

        function fecharModalPCD(confirmar) {
            if (confirmar) {
                document.getElementById('pcd_desc_hidden').value = document.getElementById('pcd_temp').value;
            } else {
                document.getElementById('pcd').value = 'NÃO';
            }
            document.getElementById('modalPCD').style.display = 'none';
        }

        // Lógica de Situação Escolar (Passo 4)
        function fluxoMatricula(v) {
            const motivo = document.getElementById('motivo_matricula');
            motivo.disabled = false;
            motivo.innerHTML = '<option value="" disabled selected>SELECIONE...</option>';
                
            const opcoesComuns = `
                <option value="BUSCA POR ESCOLA MAIS PRÓXIMA">BUSCA POR ESCOLA MAIS PRÓXIMA</option>
                <option value="MUDANÇA DE ENDEREÇO">MUDANÇA DE ENDEREÇO</option>
                <option value="ORGANIZAÇÃO FAMILIAR">ORGANIZAÇÃO FAMILIAR</option>
                <option value="OUTRO MOTIVO">OUTRO MOTIVO</option>`;

            if (v === 'NÃO') {
                motivo.innerHTML += `<option value="POR NÃO ESTAR MATRICULADO NO MOMENTO">POR NÃO ESTAR MATRICULADO NO MOMENTO</option>` + opcoesComuns;
            } else {
                motivo.innerHTML += opcoesComuns;
            }
                
            motivo.onchange = () => { document.getElementById('btn4').disabled = false; };
        }

        // Finalizar Endereço
        function finalizarEnd() {
            const n = document.getElementById('num').value;
            if (n === "") { mostrarErro("O NÚMERO É OBRIGATÓRIO"); return; }
            document.getElementById('modalEndereco').style.display = 'none';
            proximo(8);
        }

        // Validar CPF do Responsável (Permite duplicados, mas valida formato)
        function validarCPFResp(el) {
            maskCPF(el);
            let v = el.value.replace(/\D/g, '');
            if (v.length === 11 && !validarCPF(v)) {
                mostrarErro("CPF DO RESPONSÁVEL INVÁLIDO");
                el.value = "";
            }
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

        if (!document.getElementById('unidade_pref').options.length) {
            const selE = document.getElementById('unidade_pref');
            escolas.forEach(e => {
                let o = document.createElement('option');
                o.value = e;
                o.text = e;
                selE.add(o);
            });
        }

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
    </script>

        <div id="modalSucesso">

            <div class="glass-panel sucesso-content">
                <span class="icone-sucesso">✓</span>
                <h2 style="border:none;">SUCESSO!</h2>
                <p>Sua inscrição foi recebida e gravada com sucesso em nossa base de dados.</p>
                <p style="font-size: 0.85rem; opacity: 0.8;">A Secretaria de Educação agradece sua colaboração.</p>
                    
                <button type="button" class="btn-avancar btn-finalizar" onclick="window.location.reload()">
                    REALIZAR NOVA INSCRIÇÃO
                </button>
            </div>
        </div>
</body>
</html>