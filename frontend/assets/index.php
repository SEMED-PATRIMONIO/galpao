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
            --success: #2ecc71;
            --error: #e74c3c;
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

        body, html {
            margin: 0; padding: 0; width: 100%; height: 100%;
            overflow: hidden;
            font-family: 'Segoe UI', Roboto, sans-serif;
            /* Fundo ajustado para não estourar */
            background: #0f172a url('fundo.png?v=3') no-repeat center center fixed;
            background-size: 1200px;
            display: flex; justify-content: center; align-items: center;
        }

        #progress-container {
            position: fixed; top: 0; left: 0; width: 100%; height: 6px;
            background: rgba(255,255,255,0.1); z-index: 1000;
        }
        #progress-bar {
            width: 0%; height: 100%; background: var(--success);
            transition: width 0.4s ease; box-shadow: 0 0 10px var(--success);
        }

        .glass-panel {
            background: var(--glass);
            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 25px;
            width: 95%; max-width: 450px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            color: white;
            max-height: 90vh; overflow-y: auto;
        }

        .step { display: none; }
        .step.active { display: block; animation: fadeIn 0.5s; }

        h2 { margin-top: 0; font-size: 1.3rem; text-transform: uppercase; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
        label { display: block; margin: 15px 0 5px; font-weight: bold; font-size: 0.85rem; }
        
        input, select, textarea {
            width: 100%; padding: 12px; border-radius: 10px; border: none;
            background: rgba(255,255,255,0.95); color: #333; font-size: 1rem;
            outline: none; transition: 0.3s;
        }
        input:focus { background: #fff; box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.3); }
        input:disabled, select:disabled { background: rgba(255,255,255,0.3); color: #666; cursor: not-allowed; }

        .btn-avancar {
            width: 100%; padding: 15px; margin-top: 25px; border-radius: 12px;
            border: none; background: var(--blue); color: white;
            font-weight: bold; font-size: 1.1rem; cursor: pointer;
            transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .btn-avancar:hover { transform: translateY(-2px); filter: brightness(1.2); }
        .btn-avancar:disabled { background: #555; opacity: 0.6; transform: none; }

        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center; z-index: 5000;
        }

        .alerta-erro {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: var(--error); color: white; padding: 15px 25px; border-radius: 10px;
            z-index: 9999; font-weight: bold; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: fadeIn 0.3s;
        }
        .alerta-vidro {
            position: fixed; top: 50%; left: 50%; 
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 40px; border-radius: 30px; color: white;
            text-align: center; z-index: 10000;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            width: 85%; max-width: 350px;
            animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomIn { 
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); } 
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); } 
        }
    </style>
</head>
<body>

    <div id="progress-container"><div id="progress-bar"></div></div>

    <form id="formPrincipal">
        <div class="glass-panel">
            
            <div class="step active" id="step1">
                <h2>Identificação</h2>
                <label>NOME COMPLETO DO ESTUDANTE:</label>
                <input type="text" name="nome_aluno" id="nome_aluno" required oninput="limparEntrada(this); ativarData(this)">
                    
                <label>DATA DE NASCIMENTO:</label>
                <input type="date" name="data_nasc" id="data_nasc" disabled required onchange="ativarCPF(this)">
                    
                <label>CPF DO ESTUDANTE:</label>
                <input type="text" name="cpf_aluno" id="cpf_aluno" maxlength="14" disabled placeholder="000.000.000-00" oninput="processarCPF(this)">
                <p style="font-size:0.7rem; opacity:0.8; margin-top:5px;">* O CPF é obrigatório para validação da vaga.</p>
            </div>

            <div class="step" id="step2">
                <h2>Perfil do Estudante</h2>
                <label>SEXO:</label>
                <select name="sexo" id="sexo" required onchange="validarPasso2()">
                    <option value="" disabled selected>SELECIONE...</option>
                    <option value="FEMININO">FEMININO</option>
                    <option value="MASCULINO">MASCULINO</option>
                    <option value="OUTRO">OUTRO/NÃO DECLARADO</option>
                </select>
                    
                <label>COR / RAÇA (ETNIA):</label>
                <select name="etnia" id="etnia" required onchange="validarPasso2()">
                    <option value="" disabled selected>SELECIONE...</option>
                    <option value="BRANCA">BRANCA</option>
                    <option value="PRETA">PRETA</option>
                    <option value="PARDA">PARDA</option>
                    <option value="AMARELA">AMARELA</option>
                    <option value="INDÍGENA">INDÍGENA</option>
                    <option value="NÃO DECLARADA">PREFERE NÃO DECLARAR</option>
                </select>
                <input type="hidden" name="idade" id="idade_hidden">
                <button type="button" class="btn-avancar" id="btn2" disabled onclick="proximo(3)">AVANÇAR</button>
            </div>

            <div class="step" id="step3">
                <h2>Informações Sociais</h2>
                <label>POSSUI DEFICIÊNCIA (PCD)?</label>
                <select name="pcd" id="pcd" onchange="verificarPCD(this.value)">
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM</option>
                </select>
                <input type="hidden" name="pcd_descricao" id="pcd_desc_hidden">

                <label>RECEBE BOLSA FAMÍLIA?</label>
                <select name="bolsa_familia">
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM</option>
                </select>
                <button type="button" class="btn-avancar" onclick="proximo(4)">AVANÇAR</button>
            </div>

            <div class="step" id="step4">
                <h2>Situação Escolar</h2>
                <label>ESTÁ MATRICULADO ATUALMENTE?</label>
                <select name="matriculado_atualmente" id="matriculado" required onchange="fluxoMatricula(this.value)">
                    <option value="" disabled selected>SELECIONE...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM</option>
                </select>
                    
                <label>MOTIVO DA SOLICITAÇÃO:</label>
                <select name="motivo_matricula" id="motivo_matricula" disabled required>
                    <option value="" disabled selected>AGUARDANDO...</option>
                </select>
                <input type="hidden" name="tempo_fora_escola" id="tempo_fora_hidden">
                <input type="hidden" name="rede_origem" id="rede_origem_hidden">
                <button type="button" class="btn-avancar" id="btn4" disabled onclick="proximo(5)">AVANÇAR</button>
            </div>

            <div class="step" id="step5">
                <h2>Modalidade Pretendida</h2>
                <div id="area_modalidade" style="margin: 20px 0;"></div>
                <p id="nota_eja" style="display:none; font-size:0.75rem; color:#ffd700;">* Opção de EJA disponível para maiores de 15 anos.</p>
                <button type="button" class="btn-avancar" onclick="proximo(6)">CONFIRMAR MODALIDADE</button>
            </div>

            <div class="step" id="step6">
                <h2>Unidade e Turno</h2>
                <label>UNIDADE DE PREFERÊNCIA:</label>
                <select name="unidade_preferencia" id="unidade_pref" required onchange="validarPasso6()">
                    <option value="" disabled selected>CARREGANDO ESCOLAS...</option>
                </select>
                    
                <label>TURNO PRETENDIDO:</label>
                <select name="turno_pretendido" id="turno_pretendido" required onchange="validarPasso6()">
                    <option value="" disabled selected>SELECIONE...</option>
                    <option value="MANHÃ">MANHÃ</option>
                    <option value="TARDE">TARDE</option>
                    <option value="NOITE">NOITE</option>
                    <option value="INTEGRAL">INTEGRAL</option>
                    <option value="INDIFERENTE">INDIFERENTE</option>
                </select>
                <button type="button" class="btn-avancar" id="btn6" disabled onclick="proximo(7)">AVANÇAR</button>
            </div>
            <div class="step" id="step7">
                <h2>Localização</h2>
                <label>INFORME O CEP:</label>
                <input type="text" id="cep" maxlength="9" placeholder="00000-000" oninput="maskCEP(this); processarCEP(this)">
                <p style="font-size:0.8rem; opacity:0.8; margin-top:10px;">Aguarde a localização automática...</p>
                <button type="button" class="btn-avancar" style="background:rgba(255,255,255,0.1);" onclick="proximo(8)">PULAR ENDEREÇO</button>
            </div>

            <div class="step" id="step8">
                <h2>Responsável Legal</h2>
                <label>NOME COMPLETO DO RESPONSÁVEL:</label>
                <input type="text" name="nome_responsavel" required oninput="limparEntrada(this)">
                
                <label>CPF DO RESPONSÁVEL:</label>
                <input type="text" name="cpf_responsavel" maxlength="14" oninput="maskCPF(this); validarCPFResp(this)" required>
                
                <label>PARENTESCO:</label>
                <select name="parentesco">
                    <option value="MÃE">MÃE</option>
                    <option value="PAI">PAI</option>
                    <option value="AVÓ/AVÔ">AVÓ/AVÔ</option>
                    <option value="OUTRO">OUTRO / TUTOR</option>
                </select>
                <button type="button" class="btn-avancar" onclick="proximo(9)">AVANÇAR</button>
            </div>

            <div class="step" id="step9">
                <h2>Canais de Contato</h2>
                <label>TELEFONE PRINCIPAL (WhatsApp):</label>
                <input type="text" name="telefone" maxlength="15" oninput="maskTel(this)" required>
                
                <label>TELEFONE SECUNDÁRIO:</label>
                <input type="text" name="telefone_secundario" maxlength="15" oninput="maskTel(this)">
                
                <label>E-MAIL (OPCIONAL):</label>
                <input type="email" name="email" style="text-transform:lowercase;">
                <button type="button" class="btn-avancar" onclick="proximo(10)">AVANÇAR</button>
            </div>

            <div class="step" id="step10">
                <h2>Relato Adicional</h2>
                <label>DIFICULDADE ENFRENTADA OU OBSERVAÇÃO:</label>
                <textarea name="dificuldade_descricao" rows="4" placeholder="Ex: Dificuldade de acesso, transporte, etc." oninput="limparEntrada(this)"></textarea>
                <button type="button" class="btn-avancar" onclick="proximo(11)">AVANÇAR</button>
            </div>

            <div class="step" id="step11">
                <h2>Finalização</h2>
                <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:10px; font-size:0.8rem; height:150px; overflow-y:auto; text-align:justify; border: 1px solid rgba(255,255,255,0.1);">
                    <b>DECLARAÇÃO - LGPD</b><br><br>
                    Autorizo a Secretaria de Educação de Queimados a utilizar estes dados exclusivamente para o processo de matrícula e planejamento escolar, conforme a Lei Federal Nº 13.709/2018.
                </div>
                <div style="margin-top:15px; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="concordo" style="width:25px; height:25px;" onchange="document.getElementById('btn_final').disabled = !this.checked">
                    <label for="concordo" style="margin:0">LI E CONCORDO</label>
                </div>
                <button type="button" id="btn_final" class="btn-avancar" style="background:var(--success)" disabled onclick="enviarFormulario()">ENVIAR INSCRIÇÃO</button>
            </div>
        </div>
    </form>

    <div id="modalPCD" class="modal-overlay" style="display:none;">
        <div class="glass-panel" style="max-width:380px;">
            <h3>QUAL A DEFICIÊNCIA?</h3>
            <input type="text" id="pcd_temp" placeholder="DESCREVA A DEFICIÊNCIA..." oninput="limparEntrada(this)">
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button type="button" class="btn-avancar" style="background:var(--error); margin:0" onclick="fecharModalPCD(false)">CANCELA</button>
                <button type="button" class="btn-avancar" style="background:var(--success); margin:0" onclick="fecharModalPCD(true)">CONFIRMA</button>
            </div>
        </div>
    </div>

    <div id="modalEndereco" class="modal-overlay" style="display:none;">
        <div class="glass-panel" style="max-width:400px;">
            <h3>ENDEREÇO ENCONTRADO</h3>
            <label>RUA:</label>
            <input type="text" id="m_rua" name="rua" readonly style="background:rgba(0,0,0,0.2); color:#fff;">
            <label>BAIRRO:</label>
            <input type="text" id="m_bairro" name="bairro" readonly style="background:rgba(0,0,0,0.2); color:#fff;">
            <input type="hidden" id="m_cidade" name="cidade">
            
            <div style="display:flex; gap:10px;">
                <div style="flex:1">
                    <label>NÚMERO:</label>
                    <input type="text" id="m_num" name="numero" placeholder="Ex: 10">
                </div>
                <div style="flex:1">
                    <label>COMPLEMENTO:</label>
                    <input type="text" id="m_compl" name="complemento" placeholder="Apt/Lote">
                </div>
            </div>
            <button type="button" class="btn-avancar" style="background:var(--success)" onclick="finalizarEnd()">CONFIRMAR E AVANÇAR</button>
        </div>
    </div>

    <div id="modalSucesso" class="modal-overlay" style="display:none;">
        <div class="glass-panel" style="text-align:center;">
            <div style="font-size:4rem; color:var(--success)">✓</div>
            <h2>SUCESSO!</h2>
            <p>Sua inscrição foi gravada com sucesso.</p>
            <button type="button" class="btn-avancar" onclick="window.location.reload()">NOVA INSCRIÇÃO</button>
        </div>
    </div>

    <script>
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
        
        // MÁSCARAS
        function maskCPF(i){ i.value=i.value.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2") }
        function maskTel(i){ i.value=i.value.replace(/\D/g,"").replace(/^(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2") }
        function maskCEP(i){ i.value=i.value.replace(/\D/g,"").replace(/^(\d{5})(\d)/,"$1-$2") }
        
        function limparEntrada(el) { el.value = el.value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
        function ativarData(el) { if(el.value.length > 5) document.getElementById('data_nasc').disabled = false; }
        function ativarCPF(el) { if(el.value) document.getElementById('cpf_aluno').disabled = false; }

        function proximo(n) {
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
            document.getElementById('step' + n).classList.add('active');
            document.getElementById('progress-bar').style.width = ((n / 11) * 100) + '%';
        }

        async function processarCPF(el) {
            maskCPF(el);
            let v = el.value.replace(/\D/g, '');
            if(v.length === 11) {
                // 1. Validação Matemática (Dígitos verificadores)
                if(!validarCPF(v)) {
                    exibirAviso("CPF Inválido", "O número informado não é um CPF válido. Por favor, confira os dados.", "erro");
                    el.value = "";
                    return;
                }

                // 2. Validação de Banco (Duplicidade)
                const res = await fetch('check_cpf.php?cpf=' + v);
                const data = await res.json();
                if(data.exists) { 
                    exibirAviso("Já Cadastrado", "Este CPF já possui uma inscrição ativa em nosso sistema.", "aviso");
                    el.value = ""; 
                } 
                else { 
                    calcularIdade2026(); 
                    proximo(2); 
                }
            }
        }

        function calcularIdade2026() {
            const nasc = new Date(document.getElementById('data_nasc').value);
            const corte = new Date('2026-03-31');
            let meses = (corte.getFullYear() - nasc.getFullYear()) * 12 + (corte.getMonth() - nasc.getMonth());
            if (corte.getDate() < nasc.getDate()) meses--;
            const anos = Math.floor(meses / 12);
            document.getElementById('idade_hidden').value = anos;

            let mod = "";
            if (meses >= 4 && meses <= 11) mod = "CRECHE I";
            else if (anos === 1) mod = "CRECHE II";
            else if (anos === 2) mod = "CRECHE III";
            else if (anos === 3) mod = "CRECHE IV";
            else if (anos === 4) mod = "PRÉ I";
            else if (anos === 5) mod = "PRÉ II";
            else if (anos === 6) mod = "1º ANO";

            const area = document.getElementById('area_modalidade');

            if (mod !== "") {
                // Mantém o direcionamento automático para menores de 7 anos
                area.innerHTML = `<div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;text-align:center;"><b>MODALIDADE DESTINADA:</b><br>${mod}</div><input type="hidden" name="ano_pretendido" value="${mod}">`;
            } else {
                // Listas de opções
                const fundamental = ['2º ANO', '3º ANO', '4º ANO', '5º ANO', '6º ANO', '7º ANO', '8º ANO', '9º ANO'];
                const eja = ['EJA I', 'EJA II', 'EJA III', 'EJA IV', 'EJA V', 'EJA VI', 'EJA VII', 'EJA VIII', 'EJA IX'];
                
                let opcoes = "";

                // Regra: 7 até 14 anos e 11 meses
                if (anos >= 7 && anos < 15) {
                    fundamental.forEach(item => { opcoes += `<option value="${item}">${item}</option>`; });
                } 
                // Regra: 15 até 17 anos e 11 meses (Fundamental + EJA)
                else if (anos >= 15 && anos < 18) {
                    [...fundamental, ...eja].forEach(item => { opcoes += `<option value="${item}">${item}</option>`; });
                } 
                // Regra: 18 anos ou mais (Apenas EJA)
                else if (anos >= 18) {
                    eja.forEach(item => { opcoes += `<option value="${item}">${item}</option>`; });
                }

                area.innerHTML = `
                    <label>ANO ESCOLAR:</label>
                    <select name="ano_pretendido" class="form-control" required>
                        <option value="">Selecione o ano...</option>
                        ${opcoes}
                    </select>`;
            }
        }
            
        // --- VALIDADOR MATEMÁTICO DE CPF ---
        function validarCPF(cpf) {
            cpf = cpf.replace(/\D/g, '');
            if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
            let soma = 0, resto;
            for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
            resto = (soma * 10) % 11;
            if ((resto === 10) || (resto === 11)) resto = 0;
            if (resto !== parseInt(cpf.substring(9, 10))) return false;
            soma = 0;
            for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
            resto = (soma * 10) % 11;
            if ((resto === 10) || (resto === 11)) resto = 0;
            return resto === parseInt(cpf.substring(10, 11));
        }

        // --- GERADOR DE AVISO VITRIFICADO ---
        function exibirAviso(titulo, msg, tipo = 'erro') {
            const antigo = document.querySelector('.alerta-vidro');
            if(antigo) antigo.remove();

            const div = document.createElement('div');
            div.className = 'alerta-vidro';
            const corIcone = tipo === 'erro' ? '#ef4444' : '#f59e0b';
            const icone = tipo === 'erro' ? '✕' : '⚠';

            div.innerHTML = `
                <span style="font-size: 3.5rem; color: ${corIcone}; display: block; margin-bottom: 10px;">${icone}</span>
                <h3 style="margin: 0 0 10px 0; text-transform: uppercase;">${titulo}</h3>
                <p style="font-size: 0.95rem; opacity: 0.9; margin-bottom: 25px; line-height: 1.4;">${msg}</p>
                <button type="button" class="btn-avancar" style="margin-top: 0; padding: 12px;" onclick="this.parentElement.remove()">ENTENDI</button>
            `;
            document.body.appendChild(div);
        }

        async function processarCEP(el) {
            let v = el.value.replace(/\D/g,'');
            if(v.length === 8) {
                const r = await fetch(`https://viacep.com.br/ws/${v}/json/`);
                const d = await r.json();
                if(!d.erro) {
                    document.getElementById('m_rua').value = d.logradouro.toUpperCase();
                    document.getElementById('m_bairro').value = d.bairro.toUpperCase();
                    document.getElementById('m_cidade').value = d.localidade.toUpperCase();
                    document.getElementById('modalEndereco').style.display = 'flex';
                }
            }
        }

        function finalizarEnd() {
            if(!document.getElementById('m_num').value) { alert("NÚMERO OBRIGATÓRIO!"); return; }
            document.getElementById('modalEndereco').style.display = 'none';
            proximo(8);
        }

        function verificarPCD(v) { if(v === 'SIM') document.getElementById('modalPCD').style.display = 'flex'; }
        function fecharModalPCD(c) {
            if(c) document.getElementById('pcd_desc_hidden').value = document.getElementById('pcd_temp').value;
            document.getElementById('modalPCD').style.display = 'none';
        }

        function fluxoMatricula(v) {
            const m = document.getElementById('motivo_matricula'); m.disabled = false;
            m.innerHTML = '<option value="BUSCA POR ESCOLA PRÓXIMA">BUSCA POR ESCOLA PRÓXIMA</option><option value="MUDANÇA">MUDANÇA</option>';
            document.getElementById('btn4').disabled = false;
        }

        function validarPasso2() { document.getElementById('btn2').disabled = false; }
        function validarPasso6() { document.getElementById('btn6').disabled = false; }

        async function enviarFormulario() {
            const btn = document.getElementById('btn_final');
            btn.innerText = "GRAVANDO..."; btn.disabled = true;
            const formData = new FormData(document.getElementById('formPrincipal'));
            // Adiciona manualmente os campos do modal de endereço que são readonly
            formData.append('rua', document.getElementById('m_rua').value);
            formData.append('bairro', document.getElementById('m_bairro').value);
            formData.append('cidade', document.getElementById('m_cidade').value);
            formData.append('numero', document.getElementById('m_num').value);
            formData.append('complemento', document.getElementById('m_compl').value);

            const response = await fetch('salvar.php', { method: 'POST', body: formData });
            const res = await response.json();
            if(res.status === "success") document.getElementById('modalSucesso').style.display = 'flex';
            else { alert("ERRO: " + res.message); btn.innerText = "TENTAR NOVAMENTE"; btn.disabled = false; }
        }

        // Popular Escolas
        const sel = document.getElementById('unidade_pref');
        escolas.sort().forEach(e => { let o = document.createElement('option'); o.value=e; o.text=e; sel.add(o); });
    </script>
</body>
</html>