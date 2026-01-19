const API_URL = 'https://patrimoniosemed.paiva.api.br';
let TOKEN = localStorage.getItem('token');

// Forçar maiúsculas sem acentos APENAS em campos de texto
document.addEventListener('input', (e) => {
    // Adicionamos a verificação: e.target.type === 'text'
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        
        e.target.value = e.target.value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
            
        // Só tenta redefinir a posição do cursor se o navegador suportar (evita o erro)
        if (start !== null && e.target.setSelectionRange) {
            e.target.setSelectionRange(start, end);
        }
    }
});

// Função para gerar campos de Patrimônio dinamicamente
function gerarCamposSerie() {
    const qtd = document.getElementById('qtd_patrimonio').value;
    const container = document.getElementById('container_series');
    container.innerHTML = ''; // Limpa campos anteriores

    for (let i = 0; i < qtd; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `NÚMERO DE SÉRIE / PLAQUETA ${i + 1}`;
        input.className = 'input-serie';
        input.required = true;
        container.appendChild(input);
    }
}

// Login simplificado (sem e-mail)
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('usuario').value;
    const senha = document.getElementById('senha').value;

    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha })
    });

    const data = await res.json();
    if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('perfil', data.perfil);
        localStorage.setItem('nome', data.nome);
        localStorage.setItem('local_id', data.local_id);        
        TOKEN = data.token;
        carregarDashboard();
    } else {
        alert('ERRO: ' + data.message);
    }
});

function mostrarLogin() {
    const app = document.getElementById('app-content');
    const loginContainer = document.getElementById('login-container');
    
    // Criar o fundo com texto repetido (ex: 150 vezes para preencher a tela)
    let backgroundHTML = '<div class="login-background-text">';
    for (let i = 0; i < 150; i++) {
        backgroundHTML += '<span>SEMED</span>';
    }
    backgroundHTML += '</div>';

    document.body.classList.add('login-body');
    document.body.insertAdjacentHTML('afterbegin', backgroundHTML);
    loginContainer.style.display = 'block';
    app.style.display = 'none';
}
// Carregar alertas para Perfil Escola
async function verificarAlertasEscola() { // Removi o localId daqui
    try {
        // A rota correta no seu server.js + pedidos.routes.js
        const res = await fetch(`${API_URL}/pedidos/alertas-escola`, { 
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (!res.ok) return;
        const pedidos = await res.json();
        
        const alertContainer = document.getElementById('alertas-container');
        if (!alertContainer) return;

        if (pedidos.length > 0) {
            alertContainer.innerHTML = `
                <div style="background: #fef2f2; color: #dc2626; padding: 15px; border-radius: 8px; border: 1px solid #fee2e2; margin-bottom: 20px; font-weight: bold; text-align: center;">
                    ⚠️ ATENÇÃO: VOCÊ POSSUI ${pedidos.length} PEDIDO(S) EM TRANSPORTE PARA ESTA UNIDADE!
                </div>`;
        } else {
            alertContainer.innerHTML = '';
        }
    } catch (err) {
        console.error("Erro nos alertas:", err);
    }
}

// Renderizar estoque com Alerta Visual de nível baixo
async function renderizarEstoqueCentral() {
    const res = await fetch(`${API_URL}/estoque/central`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const produtos = await res.json();

    const html = produtos.map(p => `
        <div class="item-estoque ${p.alerta_baixo ? 'estoque-baixo' : ''}">
            <span>${p.nome}</span>
            <span>QTD: ${p.quantidade_estoque}</span>
            ${p.alerta_baixo ? '<b style="color: red;">⚠️ BAIXO ESTOQUE</b>' : ''}
        </div>
    `).join('');
    document.getElementById('lista-estoque').innerHTML = html;
}

// --- FUNÇÃO DASHBOARD REVISADA COM REGRAS DE PERFIS ESPECÍFICAS ---
function carregarDashboard() {
    const perfil = localStorage.getItem('perfil') ? localStorage.getItem('perfil').toLowerCase() : null;
    const nome = localStorage.getItem('nome');
    const localId = localStorage.getItem('local_id');
    const container = document.getElementById('app-content');
    const loginContainer = document.getElementById('login-container');

    if (!perfil) {
        if (loginContainer) loginContainer.style.display = 'block';
        if (container) container.style.display = 'none';
        return;
    }

    if (loginContainer) loginContainer.style.display = 'none';
    if (container) container.style.display = 'block';

    // Cabeçalho Padrão
    let html = `
        <div class="header-app">
            <span class="logo-texto">📦 PATRIMÔNIO SEMED</span>
            <div style="text-align: right;">
                <div style="font-size: 0.9rem; font-weight: bold; color: #1e40af;">Olá, ${nome} (${perfil.toUpperCase()})</div>
                <button onclick="logout()" style="width: auto; padding: 5px 15px; background: #dc2626; font-size: 0.8rem; margin-top: 5px; color:white; border:none; border-radius:4px; cursor:pointer;">SAIR</button>
            </div>
        </div>
        <div id="area-alertas" style="margin-bottom:20px;"></div>
        <div class="grid-menu-principal">
    `;

    // --- 1. FERRAMENTAS COMUNS (Todos os perfis) ---
    const menuComum = `
        <div class="secao-titulo">FERRAMENTAS E CONTA</div>
        <button class="btn-grande" onclick="abrirCalculadoraConversao()">
            <i>🧮</i><span>CALCULADORA</span>
        </button>
        <button class="btn-grande" onclick="telaAlterarSenha()">
            <i>🔑</i><span>ALTERAR MINHA SENHA</span>
        </button>
    `;

    // --- 2. PERFIL: SUPER (Gestão de Usuários) ---
    if (perfil === 'super') {
        html += `
            <div class="secao-titulo">ADMINISTRAÇÃO DO SISTEMA</div>
            <button class="btn-grande" onclick="telaGerenciarUsuarios()">
                <i>👥</i><span>GERENCIAR USUÁRIOS</span>
            </button>
        `;
    }

    // --- 3. PERFIL: ESCOLA ---
    if (perfil === 'escola') {
        html += `
            <div class="secao-titulo">MINHA UNIDADE (ESCOLA)</div>
            <button class="btn-grande" onclick="listarPedidosEmCaminho()">
                <i>🚚</i><span>CONFIRMAR RECEBIMENTO</span>
            </button>
            <button class="btn-grande" onclick="telaSolicitarUniforme()">
                <i>👕</i><span>SOLICITAR UNIFORMES</span>
            </button>
            <button class="btn-grande" onclick="telaDevolucaoUniforme()">
                <i>🔄</i><span>DEVOLVER UNIFORMES</span>
            </button>
        `;
        // Chama alertas específicos da escola (Pedidos em transporte para o localId)
        setTimeout(() => verificarAlertasEscola(), 500);
    }

    // --- 4. PERFIL: ADMIN ---
    if (perfil === 'admin') {
        html += `
            <div class="secao-titulo">GESTÃO E CADASTROS</div>
            <button class="btn-grande" onclick="telaCadastrosBase()">
                <i>⚙️</i><span>CADASTROS BÁSICOS</span>
            </button>
            <button class="btn-grande" onclick="telaAbastecerEstoque()">
                <i>📥</i><span>ENTRADA ESTOQUE</span>
            </button>
            <button class="btn-grande" onclick="telaAdminCriarPedido()">
                <i>➕</i><span>CRIAR PEDIDO UNIFORME</span>
            </button>
            <div class="secao-titulo">CONSULTAS E RELATÓRIOS</div>
            <button class="btn-grande" onclick="telaVisualizarEstoque()">
                <i>📦</i><span>VISUALIZAR ESTOQUE</span>
            </button>
            <div class="secao-titulo">PAINEL GERAL (ADMIN)</div>
            <button class="btn-grande" onclick="renderizarDashboardGeral()">
                <i>📊</i><span>PAINEL DE PEDIDOS</span>
            </button>
            <button class="btn-grande" onclick="renderizarRelatorios()">
                <i>📋</i><span>RELATÓRIOS E PDF</span>
            </button>
            <button class="btn-grande" onclick="renderizarHistoricoGeral()">
                <i>📜</i><span>TODOS OS HISTÓRICOS</span>
            </button>
        `;
        // Chama alertas de novas solicitações de Escolas e Logística
        setTimeout(() => verificarSolicitacoesPendentes(), 500);
    }

    // --- 5. PERFIL: ESTOQUE ---
    if (perfil === 'estoque') {
        html += `
            <div class="secao-titulo">OPERAÇÕES DE ESTOQUE</div>
            <button class="btn-grande" onclick="abrirPainelSeparacao()">
                <i>📦</i><span>SEPARAÇÃO DE VOLUMES</span>
            </button>
            <button class="btn-grande" onclick="telaAbastecerEstoque()">
                <i>📥</i><span>ENTRADA ESTOQUE</span>
            </button>
            <button class="btn-grande" onclick="telaReceberDevolucoes()">
                <i>🔄</i><span>RECEBER DEVOLUÇÕES</span>
            </button>
            <div class="secao-titulo">PATRIMÔNIO</div>
            <button class="btn-grande" onclick="telaGerenciarPatrimonio()">
                <i>🏷️</i><span>LANÇAR/MOVER PATRIMÔNIO</span>
            </button>
            <div class="secao-titulo">CONSULTAS</div>
            <button class="btn-grande" onclick="telaVisualizarEstoque()">
                <i>📊</i><span>VISUALIZAR ESTOQUE</span>
            </button>
            <button class="btn-grande" onclick="renderizarRelatorios()">
                <i>📋</i><span>RELATÓRIOS</span>
            </button>
            <button class="btn-grande" onclick="renderizarHistoricoGeral()">
                <i>📜</i><span>HISTÓRICOS</span>
            </button>
        `;
        // Chama alertas de pedidos aguardando separação
        setTimeout(verificarPedidosParaSeparar, 500);
    }

    // --- 6. PERFIL: LOGÍSTICA ---
    if (perfil === 'logistica') {
        html += `
            <div class="secao-titulo">LOGÍSTICA E TRANSPORTE</div>
            <button class="btn-grande" onclick="listarColetaLogistica()">
                <i>🚚</i><span>RECOLHER E TRANSPORTAR PEDIDO</span>
            </button>
            <button class="btn-grande" onclick="telaSolicitarPatrimonio()">
                <i>🏷️</i><span>SOLICITAR PATRIMÔNIO</span>
            </button>
            <button class="btn-grande" onclick="renderizarHistoricoGeral()">
                <i>📜</i><span>VER HISTÓRICOS</span>
            </button>
        `;
        // Alertas de pedidos prontos para coleta no Estoque Central
        setTimeout(verificarPedidosParaColeta, 500);
    }



    html += menuComum + `</div>`; // Fecha a grid e adiciona o menu comum no fim
    container.innerHTML = html;

    iniciarAlertaPedidos();

}

function iniciarAlertaPedidos() {
    // Usando 'perfil' para bater com o resto do seu script
    const perfil = localStorage.getItem('perfil')?.toLowerCase();
    if (!perfil) return;

    // Função que executa a verificação
    const verificar = async () => {
        try {
            const res = await fetch(`${API_URL}/pedidos/contagem/alertas`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            if (!res.ok) return;
            const contagem = await res.json();
            
            const areaAlerta = document.getElementById('area-alertas');
            if (!areaAlerta) return;

            // Limpa o alerta se não houver nada
            areaAlerta.innerHTML = '';
            areaAlerta.style.display = 'none';

            if (perfil === 'admin' && contagem.admin_pendente > 0) {
                areaAlerta.innerHTML = `
                    <div style="background: #fee2e2; color: #b91c1c; padding: 15px; border-radius: 8px; border: 1px solid #f87171; font-weight: bold; text-align: center; cursor: pointer; margin-bottom: 20px;" 
                         onclick="listarSolicitacoesPendentes()">
                        ⚠️ EXISTEM ${contagem.admin_pendente} SOLICITAÇÕES DE UNIFORME AGUARDANDO AUTORIZAÇÃO! (CLIQUE AQUI PARA VER)
                    </div>`;
                areaAlerta.style.display = 'block';
            } else if (perfil === 'estoque' && contagem.estoque_pendente > 0) {
                areaAlerta.innerHTML = `
                    <div style="background: #dcfce7; color: #15803d; padding: 15px; border-radius: 8px; border: 1px solid #4ade80; font-weight: bold; text-align: center; cursor: pointer; margin-bottom: 20px;"
                        onclick="listarFilaSeparacao()">
                        📦 EXISTEM ${contagem.estoque_pendente} PEDIDOS AUTORIZADOS PARA SEPARAÇÃO! (CLIQUE AQUI PARA VER)
                    </div>`;
                areaAlerta.style.display = 'block';
            } else if (perfil === 'logistica' && contagem.estoque_pendente > 0) {
                areaAlerta.innerHTML = `
                    <div class="alerta-pulsar" style="background:#eff6ff; color:#1e40af; cursor:pointer;" onclick="listarColetasLogistica()">
                        🚚 EXISTEM ${contagem.logistica_pendente} COLETAS LIBERADAS PARA TRANSPORTE!
                    </div>`;
                areaAlerta.style.display = 'block';                
            } else if (perfil === 'escola' && contagem.estoque_pendente > 0) {
                areaAlerta.innerHTML = `
                    <div class="alerta-pulsar" style="background:#fff7ed; color:#c2410c; cursor:pointer;" onclick="listarPedidosEmCaminho()">
                        🚚 VOCÊ TEM ${contagem.escola_recebimento} PEDIDO(S) EM TRANSPORTE PARA SUA UNIDADE! (CLIQUE PARA CONFIRMAR RECEBIMENTO)
                    </div>`;
                areaAlerta.style.display = 'block';
            }                
        } catch (e) { console.error("Erro no alerta:", e); }
    };

    // Executa agora e depois a cada 30 segundos
    verificar();
    setInterval(verificar, 30000);
}

async function listarSolicitacoesPendentes() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">CARREGANDO SOLICITAÇÕES...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/pendentes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">SOLICITAÇÕES AGUARDANDO AUTORIZAÇÃO</h2>
                <table style="width:100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background: #f1f5f9; text-align: left;">
                            <th style="padding:15px; border-bottom: 2px solid #cbd5e1;">ID</th>
                            <th style="padding:15px; border-bottom: 2px solid #cbd5e1;">ESCOLA</th>
                            <th style="padding:15px; border-bottom: 2px solid #cbd5e1;">DATA</th>
                            <th style="padding:15px; border-bottom: 2px solid #cbd5e1;">AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedidos.map(p => `
                            <tr>
                                <td style="padding:15px; border-bottom: 1px solid #e2e8f0;">#${p.id}</td>
                                <td style="padding:15px; border-bottom: 1px solid #e2e8f0;">${p.escola}</td>
                                <td style="padding:15px; border-bottom: 1px solid #e2e8f0;">${new Date(p.data_criacao).toLocaleString()}</td>
                                <td style="padding:15px; border-bottom: 1px solid #e2e8f0;">
                                    <button onclick="abrirDetalhesAutorizacao(${p.id})" style="padding:8px 15px; background:#2563eb; color:white; border:none; border-radius:4px; cursor:pointer;">ANALISAR</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        alert("Erro ao carregar lista");
    }
}

async function abrirDetalhesAutorizacao(id) {
    const res = await fetch(`${API_URL}/pedidos/${id}/detalhes`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const itens = await res.json();

    const container = document.getElementById('app-content');
    let html = `
        <div style="padding:20px;">
            <button onclick="listarSolicitacoesPendentes()" style="margin-bottom:20px;">⬅ VOLTAR</button>
            <h3>DETALHES DA SOLICITAÇÃO #${id}</h3>
            <table style="width:100%; margin-top:15px; background:white;">
                <tr style="background:#f8fafc;">
                    <th style="padding:10px;">PRODUTO</th>
                    <th style="padding:10px;">TAMANHO</th>
                    <th style="padding:10px;">QTD SOLICITADA</th>
                    <th style="padding:10px;">ESTOQUE ATUAL</th>
                </tr>
                ${itens.map(item => `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${item.produto_nome}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${item.tamanho}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee;">
                            <input type="number" class="edit-qtd" data-prod-id="${item.produto_id}" data-tamanho="${item.tamanho}" value="${item.quantidade_solicitada}" style="width:60px;">
                        </td>
                        <td style="padding:10px; border-bottom:1px solid #eee; font-weight:bold;">CONSULTANDO...</td>
                    </tr>
                `).join('')}
            </table>
            <div style="margin-top:30px; display:flex; gap:20px;">
                <button onclick="autorizarPedido(${id})" style="flex:1; padding:15px; background:#16a34a; color:white; font-weight:bold;">AUTORIZAR E BAIXAR ESTOQUE</button>
                <button onclick="recusarPedido(${id})" style="padding:15px; background:#dc2626; color:white;">RECUSAR (EXCLUIR)</button>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

async function autorizarPedido(id) {
    const inputs = document.querySelectorAll('.edit-qtd');
    const itens_atualizados = [];
    inputs.forEach(i => {
        itens_atualizados.push({
            produto_id: i.dataset.prodId,
            tamanho: i.dataset.tamanho,
            quantidade: parseInt(i.value)
        });
    });

    if(!confirm("CONFIRMA A AUTORIZAÇÃO? O ESTOQUE SERÁ BAIXADO AGORA.")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/autorizar/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ itens_atualizados })
        });
        const data = await res.json();
        if(res.ok) {
            alert("✅ " + data.message);
            carregarDashboard();
        } else {
            alert("❌ ERRO: " + data.error);
        }
    } catch(e) { alert("Erro na autorização"); }
}

function logout() {
    localStorage.clear();
    window.location.reload();
}

// Função para Admin autorizar pedido ou recusar com motivo [cite: 10, 24]
async function processarSolicitacao(pedidoId, acao) {
    let motivo = '';
    let status = acao === 'AUTORIZA' ? 'PEDIDO AUTORIZADO' : 'RECUSADO';

    if (acao === 'RECUSA') {
        motivo = prompt("INFORME O MOTIVO DA RECUSA:");
        if (!motivo) return;
    }

    const res = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ status, motivo_recusa: motivo.toUpperCase() })
    });

    if (res.ok) {
        alert("SOLICITAÇÃO ATUALIZADA");
        carregarDashboard();
    }
}

// Função para Escola confirmar recebimento [cite: 16, 51, 52]
async function confirmarRecebimento(pedidoId) {
    if (!confirm("CONFIRMA O RECEBIMENTO DESTE PEDIDO?")) return;

    const res = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ status: 'ENTREGUE' })
    });

    if (res.ok) {
        alert("RECEBIMENTO CONFIRMADO!");
        carregarDashboard();
    }
}

// Função para Estoque definir volumes e liberar [cite: 18, 20, 21]
async function liberarParaLogistica(pedidoId) {
    const volumes = document.getElementById(`volumes_${pedidoId}`).value;
    if (!volumes) return alert("INFORME A QTD DE VOLUMES");

    const res = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ status: 'RETIRADA AUTORIZADA', volumes })
    });

    if (res.ok) {
        alert("PEDIDO LIBERADO PARA LOGÍSTICA");
        carregarDashboard();
    }
}

// Função para Gerar Relatório PDF (jsPDF) [cite: 6, 38, 39, 40]
function imprimirRelatorioEstoque(dados) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
        
    doc.text("RELATÓRIO DE ESTOQUE CENTRAL - SEMED", 10, 10);
    
    const colunas = ["PRODUTO", "TIPO", "QTD", "STATUS"];
    const linhas = dados.map(p => [
        p.nome, 
        p.tipo, 
        p.quantidade_estoque, 
        p.alerta_baixo ? "ESTOQUE BAIXO" : "OK"
    ]);

    doc.autoTable({
        head: [colunas],
        body: linhas,
        startY: 20
    });

    doc.save(`relatorio_estoque_${new Date().getTime()}.pdf`);
}

async function enviarPedidoGrade() {
    // 1. Captura todos os inputs da tabela de uniformes
    const inputs = document.querySelectorAll('.input-qtd-uniforme');
    const itens = [];
    let totalItens = 0;

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: parseInt(input.getAttribute('data-prod')), // Pega o ID real do banco
                tamanho: input.getAttribute('data-tam'),
                quantidade: qtd
            });
            totalItens += qtd;
        }
    });

    if (itens.length === 0) {
        return alert("POR FAVOR, PREENCHA A QUANTIDADE DE PELO MENOS UM ITEM.");
    }

    if (!confirm(`CONFIRMAR SOLICITAÇÃO DE ${totalItens} ITENS?`)) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/grade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ itens })
        });

        const data = await res.json();
        if (res.ok) {
            alert("SOLICITAÇÃO REALIZADA COM SUCESSO!");
            carregarDashboard(); // Volta para a tela inicial
        } else {
            alert("ERRO AO SALVAR: " + (data.error || "Verifique o console"));
        }
    } catch (err) {
        alert("FALHA NA CONEXÃO COM O SERVIDOR");
    }
}

function abrirModalCadastroUsuario() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    // Busca os locais para popular a lista de escolas
    fetch(`${API_URL}/api/cadastros/locais`, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
        .then(res => res.json())
        .then(locais => {
            // Filtra para remover SEMED e ESTOQUE da lista visual de seleção de escolas
            const escolas = locais.filter(l => ![36, 37, 38].includes(l.id));

            modal.innerHTML = `
                <div class="modal-box">
                    <h3>CADASTRAR NOVO USUÁRIO</h3>
                    <form id="formCadastroUsuario">
                        <input type="text" id="cadNome" placeholder="NOME DE USUÁRIO" required>
                        <input type="password" id="cadSenha" placeholder="SENHA" required>
                        <select id="cadPerfil" required onchange="toggleLocalSelect(this.value)">
                            <option value="">SELECIONE O PERFIL</option>
                            <option value="admin">ADMIN (SEMED ADM)</option>
                            <option value="estoque">ESTOQUE (ESTOQUE CENTRAL)</option>
                            <option value="logistica">LOGÍSTICA (SEMED INFRA)</option>
                            <option value="escola">ESCOLA</option>
                            <option value="super">SUPER (ACESSO TOTAL)</option>
                        </select>
                        
                        <div id="containerLocal" style="display:none; margin-top:10px;">
                            <label>SELECIONE A ESCOLA:</label>
                            <select id="cadLocal">
                                <option value="">Selecione uma escola...</option>
                                ${escolas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                            </select>
                        </div>

                        <div style="margin-top:20px;">
                            <button type="button" onclick="salvarUsuario()" style="background:green; color:white;">SALVAR</button>
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" style="background:#f44336; color:white;">CANCELAR</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        });
}

function toggleLocalSelect(perfil) {
    const container = document.getElementById('containerLocal');
    container.style.display = (perfil === 'escola') ? 'block' : 'none';
}

function salvarUsuario() {
    const nome = document.getElementById('cadNome').value.trim();
    const senha = document.getElementById('cadSenha').value.trim();
    const perfil = document.getElementById('cadPerfil').value;
    let local_id = null;

    if (!nome || !senha || !perfil) {
        return alert("ERRO: TODOS OS CAMPOS SÃO OBRIGATÓRIOS!");
    }

    // Atribuição automática de local_id baseada no perfil
    if (perfil === 'admin') local_id = 36;
    else if (perfil === 'estoque') local_id = 37;
    else if (perfil === 'logistica') local_id = 38;
    else if (perfil === 'super') local_id = 36;
    else if (perfil === 'escola') {
        local_id = document.getElementById('cadLocal').value;
        if (!local_id) return alert("ERRO: SELECIONE UMA ESCOLA!");
    }

    const dados = { nome, senha, perfil, local_id: parseInt(local_id) };

    fetch(`${API_URL}/api/usuarios`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}` 
        },
        body: JSON.stringify(dados)
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao cadastrar");
        alert("USUÁRIO CADASTRADO COM SUCESSO!");
        document.querySelector('.modal-overlay').remove();
    })
    .catch(err => alert(err.message));
}

async function telaGerenciarUsuarios() {
    const container = document.getElementById('app-content');
    const res = await fetch(`${API_URL}/auth/usuarios`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const usuarios = await res.json();

    const resLocais = await fetch(`${API_URL}/catalogo/locais`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const locais = await resLocais.json();

    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <div class="card-login" style="max-width: 100%; margin-bottom: 20px;">
            <h3>CADASTRAR NOVO UTILIZADOR</h3>
            <input type="text" id="novo_nome" placeholder="NOME DO UTILIZADOR">
            <input type="password" id="nova_senha" placeholder="SENHA INICIAL">
            <select id="novo_perfil" class="input-grade" style="width: 100%; height: 50px; margin-bottom: 10px;">
                <option value="admin">ADMIN</option>
                <option value="escola">ESCOLA</option>
                <option value="estoque">ESTOQUE</option>
                <option value="logistica">LOGÍSTICA</option>
            </select>
            <select id="novo_local" class="input-grade" style="width: 100%; height: 50px;">
                <option value="">SEM LOCAL (ADMIN/ESTOQUE)</option>
                ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
            </select>
            <button onclick="salvarUsuario()" style="margin-top: 15px; background: var(--success);">CRIAR UTILIZADOR</button>
        </div>

        <div class="secao-titulo">UTILIZADORES CADASTRADOS</div>
        ${usuarios.map(u => `
            <div class="item-estoque">
                <div>
                    <strong>${u.nome}</strong><br>
                    <small>PERFIL: ${u.perfil.toUpperCase()} | STATUS: ${u.status.toUpperCase()}</small>
                </div>
                <button onclick="alterarStatusUsuario(${u.id}, '${u.status === 'ativo' ? 'inativo' : 'ativo'}')" 
                        style="width: auto; padding: 10px; background: ${u.status === 'ativo' ? 'var(--danger)' : 'var(--success)'};">
                    ${u.status === 'ativo' ? 'DESATIVAR' : 'ATIVAR'}
                </button>
            </div>
        `).join('')}
    `;
    container.innerHTML = html;
}

async function salvarUsuario() {
    const nome = document.getElementById('novo_nome').value;
    const senha = document.getElementById('nova_senha').value;
    const perfil = document.getElementById('novo_perfil').value;
    const local_id = document.getElementById('novo_local').value;

    const res = await fetch(`${API_URL}/auth/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ nome, senha, perfil, local_id: local_id || null })
    });

    if (res.ok) {
        alert("UTILIZADOR CRIADO!");
        telaGerenciarUsuarios();
    }
}

async function alterarStatusUsuario(id, status) {
    await fetch(`${API_URL}/auth/usuarios/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ status })
    });
    telaGerenciarUsuarios();
}

async function telaPedidosAutorizados() {
    const container = document.getElementById('app-content');
    const res = await fetch(`${API_URL}/pedidos/status/PEDIDO AUTORIZADO`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const pedidos = await res.json();

    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <div class="secao-titulo">PEDIDOS PARA SEPARAÇÃO</div>
    `;

    html += pedidos.map(p => `
        <div class="item-estoque" style="flex-direction: column; align-items: flex-start;">
            <div style="width: 100%; display: flex; justify-content: space-between;">
                <span><strong>PEDIDO #${p.id}</strong> - ${p.local_nome}</span>
                <button onclick="verDetalhesPedido(${p.id})" style="width: auto; padding: 5px 15px;">VER ITENS</button>
            </div>
            <div style="margin-top: 15px; width: 100%;">
                <input type="number" id="volumes_${p.id}" placeholder="QTD VOLUMES" class="input-grade" style="width: 100px;">
                <button onclick="liberarParaLogistica(${p.id})" style="width: auto; background: var(--success); padding: 10px 20px;">CONCLUIR SEPARAÇÃO</button>
            </div>
        </div>
    `).join('') || '<p style="color: white;">NENHUM PEDIDO AGUARDANDO SEPARAÇÃO</p>';

    container.innerHTML = html;
}

async function telaRetiradas() {
    const container = document.getElementById('app-content');
    const res = await fetch(`${API_URL}/pedidos/status/RETIRADA AUTORIZADA`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const pedidos = await res.json();

    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <div class="secao-titulo">PEDIDOS PRONTOS PARA TRANSPORTE</div>
    `;

    html += pedidos.map(p => `
        <div class="item-estoque">
            <div>
                <strong>PEDIDO #${p.id}</strong> - ${p.local_nome}<br>
                <small>VOLUMES: ${p.volumes}</small>
            </div>
            <button onclick="confirmarSaidaTransporte(${p.id})" style="width: auto; background: var(--primary);">INICIAR TRANSPORTE</button>
        </div>
    `).join('') || '<p style="color: white;">NADA PARA RETIRAR NO MOMENTO</p>';

    container.innerHTML = html;
}

async function verDetalhesPedido(id) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // Estrutura inicial do Modal com as Abas
    modal.innerHTML = `
        <div class="modal-box large">
            <div class="modal-header-tabs">
                <button onclick="alternarAbaPedido('itens', ${id})" id="tab-itens" class="tab-btn active">📦 ITENS E REMESSAS</button>
                <button onclick="alternarAbaPedido('log', ${id})" id="tab-log" class="tab-btn">📜 HISTÓRICO LOG</button>
            </div>
            
            <div id="container-aba-conteudo" class="tab-content">
                <div class="loader">CARREGANDO...</div>
            </div>

            <div style="margin-top:20px; text-align:right;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-cancel">FECHAR</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Inicia carregando a aba de itens
    alternarAbaPedido('itens', id);
}

async function telaSolicitarMaterial() {
    const container = document.getElementById('app-content');
    const res = await fetch(`${API_URL}/estoque/central`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const produtos = await res.json();
    const materiais = produtos.filter(p => p.tipo === 'MATERIAL' || p.tipo === 'PATRIMONIO');

    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <h2 style="color: white; text-align: center;">SOLICITAR MATERIAIS / PATRIMÓNIO</h2>
        <div id="lista-materiais" style="display: flex; flex-direction: column; gap: 15px;">
    `;

    materiais.forEach(m => {
        html += `
            <div class="item-estoque">
                <div style="flex: 1;">
                    <strong>${m.nome}</strong><br>
                    <small>DISPONÍVEL: ${m.quantidade_estoque}</small>
                </div>
                <input type="number" class="input-grade input-material" 
                       data-id="${m.id}" min="0" max="${m.quantidade_estoque}" 
                       placeholder="0" style="width: 80px;">
            </div>
        `;
    });

    html += `
        </div>
        <button class="btn-grande btn-enviar-pedido" onclick="enviarPedidoMateriais()">
            🚀 ENVIAR SOLICITAÇÃO
        </button>
    `;

    container.innerHTML = html;
}

async function enviarPedidoMateriais() {
    const inputs = document.querySelectorAll('.input-material');
    const itens = [];

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: input.getAttribute('data-id'),
                quantidade: qtd,
                tamanho: null
            });
        }
    });

    if (itens.length === 0) return alert("SELECIONE PELO MENOS UM ITEM");

    const res = await fetch(`${API_URL}/pedidos/grade`, { // Reaproveita a rota de grade
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ itens })
    });

    if (res.ok) {
        alert("SOLICITAÇÃO DE MATERIAL ENVIADA!");
        carregarDashboard();
    }
}

function telaAlterarSenha() {
    const container = document.getElementById('app-content');
    container.innerHTML = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <div class="card-login" style="max-width: 100%;">
            <h2>ALTERAR MINHA SENHA</h2>
            <input type="password" id="nova_senha_input" placeholder="DIGITE A NOVA SENHA">
            <input type="password" id="confirma_senha_input" placeholder="CONFIRME A NOVA SENHA">
            <button onclick="executarTrocaSenha()">ATUALIZAR SENHA</button>
        </div>
    `;
}

async function executarTrocaSenha() {
    const nova = document.getElementById('nova_senha_input').value;
    const confirma = document.getElementById('confirma_senha_input').value;

    if (!nova || nova !== confirma) return alert("AS SENHAS NÃO CONFEREM!");

    const res = await fetch(`${API_URL}/auth/alterar-senha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ novaSenha: nova })
    });

    if (res.ok) {
        alert("SENHA ALTERADA!");
        carregarDashboard();
    }
}

async function telaVerSolicitacoes() {
    const container = document.getElementById('app-content');
    const res = await fetch(`${API_URL}/pedidos/status/AGUARDANDO APROVACAO`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const pedidos = await res.json();

    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <div class="secao-titulo">PEDIDOS AGUARDANDO APROVAÇÃO</div>
    `;

    if (pedidos.length === 0) {
        html += '<p style="color: white; text-align: center;">NENHUMA SOLICITAÇÃO PENDENTE</p>';
    }

    pedidos.forEach(p => {
        html += `
            <div class="item-estoque" style="flex-direction: column; align-items: flex-start;">
                <div style="width: 100%; display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
                    <span><strong>PEDIDO #${p.id}</strong> - ${p.local_nome}</span>
                    <button onclick="verDetalhesPedido(${p.id})" style="width: auto; padding: 5px 15px;">VER ITENS</button>
                </div>
                <div style="display: flex; gap: 10px; width: 100%; margin-top: 15px;">
                    <button onclick="processarAprovacaoAdmin(${p.id}, 'AUTORIZA')" style="background: var(--success);">AUTORIZAR</button>
                    <button onclick="processarAprovacaoAdmin(${p.id}, 'RECUSA')" style="background: var(--danger);">RECUSAR</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function processarAprovacaoAdmin(pedidoId, acao) {
    let status = acao === 'AUTORIZA' ? 'PEDIDO AUTORIZADO' : 'RECUSADO';
    let motivo = '';

    if (acao === 'RECUSA') {
        motivo = prompt("MOTIVO DA RECUSA:");
        if (!motivo) return;
    }

    const res = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ status, motivo_recusa: motivo.toUpperCase() })
    });

    const data = await res.json();

    if (res.ok) {
        alert("SOLICITAÇÃO PROCESSADA!");
        telaVerSolicitacoes();
    } else {
        // Exibe o erro de estoque negativo retornado pelo backend
        alert("ATENÇÃO: " + (data.error || data.message));
    }
}

// --- FUNÇÕES DE CADASTROS BÁSICOS (ADMIN) ---

async function telaCadastrosBase() {
    const container = document.getElementById('app-content');
    
    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <h2 style="color: white; text-align: center;">CADASTROS BÁSICOS DO SISTEMA</h2>
        
        <div class="grid-menu">
            <button class="btn-grande" onclick="formGenerico('categorias', 'CATEGORIA')">
                <i>📁</i><span>CATEGORIAS</span>
            </button>
            <button class="btn-grande" onclick="formGenerico('locais', 'LOCAL')">
                <i>📍</i><span>LOCAIS (ESCOLAS)</span>
            </button>
            <button class="btn-grande" onclick="formGenerico('setores', 'SETOR')">
                <i>🏢</i><span>SETORES</span>
            </button>
            <button class="btn-grande" onclick="formProduto()">
                <i>📦</i><span>PRODUTOS</span>
            </button>
            <button class="btn-grande" onclick="formPatrimonioLote()">
                <i>🏷️</i><span>PATRIMÔNIOS (LOTE)</span>
            </button>
        </div>
        <div id="area-formulario-cadastro" style="margin-top: 30px;"></div>
    `;
    container.innerHTML = html;
}

// Formulário para Categorias, Locais e Setores
function formGenerico(tabela, label) {
    const area = document.getElementById('area-formulario-cadastro');
    area.innerHTML = `
        <div class="card-login" style="max-width: 100%;">
            <h3>NOVO CADASTRO: ${label}</h3>
            <input type="text" id="nome_generico" placeholder="NOME DO(A) ${label}">
            <button onclick="salvarGenerico('${tabela}')" style="background: var(--success); margin-top: 10px;">SALVAR REGISTRO</button>
        </div>
    `;
}

async function salvarGenerico(tabela) {
    const nome = document.getElementById('nome_generico').value;
    if(!nome) return alert("PREENCHA O NOME!");

    const res = await fetch(`${API_URL}/api/cadastros/basico/${tabela}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ nome })
    });

    if(res.ok) {
        alert("CADASTRADO COM SUCESSO!");
        document.getElementById('nome_generico').value = '';
    }
}

// Formulário de Produtos com lógica de Uniformes e Materiais
async function formProduto() {
    const area = document.getElementById('area-formulario-cadastro');
    
    // Busca categorias cadastradas para o Select
    const resCat = await fetch(`${API_URL}/api/cadastros/categorias`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const categorias = await resCat.json();

    area.innerHTML = `
        <div class="card-login" style="max-width: 100%;">
            <h3>NOVO PRODUTO</h3>
            <input type="text" id="prod_nome" placeholder="NOME DO PRODUTO" oninput="ajustarGradeUniforme()">
            
            <label style="color: white; display: block; margin-top: 10px;">TIPO DE PRODUTO:</label>
            <select id="prod_tipo" class="input-grade" style="width: 100%; height: 50px;" onchange="ajustarGradeUniforme()">
                <option value="MATERIAL">MATERIAL</option>
                <option value="UNIFORMES">UNIFORMES</option>
            </select>

            <label style="color: white; display: block; margin-top: 10px;">CATEGORIA:</label>
            <select id="prod_categoria" class="input-grade" style="width: 100%; height: 50px;">
                ${categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>

            <input type="number" id="prod_qtd" placeholder="ESTOQUE INICIAL" style="margin-top: 10px;">
            
            <div id="div_alerta_minimo">
                <input type="number" id="prod_alerta" placeholder="ALERTA MÍNIMO (ESTOQUE)" style="margin-top: 10px;">
            </div>

            <div id="info_grade" style="display:none; background: #1e3a8a; color: white; padding: 10px; margin-top: 10px; border-radius: 5px; font-size: 0.9rem;">
                <strong>GRADE DE TAMANHOS QUE SERÁ GERADA:</strong><br>
                <span id="texto_grade"></span>
            </div>

            <button onclick="salvarProduto()" style="background: var(--success); margin-top: 20px;">CADASTRAR PRODUTO</button>
        </div>
    `;
}

function ajustarGradeUniforme() {
    const tipo = document.getElementById('prod_tipo').value;
    const nome = document.getElementById('prod_nome').value.toUpperCase();
    const divAlerta = document.getElementById('div_alerta_minimo');
    const infoGrade = document.getElementById('info_grade');
    const textoGrade = document.getElementById('texto_grade');

    if (tipo === 'UNIFORMES') {
        divAlerta.style.display = 'none';
        infoGrade.style.display = 'block';
        if (nome.includes('TENIS')) {
            textoGrade.innerText = "22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43";
        } else {
            textoGrade.innerText = "2, 4, 6, 8, 10, 12, 14, 16, PP, P, M, G, GG, EGG";
        }
    } else {
        divAlerta.style.display = 'block';
        infoGrade.style.display = 'none';
    }
}

async function salvarProduto() {
    const payload = {
        nome: document.getElementById('prod_nome').value,
        tipo: document.getElementById('prod_tipo').value,
        categoria_id: document.getElementById('prod_categoria').value,
        quantidade_estoque: document.getElementById('prod_qtd').value || 0,
        alerta_minimo: document.getElementById('prod_tipo').value === 'MATERIAL' ? document.getElementById('prod_alerta').value : null
    };

    const res = await fetch(`${API_URL}/api/cadastros/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        alert("PRODUTO CADASTRADO!");
        formProduto();
    }
}

async function renderizarFormPatrimonio() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Busca produtos e locais para preencher os selects
    const [resProdutos, resLocais] = await Promise.all([
        fetch(`${API_URL}/api/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`${API_URL}/api/catalogo/locais`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    ]);

    const produtos = await resProdutos.json();
    const locais = await resLocais.json();

    conteudo.innerHTML = `
        <div class="card-form">
            <h2>CADASTRAR PATRIMÔNIO (ENTRADA)</h2>
            
            <label>PRODUTO:</label>
            <select id="pat_prod_id" class="input-field">
                <option value="">SELECIONE O PRODUTO</option>
                ${produtos.filter(p => p.tipo === 'PATRIMONIO').map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
            </select>

            <label>LOCAL DE DESTINO (ENTRADA):</label>
            <select id="pat_local_id" class="input-field">
                ${locais.map(l => `<option value="${l.id}" ${l.nome.toUpperCase() === 'DEPÓSITO CENTRAL' ? 'selected' : ''}>${l.nome}</option>`).join('')}
            </select>

            <label>NÚMERO DA NOTA FISCAL:</label>
            <input type="text" id="pat_nota_fiscal" class="input-field" placeholder="000.000.000">

            <label>QUANTIDADE DE ITENS:</label>
            <input type="number" id="pat_qtd" class="input-field" placeholder="EX: 5" min="1" oninput="gerarInputsPlaquetas()">

            <div id="lista_plaquetas" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                </div>

            <button onclick="salvarPatrimonioLote()" id="btn_salvar_pat" style="background: var(--success); margin-top: 20px; display:none; width: 100%;">
                CONCLUIR CADASTRO NO SISTEMA
            </button>
        </div>
    `;
}

function gerarInputsPlaquetas() {
    const qtd = document.getElementById('pat_qtd').value;
    const container = document.getElementById('lista_plaquetas');
    const btn = document.getElementById('btn_salvar_pat');
    container.innerHTML = '';

    if (qtd > 0 && qtd <= 100) { // Limite de 100 por vez para segurança
        btn.style.display = 'block';
        for (let i = 0; i < qtd; i++) {
            container.innerHTML += `
                <div class="input-group-plaqueta">
                    <small>PLAQUETA ${i + 1}</small>
                    <input type="text" class="input-plaqueta" placeholder="Nº SÉRIE" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            `;
        }
    } else {
        btn.style.display = 'none';
        if(qtd > 100) alert("POR FAVOR, CADASTRE NO MÁXIMO 100 ITENS POR VEZ.");
    }
}

async function salvarPatrimonioLote() {
    const produto_id = document.getElementById('pat_prod_id').value;
    const local_id = document.getElementById('pat_local_id').value;
    const nota_fiscal = document.getElementById('pat_nota_fiscal').value;
    const inputs = document.querySelectorAll('.input-plaqueta');
    
    const numeros_serie = Array.from(inputs)
        .map(i => i.value.trim())
        .filter(v => v !== '');

    if (!produto_id || !local_id || !nota_fiscal || numeros_serie.length === 0) {
        return alert("POR FAVOR, PREENCHA TODOS OS CAMPOS E OS NÚMEROS DE SÉRIE!");
    }

    if (numeros_serie.length < document.getElementById('pat_qtd').value) {
        return alert("EXISTEM CAMPOS DE PLAQUETA VAZIOS!");
    }

    try {
        const res = await fetch(`${API_URL}/api/cadastros/patrimonio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                produto_id,
                local_id,
                nota_fiscal,
                numeros_serie
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            renderizarFormPatrimonio(); // Limpa/Reseta o formulário
        } else {
            alert("ERRO: " + data.error);
        }
    } catch (error) {
        console.error(error);
        alert("FALHA AO COMUNICAR COM O SERVIDOR.");
    }
}

// --- FUNÇÕES DE CADASTROS BÁSICOS ---

async function telaCadastrosBase() {
    const container = document.getElementById('app-content');
    
    let html = `
        <button onclick="carregarDashboard()" style="width: auto; background: #64748b; margin-bottom: 20px;">⬅ VOLTAR</button>
        <h2 style="color: white; text-align: center; margin-bottom: 20px;">CADASTROS BÁSICOS DO SISTEMA</h2>
        
        <div class="grid-menu">
            <button class="btn-grande" onclick="formGenerico('categorias', 'CATEGORIA')">
                <i>📁</i><span>CADASTRAR CATEGORIA</span>
            </button>
            <button class="btn-grande" onclick="formGenerico('locais', 'LOCAL')">
                <i>📍</i><span>CADASTRAR LOCAL</span>
            </button>
            <button class="btn-grande" onclick="formGenerico('setores', 'SETOR')">
                <i>🏢</i><span>CADASTRAR SETOR</span>
            </button>
            <button class="btn-grande" onclick="formProduto()">
                <i>📦</i><span>CADASTRAR PRODUTO</span>
            </button>
            <button class="btn-grande" onclick="formPatrimonioLote()">
                <i>🏷️</i><span>PATRIMÔNIOS (LOTE)</span>
            </button>
        </div>
        <div id="area-formulario-cadastro" style="margin-top: 30px;"></div>
    `;
    container.innerHTML = html;
}

function formGenerico(tabela, label) {
    const area = document.getElementById('area-formulario-cadastro');
    area.innerHTML = `
        <div class="card-login" style="max-width: 100%;">
            <h3>NOVO CADASTRO: ${label}</h3>
            <input type="text" id="nome_generico" placeholder="NOME DO(A) ${label}">
            <button onclick="salvarGenerico('${tabela}')" style="background: var(--success); margin-top: 10px;">SALVAR</button>
        </div>
    `;
}

async function salvarGenerico(tabela) {
    const nome = document.getElementById('nome_generico').value;
    if(!nome) return alert("PREENCHA O NOME!");

    const res = await fetch(`${API_URL}/api/cadastros/basico/${tabela}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ nome })
    });

    if(res.ok) {
        alert("CADASTRADO COM SUCESSO!");
        document.getElementById('nome_generico').value = '';
    }
}

async function formProduto() {
    const area = document.getElementById('area-formulario-cadastro');
    const resCat = await fetch(`${API_URL}/api/cadastros/categorias`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const categorias = await resCat.json();

    // Filtramos para que a categoria 'UNIFORMES' não apareça na criação de novos produtos
    const categoriasFiltradas = categorias.filter(c => c.nome !== 'UNIFORMES');

    area.innerHTML = `
        <div class="card-login" style="max-width: 100%;">
            <h3>NOVO MATERIAL</h3>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 15px;">
                * Uniformes são itens fixos e não podem ser cadastrados manualmente.
            </p>
            
            <input type="text" id="prod_nome" placeholder="NOME DO PRODUTO">
            
            <select id="prod_tipo" class="input-grade" style="width: 100%; height: 50px; margin-top:10px;">
                <option value="MATERIAL">MATERIAL (LIMPEZA, ESCRITÓRIO, ETC)</option>
                <option value="UNIFORMES" disabled>UNIFORME (BLOQUEADO - ITEM FIXO)</option>
            </select>

            <select id="prod_categoria" class="input-grade" style="width: 100%; height: 50px; margin-top:10px;">
                <option value="">SELECIONE UMA CATEGORIA</option>
                ${categoriasFiltradas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>

            <input type="number" id="prod_qtd" placeholder="ESTOQUE INICIAL" style="margin-top: 10px;">
            
            <div id="box_alerta">
                <input type="number" id="prod_alerta" placeholder="ALERTA MÍNIMO" style="margin-top: 10px;">
            </div>

            <div style="margin-top:20px; text-align:right;">
                <button onclick="salvarNovoProduto()" style="padding:10px 20px; background:green; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    SALVAR MATERIAL
                </button>
            </div>
        </div>
    `;
}

function monitorarTipoProduto() {
    const tipo = document.getElementById('prod_tipo').value;
    const nome = document.getElementById('prod_nome').value.toUpperCase();
    const boxAlerta = document.getElementById('box_alerta');
    const boxGrade = document.getElementById('box_grade');
    const labelGrade = document.getElementById('label_grade');

    if (tipo === 'UNIFORMES') {
        boxAlerta.style.display = 'none';
        boxGrade.style.display = 'block';
        labelGrade.innerText = nome.includes('TENIS') ? "CALÇADOS (22 ao 43)" : "VESTUÁRIO (2 ao 16, PP ao XGG)";
    } else {
        boxAlerta.style.display = 'block';
        boxGrade.style.display = 'none';
    }
}

async function salvarProduto() {
    const payload = {
        nome: document.getElementById('prod_nome').value,
        tipo: document.getElementById('prod_tipo').value,
        categoria_id: document.getElementById('prod_categoria').value,
        quantidade_estoque: document.getElementById('prod_qtd').value || 0,
        alerta_minimo: document.getElementById('prod_tipo').value === 'MATERIAL' ? document.getElementById('prod_alerta').value : null
    };

    if(!payload.nome || !payload.categoria_id) return alert("PREENCHA NOME E CATEGORIA!");

    const res = await fetch(`${API_URL}/api/cadastros/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        alert("PRODUTO(S) CADASTRADO(S)!");
        telaCadastrosBase();
    }
}

function abrirDialogoEntrada() {
    // Busca o perfil diretamente do localStorage
    const perfil = localStorage.getItem('perfil');

    // Verifica permissão
    if (!perfil) {
        alert("Sessão expirada. Por favor, faça login novamente.");
        return;
    }

    if (['escola', 'logistica'].includes(perfil.toLowerCase())) {
        return alert("ACESSO NEGADO: SEU PERFIL NÃO POSSUI PERMISSÃO PARA ENTRADA DE ESTOQUE.");
    }

    // Criação do modal de escolha
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:1000;";
    
    modal.innerHTML = `
        <div class="modal-box" style="background:white; padding:30px; border-radius:8px; text-align:center; min-width:300px;">
            <h3 style="margin-top:0;">TIPO DE ENTRADA</h3>
            <p>Selecione como deseja registrar a entrada:</p>
            <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                <button onclick="this.closest('.modal-overlay').remove(); telaEntradaManual();" 
                        style="padding:15px; background:#2196F3; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                    📥 ENTRADA MANUAL (ITEM POR ITEM)
                </button>
                <button onclick="this.closest('.modal-overlay').remove(); alert('Função via arquivo em desenvolvimento');" 
                        style="padding:15px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                    📄 IMPORTAR VIA ARQUIVO (CSV/EXCEL)
                </button>
                <button onclick="this.closest('.modal-overlay').remove()" 
                        style="padding:10px; background:#f44336; color:white; border:none; border-radius:5px; cursor:pointer;">
                    CANCELAR
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function telaEntradaManual() {
    const appContent = document.getElementById('app-content');
    
    try {
        // Busca produtos e categorias para o formulário
        const resProd = await fetch(`${API_URL}/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const produtos = await resProd.json();

        appContent.innerHTML = `
            <div class="container-entrada">
                <h2>📦 ENTRADA MANUAL DE ESTOQUE</h2>
                <div class="card" style="padding:20px; background:#f9f9f9; border-radius:8px;">
                    <div style="margin-bottom:15px;">
                        <label>Observações/Motivo:</label>
                        <input type="text" id="ent_obs" placeholder="Ex: Compra direta, Doação, etc." style="width:100%; padding:10px;">
                    </div>
                    
                    <div id="lista-itens-entrada">
                        <div class="item-linha" style="display:flex; gap:10px; margin-bottom:10px;">
                            <select class="ent_produto" style="flex:2; padding:8px;">
                                <option value="">Selecione o Produto...</option>
                                ${produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                            </select>
                            <input type="text" class="ent_tamanho" placeholder="TAM" style="width:60px; padding:8px;">
                            <input type="number" class="ent_qtd" placeholder="QTD" style="width:80px; padding:8px;">
                        </div>
                    </div>
                    
                    <button onclick="adicionarLinhaEntrada()" style="background:#666; color:white; padding:5px 10px; margin-bottom:20px;">+ ADICIONAR OUTRO ITEM</button>
                    
                    <div style="text-align:right;">
                        <button onclick="renderizarMenu()" style="background:#ccc; padding:10px 20px;">VOLTAR</button>
                        <button onclick="processarEntradaEstoque()" style="background:green; color:white; padding:10px 30px; font-weight:bold;">FINALIZAR ENTRADA</button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar dados para entrada.");
    }
}

function adicionarLinhaEntrada() {
    const container = document.getElementById('lista-itens-entrada');
    const primeiraLinha = container.querySelector('.item-linha');
    const novaLinha = primeiraLinha.cloneNode(true);
    novaLinha.querySelectorAll('input').forEach(i => i.value = '');
    container.appendChild(novaLinha);
}

async function processarEntradaEstoque() {
    const obs = document.getElementById('ent_obs').value;
    const linhas = document.querySelectorAll('.item-linha');
    const itens = [];

    linhas.forEach(linha => {
        const produto_id = linha.querySelector('.ent_produto').value;
        const tamanho = linha.querySelector('.ent_tamanho').value;
        const quantidade = linha.querySelector('.ent_qtd').value;

        if (produto_id && quantidade) {
            itens.push({ produto_id: parseInt(produto_id), tamanho, quantidade: parseInt(quantidade) });
        }
    });

    if (itens.length === 0) return alert("Adicione pelo menos um item!");

    const payload = {
        local_id: parseInt(localStorage.getItem('local_id')), // ID 36, 37 ou 38 automático do login
        tipo_historico: 'ENTRADA',
        observacoes: obs,
        itens: itens
    };

    try {
        const res = await fetch(`${API_URL}/estoque/entrada`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Erro ao processar entrada");
        
        alert("ESTOQUE ATUALIZADO COM SUCESSO!");
        renderizarMenu();
    } catch (err) {
        alert(err.message);
    }
}

async function renderizarGradeUniformes() {
    document.querySelector('.modal-overlay')?.remove();
    const conteudo = document.getElementById('conteudo-dinamico');
    
    const [resProd, resLoc] = await Promise.all([
        fetch(`${API_URL}/api/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`${API_URL}/api/catalogo/locais`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    ]);
    
    const produtos = (await resProd.json()).filter(p => p.tipo === 'UNIFORME');
    const locais = await resLoc.json();

    // Separar Tênis para ser a última coluna
    const listaProdutos = [...produtos.filter(p => !p.nome.includes('TENIS')), ...produtos.filter(p => p.nome.includes('TENIS'))];
    const tamanhos = ["02", "04", "06", "08", "10", "12", "14", "P", "M", "G", "GG", "28", "30", "32", "34", "36", "38", "40", "42"];

    let html = `
        <div class="card-entrada">
            <h2>ENTRADA DE UNIFORMES</h2>
            <div class="form-header-estoque">
                <input type="text" id="ent_nf" placeholder="Nº NOTA FISCAL" class="input-field">
                <select id="ent_local" class="input-field">
                    ${locais.map(l => `<option value="${l.id}" ${l.nome === 'DEPÓSITO CENTRAL' ? 'selected' : ''}>${l.nome}</option>`).join('')}
                </select>
            </div>
            
            <div class="table-container-fixed">
                <table class="grid-uniformes">
                    <thead>
                        <tr>
                            <th class="sticky-col">TAMANHO</th>
                            ${listaProdutos.map(p => `<th>${p.nome}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${tamanhos.map(tam => `
                            <tr>
                                <td class="sticky-col"><strong>${tam}</strong></td>
                                ${listaProdutos.map(p => {
                                    // Bloquear tamanhos de roupa para tênis e vice-versa
                                    const isSapato = p.nome.includes('TENIS');
                                    const tamNum = parseInt(tam);
                                    const disabled = (isSapato && isNaN(tamNum)) || (!isSapato && !isNaN(tamNum) && tamNum > 20) ? 'disabled' : '';
                                    return `<td><input type="number" class="input-grid" data-prod="${p.id}" data-tam="${tam}" min="0" ${disabled}></td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button onclick="salvarEntradaLote('UNIFORME')" class="btn-success">CONFIRMAR ENTRADA NO ESTOQUE</button>
        </div>
    `;
    conteudo.innerHTML = html;
}

async function renderizarListaMaterial() {
    document.querySelector('.modal-overlay')?.remove();
    const conteudo = document.getElementById('conteudo-dinamico');
    
    const [resProd, resLoc] = await Promise.all([
        fetch(`${API_URL}/api/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`${API_URL}/api/catalogo/locais`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    ]);
    
    const produtos = (await resProd.json()).filter(p => p.tipo === 'MATERIAL').sort((a,b) => a.nome.localeCompare(b.nome));
    const locais = await resLoc.json();

    conteudo.innerHTML = `
        <div class="card-entrada">
            <h2>ENTRADA DE MATERIAIS</h2>
            <div class="form-header-estoque">
                <input type="text" id="ent_nf" placeholder="Nº NOTA FISCAL" class="input-field">
                <select id="ent_local" class="input-field">
                    ${locais.map(l => `<option value="${l.id}" ${l.nome === 'DEPÓSITO CENTRAL' ? 'selected' : ''}>${l.nome}</option>`).join('')}
                </select>
            </div>
            <div class="lista-material-scroll">
                ${produtos.map(p => `
                    <div class="item-material-entrada">
                        <input type="checkbox" onchange="toggleInputMaterial(this)">
                        <span>${p.nome}</span>
                        <input type="number" class="input-material-qtd" data-prod="${p.id}" placeholder="QTD" disabled>
                    </div>
                `).join('')}
            </div>
            <button onclick="salvarEntradaLote('MATERIAL')" class="btn-success">CONFIRMAR ENTRADA NO ESTOQUE</button>
        </div>
    `;
}

function toggleInputMaterial(cb) {
    const input = cb.parentElement.querySelector('.input-material-qtd');
    input.disabled = !cb.checked;
    if(cb.checked) input.focus();
}

async function renderizarHistorico() {
    const conteudo = document.getElementById('conteudo-dinamico');
    const res = await fetch(`${API_URL}/api/cadastros/historico`, { 
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
    });
    const dados = await res.json();

    conteudo.innerHTML = `
        <div class="card-historico">
            <h2>AUDITORIA DE MOVIMENTAÇÕES (HISTÓRICO)</h2>
            <p><small>* Duplo clique em um registro para ver o detalhamento dos itens.</small></p>
            <table class="tabela-estilizada">
                <thead>
                    <tr>
                        <th>DATA/HORA</th>
                        <th>USUÁRIO</th>
                        <th>TIPO</th>
                        <th>QTD TOTAL</th>
                        <th>OBSERVAÇÕES</th>
                        <th>LOCAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.map(h => `
                        <tr ondblclick="verDetalhesHistorico(${h.id})" title="Duplo clique para detalhes">
                            <td>${new Date(h.data).toLocaleString()}</td>
                            <td>${h.usuario_nome}</td>
                            <td><span class="badge-${h.acao.toLowerCase()}">${h.acao}</span></td>
                            <td>${h.quantidade_total}</td>
                            <td>${h.observacoes || '-'}</td>
                            <td>${h.local_nome || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function verDetalhesHistorico(id) {
    const res = await fetch(`${API_URL}/api/cadastros/historico/${id}/detalhes`, { 
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
    });
    const detalhes = await res.json();

    let listagem = detalhes.map(d => `
        <tr>
            <td>${d.produto_nome}</td>
            <td>${d.tamanho || 'N/A'}</td>
            <td>${d.quantidade}</td>
        </tr>
    `).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box large">
            <h3>DETALHAMENTO DA MOVIMENTAÇÃO #${id}</h3>
            <table class="tabela-estilizada">
                <thead><tr><th>PRODUTO</th><th>TAMANHO</th><th>QTD</th></tr></thead>
                <tbody>${listagem}</tbody>
            </table>
            <button onclick="this.parentElement.parentElement.remove()" class="btn-block">FECHAR</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function renderizarFormSolicitacao() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Filtro de tipos baseado no perfil
    let tipoPermitido = '';
    if (usuario.perfil === 'escola') tipoPermitido = 'UNIFORME';
    if (usuario.perfil === 'logistica') tipoPermitido = 'PATRIMONIO';
    if (usuario.perfil === 'admin') tipoPermitido = 'MATERIAL'; // Admin pode tudo, mas aqui focamos em Material

    const resProd = await fetch(`${API_URL}/api/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const produtos = (await resProd.json()).filter(p => p.tipo === tipoPermitido);

    conteudo.innerHTML = `
        <div class="card-entrada">
            <h2>SOLICITAR ${tipoPermitido}S</h2>
            <p>Selecione os itens e quantidades abaixo:</p>
            
            <div class="lista-solicitacao">
                ${produtos.map(p => `
                    <div class="item-material-entrada">
                        <input type="checkbox" onchange="toggleInputMaterial(this)">
                        <span>${p.nome} ${tipoPermitido === 'PATRIMONIO' ? '(UNITÁRIO)' : ''}</span>
                        <input type="number" class="input-solicitacao-qtd" 
                               data-prod="${p.id}" 
                               value="${tipoPermitido === 'PATRIMONIO' ? 1 : ''}" 
                               ${tipoPermitido === 'PATRIMONIO' ? 'readonly' : 'disabled'} 
                               placeholder="QTD">
                    </div>
                `).join('')}
            </div>
            
            <button onclick="enviarSolicitacao('${tipoPermitido}')" class="btn-block" style="margin-top:20px">
                ENVIAR SOLICITAÇÃO PARA ANÁLISE
            </button>
        </div>
    `;
}

async function enviarSolicitacao(tipo) {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const itens = [];
    document.querySelectorAll('.item-material-entrada').forEach(div => {
        const cb = div.querySelector('input[type="checkbox"]');
        const input = div.querySelector('.input-solicitacao-qtd');
        if (cb.checked) {
            itens.push({
                produto_id: input.dataset.prod,
                quantidade: parseInt(input.value)
            });
        }
    });

    if (itens.length === 0) return alert("SELECIONE AO MENOS UM ITEM.");

    const res = await fetch(`${API_URL}/api/pedidos/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ 
            local_destino_id: usuario.local_id, // Local vinculado ao usuário (escola/setor)
            itens: itens 
        })
    });

    if (res.ok) {
        alert("SOLICITAÇÃO ENVIADA! AGUARDE A AUTORIZAÇÃO DO ADMIN.");
        renderizarHome();
    }
}

async function renderizarFormSolicitacao() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Filtro de tipos baseado no perfil
    let tipoPermitido = '';
    if (usuario.perfil === 'escola') tipoPermitido = 'UNIFORME';
    if (usuario.perfil === 'logistica') tipoPermitido = 'PATRIMONIO';
    if (usuario.perfil === 'admin') tipoPermitido = 'MATERIAL'; // Admin pode tudo, mas aqui focamos em Material

    const resProd = await fetch(`${API_URL}/api/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const produtos = (await resProd.json()).filter(p => p.tipo === tipoPermitido);

    conteudo.innerHTML = `
        <div class="card-entrada">
            <h2>SOLICITAR ${tipoPermitido}S</h2>
            <p>Selecione os itens e quantidades abaixo:</p>
            
            <div class="lista-solicitacao">
                ${produtos.map(p => `
                    <div class="item-material-entrada">
                        <input type="checkbox" onchange="toggleInputMaterial(this)">
                        <span>${p.nome} ${tipoPermitido === 'PATRIMONIO' ? '(UNITÁRIO)' : ''}</span>
                        <input type="number" class="input-solicitacao-qtd" 
                               data-prod="${p.id}" 
                               value="${tipoPermitido === 'PATRIMONIO' ? 1 : ''}" 
                               ${tipoPermitido === 'PATRIMONIO' ? 'readonly' : 'disabled'} 
                               placeholder="QTD">
                    </div>
                `).join('')}
            </div>
            
            <button onclick="enviarSolicitacao('${tipoPermitido}')" class="btn-block" style="margin-top:20px">
                ENVIAR SOLICITAÇÃO PARA ANÁLISE
            </button>
        </div>
    `;
}

async function enviarSolicitacao(tipo) {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const itens = [];
    document.querySelectorAll('.item-material-entrada').forEach(div => {
        const cb = div.querySelector('input[type="checkbox"]');
        const input = div.querySelector('.input-solicitacao-qtd');
        if (cb.checked) {
            itens.push({
                produto_id: input.dataset.prod,
                quantidade: parseInt(input.value)
            });
        }
    });

    if (itens.length === 0) return alert("SELECIONE AO MENOS UM ITEM.");

    const res = await fetch(`${API_URL}/api/pedidos/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ 
            local_destino_id: usuario.local_id, // Local vinculado ao usuário (escola/setor)
            itens: itens 
        })
    });

    if (res.ok) {
        alert("SOLICITAÇÃO ENVIADA! AGUARDE A AUTORIZAÇÃO DO ADMIN.");
        renderizarHome();
    }
}

async function renderizarGestaoPedidos() {
    const conteudo = document.getElementById('conteudo-dinamico');
    const res = await fetch(`${API_URL}/api/pedidos/status/PENDENTE`, { 
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
    });
    const pedidos = await res.json();

    conteudo.innerHTML = `
        <div class="card-historico">
            <h2>PEDIDOS AGUARDANDO AUTORIZAÇÃO</h2>
            <table class="tabela-estilizada">
                <thead>
                    <tr>
                        <th>DATA</th>
                        <th>SOLICITANTE</th>
                        <th>DESTINO</th>
                        <th>AÇÕES</th>
                    </tr>
                </thead>
                <tbody>
                    ${pedidos.map(p => `
                        <tr>
                            <td>${new Date(p.data_criacao).toLocaleDateString()}</td>
                            <td>${p.solicitante}</td>
                            <td>${p.local_nome}</td>
                            <td>
                                <button onclick="verDetalhesPedido(${p.id})" class="btn-info">VER ITENS</button>
                                <button onclick="autorizarPedido(${p.id})" class="btn-success">AUTORIZAR SAÍDA</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function renderizarSeletorPlaquetas(produtoId, qtdNecessaria) {
    const res = await fetch(`${API_URL}/api/catalogo/patrimonios/disponiveis/${produtoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const disponiveis = await res.json();

    if (disponiveis.length < qtdNecessaria) {
        return `<p style="color:red">⚠️ ESTOQUE INSUFICIENTE (DISPONÍVEL: ${disponiveis.length})</p>`;
    }

    return `
        <div class="seletor-plaquetas">
            <p><small>Selecione ${qtdNecessaria} plaqueta(s):</small></p>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px;">
                ${disponiveis.map(p => `
                    <label style="font-size:12px; border:1px solid #ccc; padding:2px; display:block">
                        <input type="checkbox" class="chk-patrimonio" data-id="${p.id}" onchange="validarLimiteSelecao(this, ${qtdNecessaria})"> 
                        ${p.numero_serie}
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

function validarLimiteSelecao(el, max) {
    const container = el.closest('.seletor-plaquetas');
    const marcados = container.querySelectorAll('input:checked').length;
    if (marcados > max) {
        el.checked = false;
        alert(`VOCÊ SÓ PODE SELECIONAR ${max} PLAQUETAS PARA ESTE ITEM.`);
    }
}

async function autorizarRealocarPatrimonio(id) {
    const selecionados = Array.from(document.querySelectorAll('.chk-patrimonio:checked')).map(cb => parseInt(cb.dataset.id));
    
    // Validação: verificar se todos os itens de patrimônio tiveram suas plaquetas selecionadas
    const totalNecessario = Array.from(document.querySelectorAll('.seletor-plaquetas')).length; // (Simp. lógica)
    
    try {
        const res = await fetch(`${API_URL}/api/pedidos/autorizar/${id}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ patrimonios_selecionados: selecionados })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            document.querySelector('.modal-overlay').remove();
            renderizarGestaoPedidos(); // Atualiza a lista principal
        } else {
            alert("ERRO: " + data.error);
        }
    } catch (error) {
        alert("FALHA AO PROCESSAR AUTORIZAÇÃO.");
    }
}

async function renderizarPedidosEmAndamento() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const conteudo = document.getElementById('conteudo-dinamico');
    
    const res = await fetch(`${API_URL}/api/pedidos/em-andamento`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const pedidos = await res.json();

    // Filtro adicional para Escola: só vê o que está EM TRANSITO para ela
    let pedidosFiltrados = pedidos;
    if (usuario.perfil === 'escola') {
        pedidosFiltrados = pedidos.filter(p => p.status === 'EM TRANSITO' && p.local_destino_id === usuario.local_id);
    }

    conteudo.innerHTML = `
        <div class="card-historico">
            <h2>🚚 PEDIDOS EM ANDAMENTO</h2>
            <table class="tabela-estilizada">
                <thead>
                    <tr>
                        <th>DATA</th><th>PEDIDO</th><th>DESTINO</th><th>STATUS</th><th>AÇÃO</th>
                    </tr>
                </thead>
                <tbody>
                    ${pedidosFiltrados.map(p => `
                        <tr>
                            <td>${new Date(p.data_criacao).toLocaleDateString()}</td>
                            <td>#${p.id}</td>
                            <td>${p.local_nome}</td>
                            <td><span class="badge-${p.status.toLowerCase().replace(/ /g, '-')}">${p.status}</span></td>
                            <td>${gerarBotaoAcao(p, usuario)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function gerarBotaoAcao(pedido, usuario) {
    const p = pedido.status;
    const u = usuario.perfil.toLowerCase();

    // Lógica do ESTOQUE
    if (u === 'estoque' || u === 'admin') {
        if (p === 'AUTORIZADO') return `<button onclick="alterarStatusPedido(${pedido.id}, 'iniciar-separacao')" class="btn-info">INICIAR SEPARAÇÃO</button>`;
        if (p === 'EM SEPARAÇÃO') return `<button onclick="abrirModalRemessa(${pedido.id})" class="btn-success">FINALIZAR REMESSA</button>`;
    }

    // Lógica da LOGÍSTICA
    if (u === 'logistica' || u === 'admin') {
        if (p === 'PRONTO PARA COLETA' || p === 'REMESSA PRONTA PARA COLETA') {
            return `<button onclick="alterarStatusPedido(${pedido.id}, 'coletar')" class="btn-warning">COLETAR / EM TRÂNSITO</button>`;
        }
    }

    // Lógica da ESCOLA
    if (u === 'escola') {
        if (p === 'EM TRANSITO') return `<button onclick="alterarStatusPedido(${pedido.id}, 'confirmar-entrega')" class="btn-success">CONFIRMAR RECEBIMENTO</button>`;
    }

    return `<button onclick="verLogPedido(${pedido.id})" class="btn-log">VER LOG</button>`;
}

async function alterarStatusPedido(id, rota) {
    if (!confirm("DESEJA ATUALIZAR O STATUS DESTE PEDIDO?")) return;
    const res = await fetch(`${API_URL}/api/pedidos/${id}/${rota}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
        alert("STATUS ATUALIZADO!");
        renderizarPedidosEmAndamento();
    }
}

async function abrirModalRemessa(pedidoId) {
    const res = await fetch(`${API_URL}/api/pedidos/${pedidoId}/itens`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const itens = await res.json();

    let html = `
        <div class="modal-overlay">
            <div class="modal-box large">
                <h3>CONFERÊNCIA DE REMESSA - PEDIDO #${pedidoId}</h3>
                <p>Informe as quantidades que estão saindo agora:</p>
                <table class="tabela-estilizada">
                    <thead><tr><th>PRODUTO</th><th>PEDIDO</th><th>JÁ ENVIADO</th><th>NESTA REMESSA</th></tr></thead>
                    <tbody>
                        ${itens.map(i => {
                            const faltante = i.quantidade_solicitada - (i.quantidade_total_enviada || 0);
                            return `
                            <tr>
                                <td>${i.produto_nome} ${i.tamanho || ''}</td>
                                <td>${i.quantidade_solicitada}</td>
                                <td>${i.quantidade_total_enviada || 0}</td>
                                <td><input type="number" class="input-remessa" data-prod="${i.produto_id}" data-tam="${i.tamanho || ''}" max="${faltante}" value="${faltante}" style="width:60px"></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <button onclick="finalizarRemessaEstoque(${pedidoId})" class="btn-success">GERAR REMESSA E ATUALIZAR STATUS</button>
                <button onclick="document.querySelector('.modal-overlay').remove()" class="btn-cancel">CANCELAR</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function finalizarRemessaEstoque(pedidoId) {
    const inputs = document.querySelectorAll('.input-remessa');
    const itens_remessa = Array.from(inputs).map(inp => ({
        produto_id: inp.dataset.prod,
        tamanho: inp.dataset.tam || null,
        qtd_enviada: parseInt(inp.value) || 0
    })).filter(i => i.qtd_enviada > 0);

    const res = await fetch(`${API_URL}/api/pedidos/${pedidoId}/finalizar-remessa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ itens_remessa })
    });

    if (res.ok) {
        document.querySelector('.modal-overlay').remove();
        renderizarPedidosEmAndamento();
    }
}

async function alternarAbaPedido(aba, id) {
    const container = document.getElementById('container-aba-conteudo');
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${aba}`).classList.add('active');

    if (aba === 'itens') {
        const res = await fetch(`${API_URL}/api/pedidos/${id}/itens`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const itens = await res.json();
        
        container.innerHTML = `
            <table class="tabela-estilizada">
                <thead>
                    <tr><th>PRODUTO</th><th>SOLICITADO</th><th>JÁ ENVIADO</th></tr>
                </thead>
                <tbody>
                    ${itens.map(i => `
                        <tr>
                            <td>${i.produto_nome} ${i.tamanho || ''}</td>
                            <td>${i.quantidade_solicitada}</td>
                            <td>${i.quantidade_total_enviada || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        // ABA DE LOG
        const res = await fetch(`${API_URL}/api/pedidos/${id}/log`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const logs = await res.json();

        if (logs.length === 0) {
            container.innerHTML = "<p style='padding:20px'>NENHUM REGISTRO DE MUDANÇA ENCONTRADO.</p>";
            return;
        }

        container.innerHTML = `
            <div class="timeline-log">
                ${logs.map(l => `
                    <div class="log-entry">
                        <div class="log-date">${new Date(l.data_hora).toLocaleString()}</div>
                        <div class="log-content">
                            <strong>${l.usuario_nome} (${l.usuario_perfil})</strong> alterou de 
                            <span class="status-old">${l.status_anterior || 'INÍCIO'}</span> para 
                            <span class="status-new">${l.status_novo}</span>
                            ${l.observacao ? `<br><small>Obs: ${l.observacao}</small>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

async function renderizarDashboardAdmin() {
    const containerDashboard = document.getElementById('dashboard-estatisticas');
    if (!containerDashboard) return; // Garante que só executa se o elemento existir

    try {
        const res = await fetch(`${API_URL}/api/pedidos/dashboard/resumo`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await res.json();

        containerDashboard.innerHTML = `
            <div class="dashboard-grid">
                <div class="card-dash dash-autorizado" onclick="filtrarPedidosPorStatus('AUTORIZADO')">
                    <span class="dash-num">${dados.AUTORIZADO}</span>
                    <span class="dash-label">AGUARDANDO ESTOQUE</span>
                </div>
                <div class="card-dash dash-separacao" onclick="filtrarPedidosPorStatus('EM SEPARAÇÃO')">
                    <span class="dash-num">${dados.SEPARACAO}</span>
                    <span class="dash-label">EM SEPARAÇÃO</span>
                </div>
                <div class="card-dash dash-coleta" onclick="filtrarPedidosPorStatus('COLETA')">
                    <span class="dash-num">${dados.PRONTO_COLETA}</span>
                    <span class="dash-label">PRONTOS P/ COLETA</span>
                </div>
                <div class="card-dash dash-transito" onclick="filtrarPedidosPorStatus('EM TRANSITO')">
                    <span class="dash-num">${dados.EM_TRANSITO}</span>
                    <span class="dash-label">EM TRÂNSITO (RUA)</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

// Função para chamar ao carregar a tela de Pedidos em Andamento
async function renderizarPedidosEmAndamentoComDash() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Cria o esqueleto da página com o local para o dashboard e para a tabela
    conteudo.innerHTML = `
        <div id="dashboard-estatisticas"></div>
        <div id="lista-pedidos-andamento">
            <div class="loader">CARREGANDO LISTAGEM...</div>
        </div>
    `;

    // Carrega os dois componentes
    await renderizarDashboardAdmin();
    await atualizarTabelaPedidos();
}

function renderizarTelaRelatorios() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Define datas padrão (início do mês atual até hoje)
    const hoje = new Date().toISOString().split('T')[0];
    const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    conteudo.innerHTML = `
        <div class="card-entrada">
            <h2>📊 RELATÓRIO DE MOVIMENTAÇÃO DE SAÍDAS</h2>
            <div class="filtro-relatorio">
                <div class="campo-filtro">
                    <label>DATA INICIAL:</label>
                    <input type="date" id="rel_inicio" value="${primeiroDia}" class="input-field">
                </div>
                <div class="campo-filtro">
                    <label>DATA FINAL:</label>
                    <input type="date" id="rel_fim" value="${hoje}" class="input-field">
                </div>
                <button onclick="gerarRelatorioSaida()" class="btn-success" style="margin-top:20px">🔍 GERAR RELATÓRIO</button>
            </div>
            
            <div id="resultado-relatorio" style="margin-top:30px;">
                </div>
        </div>
    `;
}

async function gerarRelatorioSaida() {
    const inicio = document.getElementById('rel_inicio').value;
    const fim = document.getElementById('rel_fim').value;
    const container = document.getElementById('resultado-relatorio');

    if (!inicio || !fim) return alert("SELECIONE O PERÍODO!");

    container.innerHTML = '<div class="loader">PROCESSANDO DADOS...</div>';

    const res = await fetch(`${API_URL}/api/pedidos/relatorios/saidas?inicio=${inicio}&fim=${fim}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const dados = await res.json();

    if (dados.length === 0) {
        container.innerHTML = "<p>NENHUMA MOVIMENTAÇÃO ENCONTRADA NESTE PERÍODO.</p>";
        return;
    }

    let tabelaHtml = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <span><strong>ITENS ENCONTRADOS:</strong> ${dados.length}</span>
            <button onclick="exportarPDFRelatorio()" class="btn-info-sm" style="background:#e74c3c">📥 BAIXAR PDF</button>
        </div>
        <table class="tabela-estilizada" id="tabela-relatorio-dados">
            <thead>
                <tr>
                    <th>DATA</th>
                    <th>PEDIDO</th>
                    <th>DESTINO</th>
                    <th>PRODUTO</th>
                    <th>TAM</th>
                    <th>QTD</th>
                </tr>
            </thead>
            <tbody>
                ${dados.map(d => `
                    <tr>
                        <td>${new Date(d.data).toLocaleDateString()}</td>
                        <td>#${d.pedido_id}</td>
                        <td>${d.destino}</td>
                        <td>${d.produto}</td>
                        <td>${d.tamanho || '-'}</td>
                        <td>${d.quantidade}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = tabelaHtml;
    // Salva os dados globalmente para o exportador de PDF
    window.dadosUltimoRelatorio = dados;
}

function exportarPDFRelatorio() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dados = window.dadosUltimoRelatorio;
    const inicio = document.getElementById('rel_inicio').value;
    const fim = document.getElementById('rel_fim').value;

    // Cabeçalho do PDF
    doc.setFontSize(18);
    doc.text("Relatório de Saída de Estoque - SEMED", 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: ${new Date(inicio).toLocaleDateString()} até ${new Date(fim).toLocaleDateString()}`, 14, 30);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 36);

    // Gerar Tabela
    const colunas = ["DATA", "PEDIDO", "DESTINO", "PRODUTO", "TAM", "QTD"];
    const linhas = dados.map(d => [
        new Date(d.data).toLocaleDateString(),
        `#${d.pedido_id}`,
        d.destino,
        d.produto,
        d.tamanho || '-',
        d.quantidade
    ]);

    doc.autoTable({
        head: [colunas],
        body: linhas,
        startY: 45,
        theme: 'grid',
        headStyles: { fillStyle: [44, 62, 80] } // Cor azul escuro
    });

    doc.save(`relatorio_saidas_${inicio}_a_${fim}.pdf`);
}

// FUNÇÃO PARA SOLICITAR UNIFORMES (ESPECÍFICO ESCOLA)
async function renderizarFormSolicitacaoUniforme() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Busca apenas produtos do tipo UNIFORME
    const resProd = await fetch(`${API_URL}/api/catalogo/produtos`, { 
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
    });
    const produtos = (await resProd.json()).filter(p => p.tipo === 'UNIFORME');
    const tamanhos = ["02", "04", "06", "08", "10", "12", "14", "P", "M", "G", "GG"];

    conteudo.innerHTML = `
        <div class="card-entrada">
            <button onclick="renderizarMenuEscola()" class="btn-voltar">⬅ VOLTAR</button>
            <h2>NOVA SOLICITAÇÃO DE UNIFORMES</h2>
            
            <div class="form-item-solicitacao">
                <label>PRODUTO:</label>
                <select id="sol_prod" class="input-field">
                    ${produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                </select>
                
                <label>TAMANHO:</label>
                <select id="sol_tam" class="input-field">
                    ${tamanhos.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>

                <label>QUANTIDADE:</label>
                <input type="number" id="sol_qtd" class="input-field" min="1">
                
                <button onclick="adicionarItemListaSolicitacao()" class="btn-info" style="width:100%">ADICIONAR À LISTA</button>
            </div>

            <div id="lista-temporaria-itens" style="margin-top:20px">
                <table class="tabela-estilizada" id="tabela-itens-pedido">
                    <thead><tr><th>PRODUTO</th><th>TAM</th><th>QTD</th><th>AÇÃO</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>

            <button onclick="enviarPedidoEscolaFinal()" class="btn-success" style="width:100%; margin-top:20px; display:none;" id="btn-enviar-pedido">
                ENVIAR SOLICITAÇÃO PARA ADMINISTRAÇÃO
            </button>
        </div>
    `;
}

// FUNÇÃO PARA DEVOLUÇÃO
function renderizarFormDevolucao() {
    // Lógica similar à solicitação, mas mudando o cabeçalho e a rota final
    renderizarFormSolicitacaoUniforme();
    const titulo = document.querySelector('h2');
    titulo.innerText = "SOLICITAR DEVOLUÇÃO PARA O ESTOQUE CENTRAL";
    titulo.style.color = "#e67e22";
    
    const btnFinal = document.getElementById('btn-enviar-pedido');
    btnFinal.onclick = () => enviarDevolucaoFinal();
    btnFinal.innerText = "ENVIAR SOLICITAÇÃO DE DEVOLUÇÃO";
}

async function renderizarGerenciamentoDevolucoes() {
    const conteudo = document.getElementById('conteudo-dinamico');
    const res = await fetch(`${API_URL}/api/pedidos/status/DEVOLUÇÃO PENDENTE`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const devolucoes = await res.json();

    conteudo.innerHTML = `
        <div class="card-historico">
            <h2>📦 RECEBIMENTO DE DEVOLUÇÕES (CONFERÊNCIA)</h2>
            <p>Os itens abaixo foram enviados pelas escolas e aguardam conferência física.</p>
            <table class="tabela-estilizada">
                <thead>
                    <tr>
                        <th>DATA</th>
                        <th>ESCOLA SOLICITANTE</th>
                        <th>MOTIVO/OBS</th>
                        <th>AÇÃO</th>
                    </tr>
                </thead>
                <tbody>
                    ${devolucoes.map(d => `
                        <tr>
                            <td>${new Date(d.data_criacao).toLocaleDateString()}</td>
                            <td>${d.solicitante} (${d.local_nome})</td>
                            <td><em>${d.motivo_recusa || 'Não informado'}</em></td>
                            <td>
                                <button onclick="abrirModalConferenciaDevolucao(${d.id})" class="btn-success">CONFERIR ITENS</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function abrirModalConferenciaDevolucao(id) {
    const res = await fetch(`${API_URL}/api/pedidos/${id}/itens`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const itens = await res.json();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box">
            <h3>CONFERIR DEVOLUÇÃO #${id}</h3>
            <p>Verifique se as quantidades abaixo conferem com o que chegou fisicamente:</p>
            <ul style="text-align:left; margin: 20px 0;">
                ${itens.map(i => `<li><strong>${i.quantidade_solicitada}x</strong> ${i.produto_nome} (Tam: ${i.tamanho || 'N/A'})</li>`).join('')}
            </ul>
            <div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:20px; font-size:13px;">
                ⚠️ Ao confirmar, estas quantidades serão somadas ao saldo atual do estoque.
            </div>
            <button onclick="confirmarRecebimentoFinal(${id})" class="btn-block">CONFIRMAR RECEBIMENTO E INTEGRAR ESTOQUE</button>
            <button onclick="this.parentElement.parentElement.remove()" class="btn-cancel" style="width:100%; margin-top:10px;">FECHAR</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function confirmarRecebimentoFinal(id) {
    if(!confirm("CONFIRMA QUE OS ITENS CHEGARAM E ESTÃO EM BOM ESTADO?")) return;

    const res = await fetch(`${API_URL}/api/pedidos/devolucao/confirmar/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if(res.ok) {
        alert("ESTOQUE ATUALIZADO COM SUCESSO!");
        document.querySelector('.modal-overlay').remove();
        renderizarGerenciamentoDevolucoes();
    }
}

async function renderizarInventarioAtual() {
    const conteudo = document.getElementById('conteudo-dinamico');
    conteudo.innerHTML = '<div class="loader">CARREGANDO POSIÇÃO DE ESTOQUE...</div>';

    try {
        const res = await fetch(`${API_URL}/api/pedidos/relatorios/inventario-atual`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await res.json();

        let html = `
            <div class="card-entrada">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>📋 INVENTÁRIO ATUAL (POSIÇÃO DE ESTOQUE)</h2>
                    <button onclick="exportarPDFInventario()" class="btn-info" style="background:#e74c3c">📥 BAIXAR PDF</button>
                </div>

                <div class="filtro-local-inventario" style="margin-bottom:20px;">
                    <input type="text" id="filtro_inventario" placeholder="Filtrar por Local ou Produto..." 
                           onkeyup="filtrarTabelaInventario()" class="input-field">
                </div>

                <table class="tabela-estilizada" id="tabela-inventario">
                    <thead>
                        <tr>
                            <th>LOCAL / UNIDADE</th>
                            <th>PRODUTO</th>
                            <th>TIPO</th>
                            <th>QUANTIDADE</th>
                            <th>DETALHES (SÉRIES)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(d => `
                            <tr>
                                <td><strong>${d.local_nome}</strong></td>
                                <td>${d.produto}</td>
                                <td><span class="badge-tipo">${d.tipo}</span></td>
                                <td style="text-align:center"><strong>${d.quantidade}</strong></td>
                                <td style="font-size:10px; max-width:300px;">${d.detalhes}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        conteudo.innerHTML = html;
        window.dadosInventario = dados; // Salva para o PDF

    } catch (error) {
        conteudo.innerHTML = '<div class="error-msg">FALHA AO OBTER DADOS DO INVENTÁRIO.</div>';
    }
}

function filtrarTabelaInventario() {
    const input = document.getElementById('filtro_inventario').value.toUpperCase();
    const rows = document.querySelectorAll('#tabela-inventario tbody tr');
    
    rows.forEach(row => {
        const text = row.innerText.toUpperCase();
        row.style.display = text.includes(input) ? '' : 'none';
    });
}

function exportarPDFInventario() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // 'l' para modo paisagem (landscape)
    const dados = window.dadosInventario;

    doc.setFontSize(16);
    doc.text("INVENTÁRIO GERAL DE BENS E CONSUMÍVEIS - SEMED", 14, 15);
    doc.setFontSize(10);
    doc.text(`Data do Levantamento: ${new Date().toLocaleString()}`, 14, 22);

    const colunas = ["LOCAL / UNIDADE", "PRODUTO", "TIPO", "QTD", "DETALHES/PLAQUETAS"];
    const linhas = dados.map(d => [
        d.local_nome,
        d.produto,
        d.tipo,
        d.quantidade,
        d.detalhes
    ]);

    doc.autoTable({
        head: [colunas],
        body: linhas,
        startY: 30,
        theme: 'striped',
        styles: { fontSize: 8 },
        columnStyles: {
            4: { cellWidth: 80 } // Coluna de detalhes mais larga
        },
        headStyles: { fillStyle: [52, 73, 94] }
    });

    doc.save(`inventario_atual_${new Date().toISOString().split('T')[0]}.pdf`);
}

async function renderizarTelaTermoResponsabilidade() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Busca a lista de locais para preencher o Select
    const resLocais = await fetch(`${API_URL}/api/catalogo/locais`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const locais = await resLocais.json();

    conteudo.innerHTML = `
        <div class="card-entrada">
            <h2>📜 EMISSÃO DE TERMO DE RESPONSABILIDADE</h2>
            <p>Selecione a Unidade para gerar o documento de cautela dos bens patrimoniais:</p>
            
            <div style="margin: 20px 0;">
                <label><strong>SELECIONE O LOCAL:</strong></label>
                <select id="termo_local_id" class="input-field">
                    <option value="">-- SELECIONE UMA UNIDADE --</option>
                    ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                </select>
            </div>

            <button onclick="gerarPDFTermo()" class="btn-success" style="width: 100%;">
                📄 GERAR TERMO EM PDF
            </button>
        </div>
    `;
}

async function gerarPDFTermo() {
    const localId = document.getElementById('termo_local_id').value;
    if (!localId) return alert("POR FAVOR, SELECIONE UM LOCAL.");

    const res = await fetch(`${API_URL}/api/pedidos/relatorios/termo/${localId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const dados = await res.json();

    if (dados.itens.length === 0) {
        return alert("ESTA UNIDADE NÃO POSSUI ITENS PATRIMONIADOS VINCULADOS.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margem = 14;

    // Cabeçalho Oficial
    doc.setFontSize(14);
    doc.text("PREFEITURA MUNICIPAL - SECRETARIA DE EDUCAÇÃO", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("TERMO DE RESPONSABILIDADE PATRIMONIAL", 105, 28, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`UNIDADE: ${dados.local.nome.toUpperCase()}`, margem, 45);
    doc.text(`DATA DE EMISSÃO: ${new Date().toLocaleDateString()}`, margem, 51);

    // Texto do Termo
    const textoTermo = `Pelo presente Termo de Responsabilidade, a unidade acima identificada declara estar de posse dos bens abaixo relacionados, assumindo total responsabilidade pela guarda, conservação e uso adequado dos mesmos, conforme as normas vigentes de administração pública.`;
    const textLines = doc.splitTextToSize(textoTermo, 180);
    doc.text(textLines, margem, 60);

    // Tabela de Itens
    doc.autoTable({
        head: [['ITEM', 'DESCRIÇÃO DO PRODUTO', 'Nº DE SÉRIE / PLAQUETA']],
        body: dados.itens.map((it, index) => [index + 1, it.produto, it.numero_serie]),
        startY: 75,
        theme: 'grid',
        headStyles: { fill: [44, 62, 80] },
        styles: { fontSize: 9 }
    });

    // Espaço para Assinaturas
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.line(margem, finalY, 90, finalY);
    doc.text("ASSINATURA DO RESPONSÁVEL", margem + 10, finalY + 5);
    
    doc.line(110, finalY, 190, finalY);
    doc.text("DIRETORIA DE PATRIMÔNIO", 125, finalY + 5);

    doc.save(`termo_responsabilidade_${dados.local.nome.replace(/ /g, '_')}.pdf`);
}

async function renderizarMenuLogistica() {
    const conteudo = document.getElementById('conteudo-dinamico');
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    conteudo.innerHTML = `
        <div class="welcome-banner" style="background: #2980b9;">
            <h2>BEM-VINDO(A), ${usuario.nome.toUpperCase()}</h2>
            <p>PAINEL DE LOGÍSTICA E TRANSPORTE</p>
        </div>

        <div class="dashboard-escola-grid">
            <div class="card-menu-escola" onclick="renderizarFormTransferenciaPatrimonio()">
                <div class="icon-escola">🏗️</div>
                <h3>SOLICITAR TRANSFERÊNCIA</h3>
                <p>Mover patrimônio para outra Unidade</p>
            </div>

            <div class="card-menu-escola" onclick="renderizarPedidosEmAndamento()">
                <div class="icon-escola">🚛</div>
                <h3>COLETAS PENDENTES</h3>
                <p>Ver itens prontos para transporte</p>
            </div>
            
            <div class="card-menu-escola" onclick="renderizarInventarioAtual()">
                <div class="icon-escola">📊</div>
                <h3>CONSULTAR LOCALIZAÇÃO</h3>
                <p>Ver onde estão os bens</p>
            </div>
        </div>
    `;
}

async function renderizarFormTransferenciaPatrimonio() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    // Busca dados necessários (Produtos tipo Patrimônio e Locais)
    const [resProd, resLoc] = await Promise.all([
        fetch(`${API_URL}/api/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`${API_URL}/api/catalogo/locais`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    ]);
    
    const produtos = (await resProd.json()).filter(p => p.tipo === 'PATRIMONIO');
    const locais = await resLoc.json();

    conteudo.innerHTML = `
        <div class="card-entrada">
            <button onclick="renderizarMenuLogistica()" class="btn-voltar">⬅ VOLTAR</button>
            <h2>🏗️ SOLICITAÇÃO DE MOVIMENTAÇÃO DE PATRIMÔNIO</h2>
            
            <div class="form-item-solicitacao">
                <label><strong>1. DESTINO DA CARGA:</strong></label>
                <select id="transf_local_id" class="input-field">
                    <option value="">-- SELECIONE A ESCOLA DESTINO --</option>
                    ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                </select>

                <hr style="margin:20px 0; opacity:0.2">

                <label><strong>2. ADICIONAR ITEM:</strong></label>
                <select id="transf_prod_id" class="input-field">
                    ${produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                </select>
                
                <label>QUANTIDADE:</label>
                <input type="number" id="transf_qtd" class="input-field" value="1" min="1">
                
                <button onclick="adicionarItemTransferencia()" class="btn-info" style="width:100%">INCLUIR NO ROMANEIO</button>
            </div>

            <div id="lista-transf" style="margin-top:20px">
                <table class="tabela-estilizada" id="tabela-transf">
                    <thead><tr><th>PRODUTO</th><th>QTD</th><th>AÇÃO</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>

            <button onclick="enviarTransferenciaFinal()" class="btn-success" style="width:100%; margin-top:20px; display:none;" id="btn-enviar-transf">
                ENVIAR PARA APROVAÇÃO DO ADMIN
            </button>
        </div>
    `;
}

let itensTransferencia = [];

function adicionarItemTransferencia() {
    const prodSelect = document.getElementById('transf_prod_id');
    const qtd = document.getElementById('transf_qtd').value;
    
    if(!qtd || qtd < 1) return alert("INFORME UMA QUANTIDADE VÁLIDA");

    const item = {
        produto_id: prodSelect.value,
        nome: prodSelect.options[prodSelect.selectedIndex].text,
        quantidade: parseInt(qtd)
    };

    itensTransferencia.push(item);
    atualizarTabelaTransferencia();
}

function atualizarTabelaTransferencia() {
    const tbody = document.querySelector('#tabela-transf tbody');
    const btn = document.getElementById('btn-enviar-transf');
    tbody.innerHTML = '';

    itensTransferencia.forEach((it, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${it.nome}</td>
                <td>${it.quantidade}</td>
                <td><button onclick="itensTransferencia.splice(${index},1); atualizarTabelaTransferencia()" class="btn-cancel" style="padding:2px 5px">❌</button></td>
            </tr>
        `;
    });

    btn.style.display = itensTransferencia.length > 0 ? 'block' : 'none';
}

async function enviarTransferenciaFinal() {
    const local_id = document.getElementById('transf_local_id').value;
    if(!local_id) return alert("POR FAVOR, SELECIONE O DESTINO!");

    const res = await fetch(`${API_URL}/api/pedidos/patrimonio/solicitar-transferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
            local_destino_id: local_id,
            itens: itensTransferencia,
            observacao: "Solicitado via painel de logística"
        })
    });

    if(res.ok) {
        alert("SOLICITAÇÃO ENVIADA! AGUARDE A AUTORIZAÇÃO DO ADMIN.");
        itensTransferencia = [];
        renderizarMenuLogistica();
    }
}

// Função para buscar e exibir notificações
async function atualizarBadgesNotificacao() {
    try {
        const res = await fetch(`${API_URL}/api/pedidos/notificacoes/contagem`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        
        const badgeTotal = document.getElementById('badge-notificacao-geral');
        
        if (data.contagem > 0) {
            if (badgeTotal) {
                badgeTotal.innerText = data.contagem;
                badgeTotal.style.display = 'flex';
            }
            // Toca um alerta sonoro discreto se o número aumentar (opcional)
            console.log(`Existem ${data.contagem} pendências aguardando sua ação.`);
        } else {
            if (badgeTotal) badgeTotal.style.display = 'none';
        }
    } catch (error) {
        console.error("Erro ao buscar notificações:", error);
    }
}

// Iniciar a verificação automática a cada 2 minutos (120000ms)
setInterval(atualizarBadgesNotificacao, 120000);

async function renderizarRelatorioEstatisticoUniformes() {
    const conteudo = document.getElementById('conteudo-dinamico');
    conteudo.innerHTML = '<div class="loader">GERANDO ESTATÍSTICAS...</div>';

    try {
        const res = await fetch(`${API_URL}/api/pedidos/relatorios/entregas-uniformes`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await res.json();

        const jaReceberam = dados.filter(d => d.situacao === 'RECEBEU');
        const faltamReceber = dados.filter(d => d.situacao === 'PENDENTE');

        conteudo.innerHTML = `
            <div class="card-entrada">
                <h2>📊 BALANÇO DE ENTREGAS DE UNIFORMES</h2>
                <button onclick="exportarPDFEstatisticoUniformes()" class="btn-info" style="background:#e74c3c">
                    📥 BAIXAR RELATÓRIO COMPLETO (PDF)
                </button>
                <div class="dashboard-resumo-mini">
                    <div class="mini-card verde"><strong>${jaReceberam.length}</strong> Escolas Atendidas</div>
                    <div class="mini-card vermelho"><strong>${faltamReceber.length}</strong> Escolas Pendentes</div>
                </div>

                <div class="grafico-container" style="margin: 30px 0; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                    <canvas id="graficoUniformes"></canvas>
                </div>

                <div class="listas-setores" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h3 style="color: #27ae60;">✅ UNIDADES ATENDIDAS</h3>
                        <table class="tabela-estilizada-mini">
                            <thead><tr><th>ESCOLA</th><th>TOTAL PEÇAS</th></tr></thead>
                            <tbody>
                                ${jaReceberam.map(d => `<tr><td>${d.escola}</td><td>${d.total_recebido}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <h3 style="color: #c0392b;">⏳ AGUARDANDO ENTREGA</h3>
                        <table class="tabela-estilizada-mini">
                            <thead><tr><th>ESCOLA</th></tr></thead>
                            <tbody>
                                ${faltamReceber.map(d => `<tr><td>${d.escola}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Renderiza o Gráfico
        renderizarGrafico(jaReceberam);

    } catch (error) {
        console.error(error);
        conteudo.innerHTML = '<p class="error">Erro ao carregar relatório.</p>';
    }
}

function renderizarGrafico(dados) {
    const ctx = document.getElementById('graficoUniformes').getContext('2d');
    
    // Pegar apenas o top 10 ou todas se forem poucas para o gráfico não ficar poluído
    const labels = dados.map(d => d.escola);
    const valores = dados.map(d => d.total_recebido);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total de Peças Entregues',
                data: valores,
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Gráfico horizontal para melhor leitura dos nomes das escolas
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'RANKING DE RECEBIMENTO POR UNIDADE' }
            }
        }
    });
}

async function exportarPDFEstatisticoUniformes() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const canvas = document.getElementById('graficoUniformes');
    
    // 1. Configurações de Cabeçalho
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("BALANÇO GERAL: DISTRIBUIÇÃO DE UNIFORMES", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Secretaria Municipal de Educação - Gerado em: ${new Date().toLocaleString()}`, 105, 28, { align: "center" });

    // 2. Inserir a imagem do Gráfico no PDF
    if (canvas) {
        const imgData = canvas.toDataURL('image/png');
        // Adiciona a imagem (x, y, largura, altura)
        doc.addImage(imgData, 'PNG', 15, 35, 180, 80);
    }

    // 3. Tabela de Unidades Atendidas (Verde)
    const res = await fetch(`${API_URL}/api/pedidos/relatorios/entregas-uniformes`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const dados = await res.json();
    const atendidas = dados.filter(d => d.situacao === 'RECEBEU');
    const pendentes = dados.filter(d => d.situacao === 'PENDENTE');

    doc.setFontSize(12);
    doc.setTextColor(39, 174, 96);
    doc.text("✅ UNIDADES COM ENTREGA CONFIRMADA", 14, 125);

    doc.autoTable({
        head: [['UNIDADE ESCOLAR', 'TOTAL DE PEÇAS', 'ÚLTIMA ENTREGA']],
        body: atendidas.map(d => [
            d.escola, 
            d.total_recebido, 
            d.ultima_entrega ? new Date(d.ultima_entrega).toLocaleDateString() : '-'
        ]),
        startY: 130,
        theme: 'grid',
        headStyles: { fillStyle: [39, 174, 96] },
        styles: { fontSize: 8 }
    });

    // 4. Tabela de Unidades Pendentes (Vermelho)
    const nextY = doc.lastAutoTable.finalY + 15;
    
    // Verifica se precisa de nova página
    let targetY = nextY;
    if (targetY > 250) {
        doc.addPage();
        targetY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(192, 57, 43);
    doc.text("⏳ UNIDADES AGUARDANDO CRONOGRAMA", 14, targetY);

    doc.autoTable({
        head: [['UNIDADE ESCOLAR PENDENTE']],
        body: pendentes.map(d => [d.escola]),
        startY: targetY + 5,
        theme: 'grid',
        headStyles: { fillStyle: [192, 57, 43] },
        styles: { fontSize: 8 }
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount} - Sistema de Gestão de Estoque SEMED`, 105, 290, { align: "center" });
    }

    doc.save(`balanco_uniformes_${new Date().toISOString().split('T')[0]}.pdf`);
}

function abrirCalculadoraConversao() {
    // Remove modal anterior se existir
    const modalAntigo = document.querySelector('.modal-overlay');
    if (modalAntigo) modalAntigo.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 400px; border-top: 5px solid #3498db;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0;">🧮 CALCULADORA DE UNIDADES</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; font-size:20px; cursor:pointer;">&times;</button>
            </div>
            
            <p style="font-size: 13px; color: #666; margin-bottom:20px;">Converta quantidades totais em embalagens fechadas + unidades avulsas.</p>

            <label>QUANTIDADE QUE PRECISO (TOTAL):</label>
            <input type="number" id="calc_total" class="input-field" placeholder="Ex: 10" oninput="calcularConversao()">

            <label>QUANTIDADE POR EMBALAGEM (UNIDADES):</label>
            <input type="number" id="calc_embalagem" class="input-field" placeholder="Ex: 4" oninput="calcularConversao()">

            <label>NOME DA EMBALAGEM:</label>
            <input type="text" id="calc_nome_emb" class="input-field" value="LATA" placeholder="Ex: CAIXA, FARDO, LATA" oninput="calcularConversao()">

            <hr style="margin: 20px 0; opacity: 0.2;">

            <div id="resultado_calculadora" style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; min-height: 60px; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; color: #2c3e50;">
                Aguardando dados...
            </div>
            
            <button onclick="this.parentElement.parentElement.remove()" class="btn-block" style="margin-top: 15px; background: #7f8c8d;">FECHAR</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function calcularConversao() {
    const total = parseInt(document.getElementById('calc_total').value);
    const unidadesPorEmb = parseInt(document.getElementById('calc_embalagem').value);
    const nomeEmb = document.getElementById('calc_nome_emb').value.toUpperCase() || "EMBALAGEM";
    const display = document.getElementById('resultado_calculadora');

    if (!total || !unidadesPorEmb || unidadesPorEmb <= 0) {
        display.innerHTML = "Informe os valores acima.";
        return;
    }

    const embalagensFechadas = Math.floor(total / unidadesPorEmb);
    const avulsas = total % unidadesPorEmb;

    let resultadoText = `VOCÊ PRECISA DE:<br><span style="color:#2980b9; font-size:18px;">`;
    
    if (embalagensFechadas > 0) {
        resultadoText += `${embalagensFechadas} ${nomeEmb}${embalagensFechadas > 1 ? 'S' : ''}`;
    }

    if (avulsas > 0) {
        if (embalagensFechadas > 0) resultadoText += ` e `;
        resultadoText += `${avulsas} UNIDADE${avulsas > 1 ? 'S' : ''} AVULSA${avulsas > 1 ? 'S' : ''}`;
    }

    if (total === 0) resultadoText = "Quantidade zerada.";

    resultadoText += `</span>`;
    display.innerHTML = resultadoText;
}

async function renderizarRelatorioEstoqueBaixo() {
    const conteudo = document.getElementById('conteudo-dinamico');
    conteudo.innerHTML = '<div class="loader">ANALISANDO ESTOQUE...</div>';

    try {
        const res = await fetch(`${API_URL}/api/catalogo/relatorios/estoque-baixo-material`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await res.json();

        if (dados.length === 0) {
            conteudo.innerHTML = `
                <div class="card-entrada" style="text-align:center;">
                    <img src="assets/logo.png" style="width:50px; margin-bottom:10px;">
                    <h2>✅ ESTOQUE EM DIA</h2>
                    <p>Todos os materiais estão com níveis acima do limite de segurança.</p>
                    <button onclick="renderizarHome()" class="btn-block">VOLTAR</button>
                </div>`;
            return;
        }

        conteudo.innerHTML = `
            <div class="card-entrada">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img src="assets/logo.png" style="width:40px;">
                        <h2 style="margin:0; color:#c0392b;">⚠️ ALERTA DE REPOSIÇÃO (MATERIAL)</h2>
                    </div>
                    <button onclick="exportarPDFEstoqueBaixo()" class="btn-info" style="background:#e74c3c">📥 BAIXAR LISTA DE COMPRAS</button>
                </div>

                <p>Os itens abaixo estão abaixo do limite mínimo (10 unidades) e precisam de atenção.</p>

                <table class="tabela-estilizada" id="tabela-estoque-baixo">
                    <thead>
                        <tr>
                            <th>PRODUTO MATERIAL</th>
                            <th>QTD ATUAL</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(d => `
                            <tr style="background: ${d.status_estoque === 'ESGOTADO' ? '#fff0f0' : 'white'}">
                                <td><strong>${d.nome}</strong></td>
                                <td style="text-align:center;">${d.quantidade_estoque}</td>
                                <td>
                                    <span class="badge-status-${d.status_estoque.toLowerCase()}">
                                        ${d.status_estoque}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        window.dadosEstoqueBaixo = dados;

    } catch (error) {
        conteudo.innerHTML = '<p class="error">FALHA AO GERAR RELATÓRIO.</p>';
    }
}

async function exportarPDFEstoqueBaixo() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dados = window.dadosEstoqueBaixo;

    // Logo e Cabeçalho
    doc.addImage(LOGO_BASE64, 'PNG', 14, 10, 20, 20);
    doc.setFontSize(16);
    doc.setTextColor(192, 57, 43);
    doc.text("RELATÓRIO DE NECESSIDADE DE REPOSIÇÃO", 40, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`SEMED - Emitido em: ${new Date().toLocaleString()}`, 40, 24);

    doc.autoTable({
        head: [['PRODUTO', 'QUANTIDADE EM ESTOQUE', 'SITUAÇÃO']],
        body: dados.map(d => [d.nome, d.quantidade_estoque, d.status_estoque]),
        startY: 35,
        theme: 'grid',
        headStyles: { fillStyle: [192, 57, 43] },
        styles: { fontSize: 10 }
    });

    doc.save(`necessidade_compra_material_${new Date().toISOString().split('T')[0]}.pdf`);
}

function renderizarGaleriaRelatorios() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    conteudo.innerHTML = `
        <div class="header-com-voltar">
            <button onclick="renderizarHome()" class="btn-voltar">⬅ VOLTAR AO MENU</button>
            <h2 style="margin-top:10px;">📊 CENTRO DE RELATÓRIOS E AUDITORIA</h2>
        </div>

        <div class="grid-menu-principal" style="margin-top:20px;">
            
            <button onclick="renderizarRelatorioEstoqueBaixo()" class="btn-menu">
                <span class="icon">📉</span> ESTOQUE BAIXO (MATERIAL)
            </button>

            <button onclick="renderizarRelatorioEstatisticoUniformes()" class="btn-menu">
                <span class="icon">👕</span> BALANÇO DE UNIFORMES
            </button>

            <button onclick="renderizarInventarioAtual()" class="btn-menu">
                <span class="icon">📋</span> INVENTÁRIO GERAL (ATUAL)
            </button>

            <button onclick="renderizarTelaTermoResponsabilidade()" class="btn-menu">
                <span class="icon">📜</span> TERMO DE RESPONSABILIDADE
            </button>

            <button onclick="renderizarTelaRelatorios()" class="btn-menu">
                <span class="icon">📅</span> SAÍDAS POR PERÍODO
            </button>

            <button onclick="renderizarHistorico()" class="btn-menu">
                <span class="icon">🕵️</span> HISTÓRICO / AUDITORIA
            </button>

        </div>
    `;
}

// ==========================================
// MÓDULO DE MOVIMENTAÇÃO DE ESTOQUE (ADMIN)
// ==========================================

// 1. RENDERIZAR FORMULÁRIO DE ENTRADA
async function renderizarEntradaEstoque() {
    const conteudo = document.getElementById('conteudo-dinamico');
    
    try {
        const [resProdutos, resLocais] = await Promise.all([
            fetch(`${API_URL}/api/cadastros/produtos`, { headers: { 'Authorization': `Bearer ${TOKEN}` } }),
            fetch(`${API_URL}/api/cadastros/locais`, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
        ]);

        const produtos = await resProdutos.json();
        const locais = await resLocais.json();

        conteudo.innerHTML = `
            <div class="header-com-voltar">
                <button onclick="renderizarHome()" class="btn-voltar">⬅ VOLTAR</button>
                <h2>➕ ENTRADA DE MATERIAL NO ESTOQUE</h2>
            </div>

            <div class="card-form">
                <form id="form-entrada">
                    <label>TIPO DE MATERIAL:</label>
                    <select id="entrada_tipo" required>
                        <option value="MATERIAL">MATERIAL (PAPELARIA/LIMPEZA)</option>
                        <option value="UNIFORME">UNIFORME</option>
                    </select>

                    <label>LOCAL DE DESTINO (DEPÓSITO):</label>
                    <select id="entrada_local_id" required>
                        <option value="">SELECIONE O LOCAL...</option>
                        ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                    </select>

                    <label>PRODUTO:</label>
                    <select id="entrada_produto_id" required>
                        <option value="">SELECIONE O PRODUTO...</option>
                        ${produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                    </select>

                    <label>QUANTIDADE:</label>
                    <input type="number" id="entrada_quantidade" min="1" required>

                    <label>NOTA FISCAL / DOCUMENTO:</label>
                    <input type="text" id="entrada_nota_fiscal">

                    <button type="submit" class="btn-salvar">REGISTRAR ENTRADA</button>
                </form>
            </div>
        `;

        document.getElementById('form-entrada').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                tipo: document.getElementById('entrada_tipo').value,
                nota_fiscal: document.getElementById('entrada_nota_fiscal').value,
                local_id: document.getElementById('entrada_local_id').value,
                itens: [{
                    produto_id: document.getElementById('entrada_produto_id').value,
                    quantidade: parseInt(document.getElementById('entrada_quantidade').value)
                }]
            };

            const response = await fetch(`${API_URL}/estoque/entrada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert('Entrada registada com sucesso!');
                renderizarHome();
            } else {
                const erro = await response.json();
                alert('Erro: ' + erro.error);
            }
        });
    } catch (err) { alert('Erro ao carregar dados do servidor.'); }
}

// 2. RENDERIZAR HISTÓRICO GERAL
async function renderizarHistoricoGeral() {
    const conteudo = document.getElementById('conteudo-dinamico');
    try {
        const res = await fetch(`${API_URL}/historico_geral`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const historico = await res.json();

        conteudo.innerHTML = `
            <div class="header-com-voltar">
                <button onclick="renderizarHome()" class="btn-voltar">⬅ VOLTAR</button>
                <h2>📜 HISTÓRICO DE MOVIMENTAÇÕES</h2>
            </div>
            <div class="tabela-container">
                <table class="tabela-estilizada">
                    <thead>
                        <tr>
                            <th>DATA</th>
                            <th>TIPO</th>
                            <th>LOCAL</th>
                            <th>USUÁRIO</th>
                            <th>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historico.map(h => `
                            <tr>
                                <td>${new Date(h.data).toLocaleString('pt-PT')}</td>
                                <td><span class="badge-${h.tipo_movimentacao.toLowerCase()}">${h.tipo_movimentacao}</span></td>
                                <td>${h.local_nome || 'GERAL'}</td>
                                <td>${h.usuario_nome}</td>
                                <td><button class="btn-detalhes" onclick="verDetalhesHistorico(${h.id})">🔍 ITENS</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { alert('Erro ao carregar histórico.'); }
}

// 3. VER DETALHES DE UMA MOVIMENTAÇÃO
async function verDetalhesHistorico(id) {
    try {
        const res = await fetch(`${API_URL}/historico/${id}/detalhes`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const detalhes = await res.json();
        const lista = detalhes.map(d => `- ${d.produto_nome}: ${d.quantidade} un.`).join('\n');
        alert(`ITENS DA MOVIMENTAÇÃO:\n\n${lista}`);
    } catch (err) { alert('Erro ao carregar detalhes.'); }
}

// --- FUNÇÕES DE BUSCA E EXIBIÇÃO DE ALERTAS ---

async function verificarAlertasEscola() {
    // Só executa se o perfil for escola
    if (localStorage.getItem('userRole') !== 'escola') return;

    try {
        // Rota correta: /pedidos (prefixo no server.js) + /alertas-escola (no pedidos.routes.js)
        const res = await fetch(`${API_URL}/pedidos/alertas-escola`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) return;

        const pedidos = await res.json();
        const alertContainer = document.getElementById('alertas-container');

        if (alertContainer && pedidos.length > 0) {
            alertContainer.innerHTML = `
                <div style="background: #fffbeb; color: #b45309; padding: 15px; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 20px; font-weight: bold; text-align: center;">
                    🚚 ATENÇÃO: VOCÊ POSSUI ${pedidos.length} PEDIDO(S) EM TRANSPORTE PARA ESTA UNIDADE!
                </div>`;
        } else if (alertContainer) {
            alertContainer.innerHTML = '';
        }
    } catch (err) {
        console.error("Erro ao carregar alertas da escola:", err);
    }
}

async function verificarSolicitacoesPendentes() {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin' && role !== 'super') return;

    try {
        // Rota global que conta tudo que está com status AGUARDANDO_AUTORIZACAO
        const res = await fetch(`${API_URL}/api/pedidos/notificacoes/contagem`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();

        const alertaContainer = document.getElementById('alertas-container');
        if (alertaContainer && data.total > 0) {
            alertaContainer.innerHTML = `
                <div onclick="telaHistoricoSolicitacoes()" style="background:#fff7ed; color:#c2410c; padding:15px; border:1px solid #fdba74; border-radius:8px; cursor:pointer; font-weight:bold; text-align:center; margin-bottom:15px;">
                    🚨 ATENÇÃO: EXISTEM ${data.total} SOLICITAÇÕES AGUARDANDO SUA AUTORIZAÇÃO!
                </div>`;
        }
    } catch (err) { console.error("Erro no alerta admin:", err); }
}

async function verificarPedidosParaSeparar() {
    // Só executa se o perfil for estoque
    if (localStorage.getItem('userRole') !== 'estoque') return;

    try {
        // Rota definida no seu server.js
        const res = await fetch(`${API_URL}/api/alertas/estoque/aprovados`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const alertContainer = document.getElementById('alertas-container');

        // Se houver pedidos aprovados (total > 0), exibe o alerta
        if (alertContainer && data.total > 0) {
            alertContainer.innerHTML = `
                <div style="background: #ecfdf5; color: #059669; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0; margin-bottom: 20px; font-weight: bold; text-align: center;">
                    📦 EXISTEM ${data.total} PEDIDO(S) APROVADO(S) AGUARDANDO SEPARAÇÃO!
                </div>`;
        } else if (alertContainer) {
            alertContainer.innerHTML = '';
        }
    } catch (err) {
        console.error("Erro ao carregar alertas do estoque:", err);
    }
}

async function verificarPedidosParaColeta() {
    // Só executa se o perfil for logistica
    if (localStorage.getItem('userRole') !== 'logistica') return;

    try {
        // Rota exata definida no seu server.js para a logística
        const res = await fetch(`${API_URL}/api/alertas/logistica/coleta`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const alertContainer = document.getElementById('alertas-container');

        // Se houver pedidos prontos para coleta (total > 0), exibe o alerta
        if (alertContainer && data.total > 0) {
            alertContainer.innerHTML = `
                <div style="background: #eff6ff; color: #1d4ed8; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 20px; font-weight: bold; text-align: center;">
                    🚚 ATENÇÃO: EXISTEM ${data.total} PEDIDO(S) AGUARDANDO COLETA E TRANSPORTE!
                </div>`;
        } else if (alertContainer) {
            alertContainer.innerHTML = '';
        }
    } catch (err) {
        console.error("Erro ao carregar alertas da logística:", err);
    }
}

// Função auxiliar para inserir o HTML na div de alertas
function renderizarAlertaNoPainel(mensagem) {
    const area = document.getElementById('area-alertas');
    if (area) {
        const div = document.createElement('div');
        div.style = "background: #fff3cd; color: #856404; padding: 12px; margin-bottom: 10px; border-left: 6px solid #ffc107; font-weight: bold; border-radius: 4px; display: flex; justify-content: space-between;";
        div.innerHTML = `<span>${mensagem}</span><button onclick="this.parentElement.remove()" style="background:none; border:none; cursor:pointer; font-weight:bold;">✕</button>`;
        area.appendChild(div);
    }
}

// ================================================================
// BLOCO DE CORREÇÃO PARA PERFIL ADMIN (BOTÕES EM FALTA OU ERRADOS)
// ================================================================

// 1. Redirecionar Painel de Pedidos (Estava em falta)
async function renderizarDashboardGeral() {
    // Esta função utiliza a lógica de "Pedidos em Andamento" que já existe na Parte 5
    if (typeof renderizarPedidosEmAndamento === "function") {
        renderizarPedidosEmAndamento();
    } else {
        alert("Função de painel não localizada no script.");
    }
}

// 2. Corrigir Autorizar Solicitações (Nome estava diferente na Parte 3)
async function telaAutorizarSolicitacoes() {
    if (typeof telaVerSolicitacoes === "function") {
        telaVerSolicitacoes();
    } else {
        alert("Erro: Função telaVerSolicitacoes não encontrada.");
    }
}

// 3. Criar Tela de Visualização de Estoque (Estava em falta)
async function telaVisualizarEstoque() {
    const conteudo = document.getElementById('conteudo-dinamico');
    conteudo.innerHTML = '<div class="loader">A carregar stock...</div>';
    
    try {
        // CORREÇÃO DE ROTA: Removido o "/api" para coincidir com o server.js
        const res = await fetch(`${API_URL}/catalogo/produtos`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const produtos = await res.json();
        
        let html = `
            <div class="card-historico">
                <h2>📊 POSIÇÃO ATUAL DO ESTOQUE</h2>
                <table class="tabela-estilizada">
                    <thead>
                        <tr><th>PRODUTO</th><th>CATEGORIA</th><th>SALDO ATUAL</th><th>ALERTA MÍN.</th></tr>
                    </thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr style="${p.quantidade_estoque <= p.alerta_minimo ? 'color: red; font-weight: bold;' : ''}">
                                <td>${p.nome}</td>
                                <td>${p.categoria_nome || 'GERAL'}</td>
                                <td>${p.quantidade_estoque}</td>
                                <td>${p.alerta_minimo}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        conteudo.innerHTML = html;
    } catch (err) {
        alert("Erro ao carregar dados do stock.");
    }
}

// 4. Corrigir Histórico (Nome e Rota)
async function renderizarHistoricoGeral() {
    // Chama a função existente mas corrige a lógica de rota internamente
    if (typeof renderizarHistorico === "function") {
        renderizarHistorico();
    } else {
        alert("Função de histórico não encontrada.");
    }
}

// 5. Redirecionar Relatórios (Mapeando para o relatório estatístico da Parte 8)
function renderizarRelatorios() {
    if (typeof renderizarRelatorioEstatisticoUniformes === "function") {
        renderizarRelatorioEstatisticoUniformes();
    } else {
        alert("Módulo de relatórios não disponível.");
    }
}

// 6. Criar função para "CRIAR PEDIDO" (Admin criando sem solicitação prévia)
function telaCriarPedidoDireto() {
    // Reutiliza a lógica de solicitação de material mas para o admin
    if (typeof telaSolicitarMaterial === "function") {
        telaSolicitarMaterial();
    } else {
        alert("Módulo de criação de pedidos não localizado.");
    }
}

// ================================================================
// 🛠️ CORREÇÃO DEFINITIVA (COLE AO FINAL DO ARQUIVO)
// ================================================================

// Usamos funções de embrulho (wrappers) para evitar erros de inicialização
function renderizarDashboardGeral() { 
    if (typeof renderizarPedidosEmAndamento === "function") renderizarPedidosEmAndamento(); 
    else console.error("Função não encontrada");
}

function telaAutorizarSolicitacoes() { 
    if (typeof telaVerSolicitacoes === "function") telaVerSolicitacoes(); 
    else console.error("Função não encontrada");
}

function renderizarRelatorios() { 
    if (typeof renderizarRelatorioEstatisticoUniformes === "function") renderizarRelatorioEstatisticoUniformes(); 
    else console.error("Função não encontrada");
}

function renderizarHistoricoGeral() { 
    if (typeof renderizarHistorico === "function") {
        renderizarHistorico();
    } else {
        alert("Erro: Módulo de histórico não localizado.");
    }
}

// Sobrescrevendo a função de entrada para corrigir as URLs (removendo /api)
async function abrirDialogoEntrada() {
    const conteudo = document.getElementById('conteudo-dinamico');
    if (!conteudo) return;
    conteudo.innerHTML = '<div class="loader">Carregando dados...</div>';
    
    try {
        const [resProd, resLoc] = await Promise.all([
            fetch(`${API_URL}/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
            fetch(`${API_URL}/catalogo/locais`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        ]);
        
        const produtos = (await resProd.json()).filter(p => p.tipo === 'MATERIAL');
        const locais = await resLoc.json();

        conteudo.innerHTML = `
            <div class="card-entrada">
                <h2>ENTRADA DE MATERIAIS</h2>
                <select id="ent_local" class="input-field">
                    ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                </select>
                <div class="lista-material-scroll" style="max-height:300px; overflow-y:auto;">
                    ${produtos.map(p => `
                        <div style="display:flex; justify-content:space-between; margin: 10px 0;">
                            <span>${p.nome}</span>
                            <input type="number" class="input-material-qtd" data-prod="${p.id}" style="width:60px" placeholder="0">
                        </div>
                    `).join('')}
                </div>
                <button onclick="processarEntradaManual()" class="btn-success">SALVAR ENTRADA</button>
            </div>
        `;
    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique o CMD.");
    }
}

// ================================================================
// 🩹 PATCH DE COMPATIBILIDADE - ADMIN & ESTOQUE (VERSÃO SEGURA)
// ================================================================

// Funções de redirecionamento para botões que não funcionam
window.renderizarDashboardGeral = function() {
    if (typeof renderizarPedidosEmAndamento === "function") renderizarPedidosEmAndamento();
};

window.telaAutorizarSolicitacoes = function() {
    if (typeof telaVerSolicitacoes === "function") telaVerSolicitacoes();
};

window.renderizarRelatorios = function() {
    if (typeof renderizarRelatorioEstatisticoUniformes === "function") renderizarRelatorioEstatisticoUniformes();
};

window.renderizarHistoricoGeral = function() {
    if (typeof renderizarHistorico === "function") renderizarHistorico();
};

// --- CORREÇÃO DA ENTRADA DE ESTOQUE ---
window.abrirDialogoEntrada = async function() {
    const conteudo = document.getElementById('conteudo-dinamico');
    if (!conteudo) return;
    conteudo.innerHTML = '<div class="loader">Carregando formulário...</div>';
    
    try {
        // Ajuste de rotas conforme o server.js (sem o prefixo /api onde não existe)
        const [resProd, resLoc] = await Promise.all([
            fetch(`${API_URL}/catalogo/produtos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
            fetch(`${API_URL}/catalogo/locais`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        ]);
        
        const produtos = (await resProd.json()).filter(p => p.tipo === 'MATERIAL');
        const locais = await resLoc.json();

        conteudo.innerHTML = `
            <div class="card-entrada">
                <h2>📦 ENTRADA DE ESTOQUE (MATERIAIS)</h2>
                <div style="margin-bottom:20px;">
                    <label>LOCAL DE DESTINO:</label>
                    <select id="ent_local" class="input-field">
                        ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                    </select>
                </div>
                <div style="max-height:300px; overflow-y:auto; border:1px solid #ddd; padding:10px;">
                    ${produtos.map(p => `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                            <span>${p.nome}</span>
                            <input type="number" class="input-material-qtd" data-prod="${p.id}" style="width:80px;" placeholder="QTD">
                        </div>
                    `).join('')}
                </div>
                <button onclick="processarEntradaManual()" class="btn-success" style="margin-top:20px; width:100%;">REGISTRAR ENTRADA</button>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar dados do catálogo. Verifique a conexão com o servidor.");
    }
};

// --- FUNÇÃO DE VISUALIZAÇÃO DE ESTOQUE ---
window.telaVisualizarEstoque = async function() {
    const conteudo = document.getElementById('conteudo-dinamico');
    if (!conteudo) return;
    conteudo.innerHTML = '<div class="loader">Consultando saldos...</div>';

    try {
        const res = await fetch(`${API_URL}/catalogo/produtos`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const produtos = await res.json();

        let html = `
            <div class="card-historico">
                <h2>📊 POSIÇÃO ATUAL DO ESTOQUE</h2>
                <table class="tabela-estilizada">
                    <thead><tr><th>PRODUTO</th><th>TIPO</th><th>SALDO</th></tr></thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr>
                                <td>${p.nome}</td>
                                <td>${p.tipo}</td>
                                <td style="font-weight:bold; color:${p.quantidade_estoque <= 0 ? 'red' : 'green'}">${p.quantidade_estoque}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        conteudo.innerHTML = html;
    } catch (err) {
        alert("Erro ao carregar o estoque.");
    }
};

// --- FUNÇÃO PARA LANÇAR PATRIMÔNIO ---
window.telaMovimentarPatrimonio = function() {
    const conteudo = document.getElementById('conteudo-dinamico');
    conteudo.innerHTML = `
        <div class="card-entrada">
            <h2>🏷️ LANÇAR / MOVER PATRIMÔNIO</h2>
            <p>Insira o número de série ou plaqueta para registrar a movimentação.</p>
            <input type="text" placeholder="Nº DE SÉRIE" class="input-field" id="pat_serie">
            <button class="btn-info" onclick="alert('Funcionalidade sendo integrada ao Banco de Dados...')">LOCALIZAR ITEM</button>
        </div>
    `;
};

// --- TELA DE SOLICITAÇÃO (GRADE COMPACTA) ---
// FUNÇÃO PARA MONTAR A TELA DE GRADE DE UNIFORMES
async function antigatelaSolicitarUniforme() {
    const role = localStorage.getItem('userRole');
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; font-weight:bold;">CARREGANDO...</div>';

    // Grades oficiais
    const gradeRoupas = ['2','4','6','8','10','12','14','16','PP','P','M','G','GG','EGG'];
    const gradeTenis = ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43'];

    try {
        // 1. Busca os produtos de uniformes
        const resProd = await fetch(`${API_URL}/catalogo/produtos/categoria/UNIFORMES`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const produtos = await resProd.json();

        // 2. Se for ADMIN/SUPER/ESTOQUE, busca a lista de escolas para o seletor
        let escolas = [];
        if (role !== 'escola') {
            const resEsc = await fetch(`${API_URL}/catalogo/locais`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            escolas = await resEsc.json();
        }

        let html = `
            <style>
                /* Estilos para 3 dígitos e sem setinhas */
                .input-qtd-grade { 
                    width: 60px !important; 
                    height: 35px; 
                    font-size: 0.9rem; 
                    text-align: center; 
                    border: 1px solid #cbd5e1; 
                    border-radius: 4px;
                    margin: 2px;
                    -moz-appearance: textfield;
                }
                .input-qtd-grade::-webkit-outer-spin-button,
                .input-qtd-grade::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .label-tamanho { font-size: 0.75rem; font-weight: bold; color: #475569; display: block; }
                .grade-container { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; background: #f8fafc; border-radius: 6px; }
            </style>

            <div class="secao-header" style="padding:20px; display:flex; justify-content:space-between; align-items:center;">
                <h2>${role !== 'escola' ? 'CRIAR PEDIDO DIRETO (ADMIN)' : 'SOLICITAR UNIFORMES'}</h2>
                <button class="btn-voltar" onclick="carregarDashboard()">VOLTAR</button>
            </div>
            
            <div style="padding: 20px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px;">
                ${role !== 'escola' ? `
                    <label style="color:#1e40af; font-weight:bold;">PARA QUAL ESCOLA DESTINO É ESTE PEDIDO?</label><br>
                    <select id="local_destino_pedido" style="width: 100%; padding: 15px; margin-top: 10px; border: 2px solid #2563eb; border-radius: 8px; font-size: 1rem; font-weight: bold;">
                        <option value="">-- SELECIONE A UNIDADE DESTINO --</option>
                        ${escolas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('')}
                    </select>
                ` : `
                    <input type="hidden" id="local_destino_pedido" value="${localStorage.getItem('localId')}">
                    <p><b>DESTINO:</b> Sua própria unidade.</p>
                `}
            </div>

            <div style="padding: 0 20px;">
                <table style="width:100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background:#1e293b; color:white;">
                            <th style="padding:15px; text-align:left; width:200px;">PRODUTO</th>
                            <th style="padding:15px; text-align:left;">GRADE DE TAMANHOS</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        produtos.forEach(prod => {
            const ehTenis = prod.nome.toUpperCase().includes('TENIS');
            const gradeAtual = ehTenis ? gradeTenis : gradeRoupas;

            html += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:15px; font-weight:bold; color:#334155;">${prod.nome}</td>
                    <td style="padding:10px;">
                        <div class="grade-container">
                            ${gradeAtual.map(t => `
                                <div style="text-align:center;">
                                    <span class="label-tamanho">${t}</span>
                                    <input type="number" class="input-qtd-grade" 
                                           data-prod-id="${prod.id}" data-tamanho="${t}" 
                                           min="0" placeholder="0">
                                </div>
                            `).join('')}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
            <div style="padding:30px; text-align:right;">
                <button onclick="enviarSolicitacaoUniforme()" style="padding:15px 50px; background:#16a34a; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    ${role !== 'escola' ? 'GERAR PEDIDO AGORA' : 'ENVIAR SOLICITAÇÃO'}
                </button>
            </div>
        `;

        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:red; padding:20px;">ERRO AO CARREGAR TELA: ${err.message}</div>`;
    }
}

async function telaSolicitarUniforme() {
    const role = localStorage.getItem('userRole')?.toLowerCase();
    const isAdmin = (role === 'admin' || role === 'super');
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">CARREGANDO...</div>';

    const gradeRoupas = ['2','4','6','8','10','12','14','16','PP','P','M','G','GG','EGG'];
    const gradeTenis = ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43'];

    try {
        const resProd = await fetch(`${API_URL}/catalogo/produtos/categoria/UNIFORMES`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const produtos = await resProd.json();

        let escolas = [];
        if (isAdmin) {
            const resEsc = await fetch(`${API_URL}/catalogo/locais`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            escolas = await resEsc.json();
        }

        let html = `
            <style>
                /* Campo com 75px para caber 3 dígitos (Ex: 150) com conforto */
                .input-qtd-grade { 
                    width: 75px !important; 
                    height: 40px; 
                    font-size: 1.1rem; 
                    text-align: center; 
                    border: 2px solid #cbd5e1; 
                    border-radius: 6px;
                    font-weight: bold;
                    color: #1e293b;
                }
                .input-qtd-grade::-webkit-outer-spin-button, 
                .input-qtd-grade::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .grade-container { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 8px; }
            </style>

            <div class="secao-header" style="display:flex; justify-content:space-between; align-items:center; padding:20px;">
                <h2>${isAdmin ? 'PAINEL DE PEDIDOS (ADMIN)' : 'SOLICITAR UNIFORMES'}</h2>
                <button class="btn-voltar" onclick="carregarDashboard()">VOLTAR</button>
            </div>
            
            ${isAdmin ? `
            <div style="padding: 20px; background: #eff6ff; border-bottom: 2px solid #3b82f6;">
                <label style="font-weight:bold; color:#1e40af;">UNIDADE DESTINO DO PEDIDO:</label>
                <select id="local_destino_pedido" style="width:100%; padding:15px; margin-top:10px; border-radius:8px; border:2px solid #3b82f6; font-size:1rem; font-weight:bold;">
                    <option value="">-- SELECIONE A ESCOLA PARA ONDE IRÃO OS UNIFORMES --</option>
                    ${escolas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('')}
                </select>
            </div>
            ` : `
                <input type="hidden" id="local_destino_pedido" value="AUTODETECT">
            `}

            <div style="padding: 20px;">
                <table style="width:100%; border-collapse: collapse; background:white;">
                    <thead style="background:#1e293b; color:white;">
                        <tr><th style="padding:15px; text-align:left;">UNIFORME</th><th style="padding:15px; text-align:left;">INFORME AS QUANTIDADES</th></tr>
                    </thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding:20px; font-weight:bold; color:#334155;">${p.nome}</td>
                                <td>
                                    <div class="grade-container">
                                        ${(p.nome.includes('TENIS') ? gradeTenis : gradeRoupas).map(t => `
                                            <div style="text-align:center;">
                                                <span style="font-size:0.75rem; font-weight:bold; color:#64748b; display:block;">${t}</span>
                                                <input type="number" class="input-qtd-grade" data-prod-id="${p.id}" data-tamanho="${t}" placeholder="0">
                                            </div>
                                        `).join('')}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="padding:30px; text-align:right;">
                <button onclick="enviarSolicitacaoUniforme()" style="padding:20px 60px; background:#10b981; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1.2rem;">
                    ${isAdmin ? 'GERAR PEDIDO IMEDIATO' : 'CONCLUIR SOLICITAÇÃO'}
                </button>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) { alert("Erro ao carregar formulário"); }
}

// FUNÇÃO PARA RECOLHER OS DADOS DA GRADE E GRAVAR NO BANCO
async function antigacriarenviarSolicitacaoUniforme() {
    const role = localStorage.getItem('userRole');
    const tokenAtual = localStorage.getItem('token');
    
    // 1. Captura o local de destino (seletor para Admin ou hidden para Escola)
    const inputLocalDestino = document.getElementById('local_destino_pedido');
    if (!inputLocalDestino || !inputLocalDestino.value) {
        alert("⚠️ ERRO: POR FAVOR, SELECIONE O LOCAL DE DESTINO!");
        return;
    }
    const localDestinoId = inputLocalDestino.value;

    // 2. Coleta os itens preenchidos na grade
    const inputs = document.querySelectorAll('.input-qtd-grade');
    const itens = [];
    let totalGeral = 0;

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: input.dataset.prodId,
                tamanho: input.dataset.tamanho,
                quantidade: qtd // O backend enviará para a coluna quantidade_solicitada
            });
            totalGeral += qtd;
        }
    });

    // 3. Validação: verifica se há itens no pedido
    if (itens.length === 0) {
        alert("⚠️ ATENÇÃO: VOCÊ DEVE PREENCHER A QUANTIDADE DE PELO MENOS UM ITEM.");
        return;
    }

    // 4. Define o status inicial baseado no perfil
    // Se for Admin/Super, já nasce autorizado (vai direto para separação no estoque)
    const statusFinal = (role === 'admin' || role === 'super') ? 'AGUARDANDO_SEPARACAO' : 'AGUARDANDO_AUTORIZACAO';

    // 5. Confirmação para o usuário
    const confirmacaoMsg = (role === 'admin' || role === 'super') 
        ? `CONFIRMAR CRIAÇÃO DE PEDIDO DIRETO COM ${totalGeral} ITENS?` 
        : `ENVIAR SOLICITAÇÃO DE ${totalGeral} ITENS PARA AUTORIZAÇÃO?`;

    if (!confirm(confirmacaoMsg)) return;

    try {
        // Feedback visual no botão
        const botao = document.querySelector('button[onclick="enviarSolicitacaoUniforme()"]');
        if (botao) {
            botao.disabled = true;
            botao.innerText = "PROCESSANDO...";
        }

        // 6. Envio para o Backend
        const res = await fetch(`${API_URL}/pedidos/escola`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenAtual}`
            },
            body: JSON.stringify({
                local_id: localDestinoId,
                total: totalGeral,
                itens: itens,
                status: statusFinal
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert(role === 'escola' ? "✅ SOLICITAÇÃO ENVIADA COM SUCESSO!" : "✅ PEDIDO DIRETO REGISTRADO COM SUCESSO!");
            carregarDashboard(); // Retorna à tela principal
        } else {
            throw new Error(data.error || "Erro ao salvar o pedido no servidor.");
        }

    } catch (err) {
        console.error("ERRO NO ENVIO:", err);
        alert("❌ FALHA AO ENVIAR: " + err.message);
        
        // Reabilita o botão em caso de erro
        const botao = document.querySelector('button[onclick="enviarSolicitacaoUniforme()"]');
        if (botao) {
            botao.disabled = false;
            botao.innerText = "TENTAR ENVIAR NOVAMENTE";
        }
    }
}

// 2. FUNÇÃO QUE ENVIA (Corrigida para ler os dados acima)
// 1. FUNÇÃO QUE GERA A TABELA (Verifique se a sua está assim)
function renderizarTabelaSolicitacao(produtos) {
    const container = document.getElementById('container_solicitacao');
    let html = `
        <table class="tabela-sistema">
            <thead>
                <tr>
                    <th>PRODUTO</th>
                    <th>TAMANHOS / QUANTIDADES DESEJADAS</th>
                </tr>
            </thead>
            <tbody>
                ${produtos.map(p => `
                    <tr>
                        <td>${p.nome}</td>
                        <td>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${['P', 'M', 'G', 'GG', 'XG', '38', '40', '42', '44'].map(tam => `
                                    <div style="border: 1px solid #ccc; padding: 5px; text-align: center;">
                                        <label style="display:block; font-size:10px;">${tam}</label>
                                        <input type="number" 
                                               class="qtd-solicitacao" 
                                               data-prod-id="${p.id}" 
                                               data-tamanho="${tam}" 
                                               min="0" value="0" 
                                               style="width: 50px; text-align: center;">
                                    </div>
                                `).join('')}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <button onclick="enviarSolicitacaoUniforme()" class="btn-concluir">CONCLUIR SOLICITAÇÃO</button>
    `;
    container.innerHTML = html;
}

async function enviarSolicitacaoUniforme() {
    const itens = [];
    let totalGeral = 0; // Inicializar a variável aqui
    
    // CORREÇÃO: O seletor deve ser .input-qtd-grade (o mesmo da tela)
    const inputs = document.querySelectorAll('.input-qtd-grade');
    
    inputs.forEach(input => {
        const val = input.value.trim();
        const qtd = parseInt(val);
        
        if (!isNaN(qtd) && qtd > 0) {
            itens.push({
                produto_id: input.dataset.prodId,
                tamanho: input.dataset.tamanho,
                quantidade: qtd
            });
            totalGeral += qtd;
        }
    });

    if (itens.length === 0) {
        alert("POR FAVOR, INSIRA PELO MENOS UMA QUANTIDADE.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/pedidos/escola`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}` // Use a variável TOKEN global
            },
            body: JSON.stringify({ itens })
        });

        if (res.ok) {
            alert("✅ SOLICITAÇÃO GRAVADA COM SUCESSO! AGUARDANDO AUTORIZAÇÃO.");
            carregarDashboard(); // Volta para a tela inicial
        } else {
            const erro = await res.json();
            alert("❌ ERRO: " + erro.error);
        }
    } catch (err) {
        console.error(err);
        alert("❌ ERRO DE CONEXÃO COM O SERVIDOR.");
    }
}

window.enviarSolicitacaoEscola = async function() {
    const inputs = document.querySelectorAll('.input-qtd-uniforme');
    const itens = [];
    let totalItens = 0;

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: parseInt(input.getAttribute('data-prod')), // ID correto do banco
                tamanho: input.getAttribute('data-tam'),
                quantidade: qtd
            });
            totalItens += qtd;
        }
    });

    if (itens.length === 0) return alert("PREENCHA AS QUANTIDADES!");

    if (!confirm(`CONFIRMAR SOLICITAÇÃO DE ${totalItens} ITENS?`)) return;

    try {
        const payload = {
            usuario_origem_id: USUARIO_LOGADO.id, // ID de quem está pedindo
            local_destino_id: USUARIO_LOGADO.local_id, // ID da escola
            itens: itens,
            status: 'AGUARDANDO_AUTORIZACAO' // Status que o Admin vai buscar
        };

        const res = await fetch(`${API_URL}/pedidos/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("SOLICITAÇÃO ENVIADA! AGUARDE AUTORIZAÇÃO.");
            carregarDashboard();
        } else {
            alert("ERRO AO ENVIAR");
        }
    } catch (err) {
        alert("ERRO DE CONEXÃO");
    }
};

window.detalharSolicitacao = async function(pedidoId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    try {
        // Busca os itens do pedido e dados da escola
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/detalhes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const dados = await res.json(); 

        overlay.innerHTML = `
            <div class="modal-content">
                <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                    <h3>DETALHES DA SOLICITAÇÃO #${pedidoId}</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="cursor:pointer; background:none; border:none; font-size:20px;">✕</button>
                </div>
                
                <p><strong>Escola:</strong> ${dados.escola_nome} | <strong>Solicitante:</strong> ${dados.usuario_nome}</p>

                <table class="tabela-detalhes">
                    ${gerarGradeSomenteLeitura(dados.itens)}
                </table>

                <div style="margin-top:30px; display:flex; gap:15px; justify-content:flex-end;">
                    <button onclick="decidirPedido(${pedidoId}, 'RECUSADO')" style="background:#ef4444; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">RECUSAR</button>
                    <button onclick="decidirPedido(${pedidoId}, 'AUTORIZADO')" style="background:#22c55e; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">AUTORIZAR E BAIXAR ESTOQUE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    } catch (err) {
        alert("Erro ao abrir detalhes da solicitação.");
    }
};

async function decidirPedido(pedidoId, novoStatus) {
    // ... (lógica do prompt e confirm que já fizemos)

    const btn = event.target; // Captura o botão clicado
    const textoOriginal = btn.innerText;
    
    try {
        btn.disabled = true;
        btn.innerText = "PROCESSANDO..."; // Feedback visual

        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ status: novoStatus, autorizado_por: USUARIO_LOGADO.id })
        });

        if (res.ok) {
            alert(`PEDIDO ${novoStatus} E STOCK ATUALIZADO!`);
            location.reload();
        } else {
            const erro = await res.json();
            alert("ERRO: " + erro.error);
            btn.disabled = false;
            btn.innerText = textoOriginal;
        }
    } catch (err) {
        alert("FALHA NA CONEXÃO");
        btn.disabled = false;
        btn.innerText = textoOriginal;
    }
}

function gerarGradeSomenteLeitura(itens) {
    // Agrupa itens por nome de produto para montar a linha da tabela
    const agrupado = {};
    itens.forEach(i => {
        if (!agrupado[i.nome]) agrupado[i.nome] = {};
        agrupado[i.nome][i.tamanho] = i.quantidade;
    });

    const tamanhos = [...new Set(itens.map(i => i.tamanho))].sort();

    return `
        <thead>
            <tr style="background:#f1f5f9;">
                <th style="text-align:left; padding:10px; border:1px solid #ddd;">PRODUTO</th>
                ${tamanhos.map(t => `<th style="padding:10px; border:1px solid #ddd;">${t}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${Object.keys(agrupado).map(nomeProd => `
                <tr>
                    <td style="padding:10px; border:1px solid #ddd; font-weight:bold;">${nomeProd}</td>
                    ${tamanhos.map(t => `
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;">
                            ${agrupado[nomeProd][t] || '-'}
                        </td>
                    `).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;
}

async function verificarPendenciasAdmin() {
    if (USUARIO_LOGADO.perfil !== 'admin') return;

    try {
        const res = await fetch(`${API_URL}/pedidos?status=AGUARDANDO_AUTORIZACAO`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        const containerAlerta = document.getElementById('area-alertas-admin');
        if (pedidos.length > 0) {
            containerAlerta.innerHTML = `
                <div class="banner-alerta-admin" onclick="abrirListaSolicitacoes()">
                    🚨 ATENÇÃO: EXISTEM ${pedidos.length} SOLICITAÇÕES DE UNIFORME AGUARDANDO AUTORIZAÇÃO!
                </div>
            `;
        } else {
            containerAlerta.innerHTML = '';
        }
    } catch (err) {
        console.error("Erro ao verificar pendências", err);
    }
}

// --- MODAL DE DETALHES (TELA POR CIMA) ---
window.abrirDetalheHistorico = async function(historicoId) {
    try {
        const res = await fetch(`${API_URL}/historico/${historicoId}/detalhes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const itens = await res.json();

        // Criar o overlay (fundo escuro)
        const overlay = document.createElement('div');
        overlay.className = 'overlay-detalhe';
        
        overlay.innerHTML = `
            <div class="modal-detalhe-conteudo">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">
                    <h3 style="margin:0; color:#1e40af;">📋 DETALHES DA SOLICITAÇÃO #${historicoId}</h3>
                    <button class="btn-fechar-detalhe" style="margin:0;" onclick="this.closest('.overlay-detalhe').remove()">❌ FECHAR</button>
                </div>
                
                <div style="overflow-x: auto; background: #fff;">
                    <table class="tabela-solicitacao-uniforme">
                        ${gerarTabelaSomenteLeitura(itens)}
                    </table>
                </div>
                
                <div style="margin-top:15px; text-align:right; font-size:0.9rem; color:#666;">
                    * Valores exibidos conforme registro original no banco de dados.
                </div>
            </div>
        `;

        // Adiciona ao corpo da página
        document.body.appendChild(overlay);

        // Fechar ao apertar ESC
        const fecharEsc = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', fecharEsc);
            }
        };
        document.addEventListener('keydown', fecharEsc);

    } catch (err) {
        console.error(err);
        alert("Erro ao carregar detalhes do histórico.");
    }
};

// Função que transforma a lista do banco na grade visual da "Imagem 2"
window.gerarTabelaSomenteLeitura = function(itensDB) {
    const gradeRoupa = ["02", "04", "06", "08", "10", "12", "14", "P", "M", "G", "GG"];
    const gradeTenis = ["25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40"];
    const roupas = ["BLUSA", "CALÇA", "REGATA", "BERMUDA"];

    const buscarQtd = (prod, tam) => {
        const item = itensDB.find(i => i.produto === prod && i.tamanho === tam);
        return item ? item.quantidade : '';
    };

    return `
        <thead>
            <tr>
                <th style="text-align:left; padding-left:10px;">VESTUÁRIO</th>
                ${gradeRoupa.map(t => `<th>${t}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${roupas.map(nome => `
                <tr>
                    <td class="col-produto">${nome}</td>
                    ${gradeRoupa.map(t => `<td style="font-weight:bold; color:#2563eb;">${buscarQtd(nome, t)}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
        <thead class="header-calcados">
            <tr>
                <th style="text-align:left; padding-left:10px;">CALÇADOS</th>
                ${gradeTenis.map(t => `<th>${t}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="col-produto">TÊNIS</td>
                ${gradeTenis.map(t => `<td class="grade-tenis" style="font-weight:bold; color:#d35400;">${buscarQtd("TENIS", t)}</td>`).join('')}
            </tr>
        </tbody>
    `;
};

window.verLogsSistema = async function(pedidoIdFiltro = '', escolaFiltro = '') {
    const container = document.getElementById('app-content');
    
    try {
        const url = new URL(`${API_URL}/pedidos/logs/historico`);
        if (pedidoIdFiltro) url.searchParams.append('pedido_id', pedidoIdFiltro);
        if (escolaFiltro) url.searchParams.append('escola', escolaFiltro);

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const logs = await res.json();

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="color:#1e293b; margin:0;">📋 AUDITORIA DE SOLICITAÇÕES</h2>
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; padding:8px 15px; border-radius:5px; cursor:pointer; border:none;">⬅ VOLTAR</button>
            </div>

            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:20px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-size:0.75rem; font-weight:bold; color:#475569;">PEDIDO #</label>
                    <input type="number" id="filtro-pedido-id" value="${pedidoIdFiltro}" placeholder="Ex: 123" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; width:100px;">
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-size:0.75rem; font-weight:bold; color:#475569;">ESCOLA</label>
                    <input type="text" id="filtro-escola-nome" value="${escolaFiltro}" placeholder="Nome da unidade..." style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; width:250px;">
                </div>
                <button onclick="aplicarFiltroLogs()" style="background:#2563eb; color:white; padding:9px 20px; border-radius:4px; cursor:pointer; border:none; font-weight:bold;">BUSCAR</button>
                <button onclick="verLogsSistema()" style="background:#94a3b8; color:white; padding:9px 15px; border-radius:4px; cursor:pointer; border:none;">LIMPAR</button>
            </div>
            
            <div class="card-solicitacao" style="padding:0; overflow:hidden; background:white; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                    <thead style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:15px; text-align:left;">DATA/HORA</th>
                            <th style="padding:15px; text-align:left;">ADMINISTRADOR</th>
                            <th style="padding:15px; text-align:left;">PEDIDO</th>
                            <th style="padding:15px; text-align:left;">ESCOLA</th>
                            <th style="padding:15px; text-align:center;">MUDANÇA DE STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:12px;">${new Date(log.data).toLocaleString('pt-BR')}</td>
                                <td style="padding:12px; font-weight:500;">${log.usuario_nome}</td>
                                <td style="padding:12px;">
                                    <a href="#" onclick="event.preventDefault(); detalharSolicitacao(${log.pedido_id})" 
                                       style="color: #2563eb; font-weight: bold; text-decoration: underline;">
                                       #${log.pedido_id}
                                    </a>
                                </td>
                                <td style="padding:12px;">${log.escola_nome}</td>
                                <td style="padding:12px; text-align:center;">
                                    <span style="background:#f1f5f9; padding:3px 8px; border-radius:4px; color:#64748b; font-size:0.75rem;">${log.status_anterior}</span> 
                                    <span style="margin:0 5px; color:#94a3b8;">➡</span> 
                                    <span style="background:${log.status_novo === 'AUTORIZADO' ? '#dcfce7' : '#fee2e2'}; 
                                                 color:${log.status_novo === 'AUTORIZADO' ? '#16a34a' : '#dc2626'}; 
                                                 padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">
                                        ${log.status_novo}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div style="color:red; padding:20px;">Erro ao carregar logs: ${err.message}</div>`;
    }
};

// Função auxiliar para capturar os inputs e recarregar a tela
window.aplicarFiltroLogs = function() {
    const id = document.getElementById('filtro-pedido-id').value;
    const escola = document.getElementById('filtro-escola-nome').value;
    verLogsSistema(id, escola);
};

async function salvarCadastro() {
    const tabela = document.getElementById('selecionarTabela').value;
    const nome = document.getElementById('nome_cadastro')?.value;
    const categoriaId = document.getElementById('categoria_id')?.value;

    // BLOQUEIO: Se for produto e a categoria for UNIFORMES (supondo que o ID da categoria UNIFORMES seja conhecido)
    // Dica: No seu código, você pode buscar o nome da categoria selecionada antes de enviar
    if (tabela === 'produtos' && document.getElementById('categoria_id').selectedOptions[0].text === 'UNIFORMES') {
        alert("NÃO É PERMITIDO CADASTRAR NOVOS PRODUTOS NESTA CATEGORIA. USE OS PRODUTOS PADRÃO.");
        return;
    }
    
    // ... restante do seu código de fetch para salvar ...
}

// 1. LISTAGEM DE SOLICITAÇÕES
async function telaHistoricoSolicitacoes() {
    const role = localStorage.getItem('userRole');
    if (!['admin', 'super', 'estoque'].includes(role)) return;

    const container = document.getElementById('app-content');
    container.innerHTML = 'carregando...';

    try {
        // Buscamos os pedidos com status de AGUARDANDO_AUTORIZACAO ou todos
        const res = await fetch(`${API_URL}/pedidos`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div class="secao-header">
                <h2>SOLICITAÇÕES DE UNIFORMES RECEBIDAS</h2>
                <button class="btn-voltar" onclick="carregarDashboard()">VOLTAR</button>
            </div>
            <p style="padding:10px; color:#666;">* Dê um <b>duplo clique</b> na linha para ver os tamanhos solicitados.</p>
            <table class="tabela-logs">
                <thead>
                    <tr>
                        <th>DATA/HORA</th>
                        <th>ESCOLA (LOCAL)</th>
                        <th>SOLICITANTE</th>
                        <th>TOTAL ITENS</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${pedidos.map(p => `
                        <tr ondblclick="verDetalhesPedidoGrade(${p.id})" tabindex="0" onkeydown="if(event.key==='Enter') verDetalhesPedidoGrade(${p.id})" style="cursor:pointer;">
                            <td>${new Date(p.data_criacao).toLocaleString()}</td>
                            <td>${p.escola_nome}</td>
                            <td>${p.usuario_nome}</td>
                            <td>${p.total_itens || 0}</td>
                            <td><span class="badge-${p.status}">${p.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    } catch (err) { console.error(err); }
}

// 2. VISUALIZAÇÃO DETALHADA EM GRADE (MODAL OU TELA)
async function verDetalhesPedidoGrade(pedidoId) {
    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/itens`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const itens = await res.json();

        // Organizar itens por produto para montar a grade
        const produtosAgrupados = {};
        itens.forEach(it => {
            if (!produtosAgrupados[it.produto_nome]) produtosAgrupados[it.produto_nome] = [];
            produtosAgrupados[it.produto_nome].push(it);
        });

        let htmlModal = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000; display:flex; align-items:center; justify-content:center;">
                <div style="background:white; width:90%; max-height:90%; overflow-y:auto; padding:20px; border-radius:8px;">
                    <h3>DETALHES DA SOLICITAÇÃO #${pedidoId}</h3>
                    <table class="tabela-grade">
                        <thead><tr><th>PRODUTO</th><th>TAMANHOS REQUISITADOS</th></tr></thead>
                        <tbody>
                            ${Object.keys(produtosAgrupados).map(nome => `
                                <tr>
                                    <td><b>${nome}</b></td>
                                    <td>
                                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                            ${produtosAgrupados[nome].map(i => `
                                                <div style="background:#f1f5f9; padding:5px 10px; border-radius:4px; border:1px solid #cbd5e1;">
                                                    <b>${i.tamanho}:</b> ${i.quantidade_solicitada}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div style="margin-top:20px; text-align:right;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="padding:10px 20px; cursor:pointer;">FECHAR</button>
                        <button onclick="autorizarPedido(${pedidoId})" style="background:green; color:white; padding:10px 20px; border:none; margin-left:10px; cursor:pointer;">AUTORIZAR AGORA</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', htmlModal);
    } catch (err) { alert("Erro ao carregar detalhes"); }
}

async function telaEntradaEstoqueUniforme() {
    const container = document.getElementById('app-content');
    container.innerHTML = 'CARREGANDO...';
    
    // 1. Busca os produtos de uniformes
    const res = await fetch(`${API_URL}/catalogo/produtos/categoria/UNIFORMES`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const produtos = await res.json();

    let html = `
        <div class="secao-header">
            <h2>ENTRADA DE MERCADORIA (ABASTECER GRADE)</h2>
            <button onclick="carregarDashboard()">VOLTAR</button>
        </div>
        <div style="padding:20px;">
            <p>Selecione o produto e digite a quantidade que está CHEGANDO ao estoque central.</p>
            <table style="width:100%; border-collapse: collapse; background: white;">
                ${produtos.map(p => `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding:15px; font-weight:bold;">${p.nome}</td>
                        <td>
                            <div class="grade-container" style="display:flex; flex-wrap:wrap; gap:5px;">
                                ${(p.nome.includes('TENIS') ? 
                                    ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43'] : 
                                    ['2','4','6','8','10','12','14','16','PP','P','M','G','GG','EGG']
                                ).map(t => `
                                    <div style="text-align:center;">
                                        <span style="font-size:0.7rem;">${t}</span>
                                        <input type="number" class="input-abastecer" data-prod-id="${p.id}" data-tamanho="${t}" style="width:50px; text-align:center;">
                                    </div>
                                `).join('')}
                            </div>
                        </td>
                        <td>
                            <button onclick="salvarAbastecimento(${p.id}, this)" style="background:blue; color:white; border:none; padding:10px; cursor:pointer;">SALVAR ENTRADA</button>
                        </td>
                    </tr>
                `).join('')}
            </table>
        </div>
    `;
    container.innerHTML = html;
}

// Função para listar os pedidos na fila do estoque
async function listarFilaSeparacao() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">CARREGANDO FILA DE SEPARAÇÃO...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/fila-separacao`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📦 FILA DE SEPARAÇÃO DE UNIFORMES</h2>
                <div style="display: grid; gap: 15px;">
                    ${pedidos.length === 0 ? '<p>NENHUM PEDIDO AGUARDANDO NO MOMENTO.</p>' : ''}
                    ${pedidos.map(p => `
                        <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; border-left: 5px solid ${p.status === 'SEPARACAO_INICIADA' ? '#f59e0b' : '#10b981'};">
                            <div>
                                <span style="font-size: 0.8rem; color: #64748b;">PEDIDO #${p.id}</span>
                                <div style="font-size: 1.1rem; font-weight: bold; color: #1e293b;">${p.escola}</div>
                                <div style="font-size: 0.85rem; color: #475569;">Autorizado em: ${new Date(p.data_autorizacao).toLocaleString()}</div>
                                <div style="margin-top: 5px;">
                                    <span style="background: ${p.status === 'SEPARACAO_INICIADA' ? '#fef3c7' : '#dcfce7'}; color: ${p.status === 'SEPARACAO_INICIADA' ? '#92400e' : '#166534'}; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                                        ${p.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            <div>
                                ${p.status === 'AUTORIZADO_SEPARACAO' ? 
                                    `<button onclick="iniciarProcessoSeparacao(${p.id})" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">INICIAR SEPARAÇÃO</button>` :
                                    `<button onclick="abrirPainelSeparacao(${p.id})" style="padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">CONTINUAR SEPARANDO</button>`
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        alert("ERRO AO CARREGAR FILA");
    }
}

// Muda o status para SEPARACAO_INICIADA
async function iniciarProcessoSeparacao(id) {
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/iniciar-separacao`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (res.ok) {
            alert("🚀 SEPARAÇÃO INICIADA COM SUCESSO!");
            listarFilaSeparacao(); // Recarrega a lista
        } else {
            alert("ERRO AO INICIAR SEPARAÇÃO");
        }
    } catch (err) {
        alert("ERRO DE CONEXÃO");
    }
}

async function telaAbastecerEstoque() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">CARREGANDO PRODUTOS...</div>';

    const gradeRoupas = ['2','4','6','8','10','12','14','16','PP','P','M','G','GG','EGG'];
    const gradeTenis = ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43'];

    try {
        const res = await fetch(`${API_URL}/catalogo/produtos/categoria/UNIFORMES`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const produtos = await res.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📥 ENTRADA DE UNIFORMES (ABASTECIMENTO)</h2>
                <table style="width:100%; border-collapse: collapse; background: white;">
                    <thead>
                        <tr style="background: #f1f5f9; text-align: left;">
                            <th style="padding:15px;">PRODUTO</th>
                            <th style="padding:15px;">GRADE DE ENTRADA</th>
                            <th style="padding:15px;">AÇÃO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding:15px; font-weight:bold;">${p.nome}</td>
                                <td style="padding:15px;">
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                        ${(p.nome.includes('TENIS') ? gradeTenis : gradeRoupas).map(t => `
                                            <div style="text-align:center; background:#f8fafc; padding:5px; border-radius:4px; border:1px solid #e2e8f0;">
                                                <span style="font-size:10px; display:block; font-weight:bold;">${t}</span>
                                                <input type="number" class="input-abastecer-${p.id}" data-tamanho="${t}" min="0" placeholder="0" style="width:45px; text-align:center; border:1px solid #cbd5e1;">
                                            </div>
                                        `).join('')}
                                    </div>
                                </td>
                                <td style="padding:15px;">
                                    <button onclick="salvarAbastecimento(${p.id})" style="padding:10px; background:#1e40af; color:white; border:none; border-radius:4px; cursor:pointer;">SALVAR</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) { alert("Erro ao carregar tela de abastecimento"); }
}

async function salvarAbastecimento(produtoId) {
    const inputs = document.querySelectorAll(`.input-abastecer-${produtoId}`);
    const itens = [];
    inputs.forEach(i => {
        const qtd = parseInt(i.value);
        if (qtd > 0) itens.push({ tamanho: i.dataset.tamanho, quantidade: qtd });
    });

    if (itens.length === 0) return alert("INSIRA AO MENOS UMA QUANTIDADE!");

    try {
        const res = await fetch(`${API_URL}/pedidos/abastecer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ produto_id: produtoId, itens })
        });
        if (res.ok) {
            alert("✅ ESTOQUE ATUALIZADO!");
            // Limpa os inputs desta linha
            inputs.forEach(i => i.value = '');
        }
    } catch (err) { alert("Erro ao salvar"); }
}

async function telaAdminCriarPedido() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; font-weight:bold;">CARREGANDO FORMULÁRIO DE PEDIDO...</div>';

    // Grades Oficiais
    const gradeRoupas = ['2','4','6','8','10','12','14','16','PP','P','M','G','GG','EGG'];
    const gradeTenis = ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43'];

    try {
        // 1. Busca Escolas e Produtos em paralelo
        const [resEscolas, resProdutos] = await Promise.all([
            fetch(`${API_URL}/catalogo/locais`, { headers: { 'Authorization': `Bearer ${TOKEN}` } }),
            fetch(`${API_URL}/catalogo/produtos/categoria/UNIFORMES`, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
        ]);

        const escolas = await resEscolas.json();
        const produtos = await resProdutos.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📝 CRIAR PEDIDO DIRETO (ADMINISTRAÇÃO)</h2>
                
                <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #cbd5e1;">
                    <label style="display:block; font-weight:bold; margin-bottom:10px; color:#334155;">SELECIONE A ESCOLA / LOCAL DE DESTINO:</label>
                    <select id="select-destino-admin" style="width:100%; padding:12px; border-radius:6px; border:1px solid #94a3b8; font-size:1rem;">
                        <option value="">-- SELECIONE O LOCAL --</option>
                        ${escolas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('')}
                    </select>
                </div>

                <table class="tabela-sistema" style="width:100%; background:white; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #1e40af; color: white;">
                            <th style="padding:15px; text-align:left;">PRODUTO</th>
                            <th style="padding:15px; text-align:center;">GRADE DE QUANTIDADES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding:15px; font-weight:bold; color:#1e293b; width:250px;">${p.nome}</td>
                                <td style="padding:15px;">
                                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px;">
                                        ${(p.nome.includes('TENIS') ? gradeTenis : gradeRoupas).map(t => `
                                            <div style="text-align:center; border: 1px solid #e2e8f0; padding:5px; border-radius:4px;">
                                                <span style="font-size:10px; font-weight:bold; display:block; color:#64748b;">${t}</span>
                                                <input type="number" 
                                                       class="input-pedido-admin" 
                                                       data-prod-id="${p.id}" 
                                                       data-tamanho="${t}" 
                                                       min="0" placeholder="0" 
                                                       style="width:100%; text-align:center; border:none; outline:none; font-size:14px;">
                                            </div>
                                        `).join('')}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top:30px; text-align:right;">
                    <button onclick="enviarPedidoDiretoAdmin()" 
                            style="padding:15px 50px; background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        GERAR PEDIDO E BAIXAR ESTOQUE
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        alert("Erro ao carregar formulário de pedido direto.");
    }
}

async function enviarPedidoDiretoAdmin() {
    const destinoId = document.getElementById('select-destino-admin').value;
    if (!destinoId) return alert("POR FAVOR, SELECIONE O LOCAL DE DESTINO!");

    const itens = [];
    const inputs = document.querySelectorAll('.input-pedido-admin');
    
    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: input.dataset.prodId,
                tamanho: input.dataset.tamanho,
                quantidade: qtd
            });
        }
    });

    if (itens.length === 0) return alert("INSIRA AO MENOS UMA QUANTIDADE!");

    if (!confirm("ESTA AÇÃO CRIARÁ O PEDIDO E BAIXARÁ O ESTOQUE IMEDIATAMENTE. CONFIRMA?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/admin-direto`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${TOKEN}` 
            },
            body: JSON.stringify({ 
                itens, 
                local_destino_id: destinoId 
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ PEDIDO DIRETO REGISTRADO E ESTOQUE ATUALIZADO!");
            carregarDashboard();
        } else {
            alert("❌ ERRO: " + data.error);
        }
    } catch (err) {
        alert("Erro de conexão com o servidor.");
    }
}

async function abrirPainelSeparacao(id) {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">ABRINDO PAINEL DE CONFERÊNCIA...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/detalhes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const itens = await res.json();

        let html = `
            <div style="padding:20px;">
                <button onclick="listarFilaSeparacao()" style="margin-bottom:20px; cursor:pointer;">⬅ VOLTAR À FILA</button>
                <h2 style="color: #1e3a8a;">📦 CONFERÊNCIA DE ITENS - PEDIDO #${id}</h2>
                <p style="color: #64748b; margin-bottom:20px;">Informe as quantidades que estão sendo enviadas nesta remessa.</p>

                <table style="width:100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding:12px; text-align:left;">PRODUTO</th>
                            <th style="padding:12px;">TAMANHO</th>
                            <th style="padding:12px;">AUTORIZADO</th>
                            <th style="padding:12px; width:150px;">A ENVIAR (CONFERIDO)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itens.map(item => `
                            <tr>
                                <td style="padding:12px; border-bottom:1px solid #eee;">${item.produto_nome}</td>
                                <td style="padding:12px; border-bottom:1px solid #eee; text-align:center;">${item.tamanho}</td>
                                <td style="padding:12px; border-bottom:1px solid #eee; text-align:center; font-weight:bold;">${item.quantidade_solicitada}</td>
                                <td style="padding:12px; border-bottom:1px solid #eee; text-align:center;">
                                    <input type="number" 
                                           class="input-conferencia" 
                                           data-prod-id="${item.produto_id}" 
                                           data-tamanho="${item.tamanho}" 
                                           data-max="${item.quantidade_solicitada}"
                                           value="${item.quantidade_solicitada}" 
                                           style="width:70px; padding:5px; text-align:center; border: 1px solid #1e40af; border-radius:4px; font-weight:bold;">
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top:25px; background: #eff6ff; padding:20px; border-radius:8px; border: 1px solid #bfdbfe;">
                    <label style="font-weight:bold; display:block; margin-bottom:10px;">QUANTIDADE TOTAL DE VOLUMES (CAIXAS/PACOTES):</label>
                    <input type="number" id="qtd-volumes" min="1" value="1" style="width:100px; padding:10px; font-size:1.2rem; text-align:center; border-radius:4px; border:1px solid #3b82f6;">
                </div>

                <div style="margin-top:20px;">
                    <button onclick="finalizarConferencia(${id})" style="width:100%; padding:20px; background:#1e40af; color:white; font-weight:bold; border:none; border-radius:8px; cursor:pointer; font-size:1.1rem;">
                        CONCLUIR CONFERÊNCIA E LIBERAR PARA COLETA
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) { alert("Erro ao carregar itens para conferência"); }
}

async function finalizarConferencia(id) {
    const inputs = document.querySelectorAll('.input-conferencia');
    const volumes = document.getElementById('qtd-volumes').value;
    const itens_conferidos = [];

    // Validação no front antes de enviar
    for (let input of inputs) {
        const qtd = parseInt(input.value);
        const max = parseInt(input.dataset.max);
        if (qtd > max) {
            alert(`ALERTA: Você está tentando enviar ${qtd} unidades, mas o autorizado são apenas ${max}! Corrija antes de prosseguir.`);
            input.focus();
            return;
        }
        if (qtd > 0) {
            itens_conferidos.push({
                produto_id: input.dataset.prodId,
                tamanho: input.dataset.tamanho,
                quantidade_conferida: qtd
            });
        }
    }

    if (volumes < 1) return alert("INFORME A QUANTIDADE DE VOLUMES!");

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/concluir-separacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ itens_conferidos, volumes })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            listarFilaSeparacao();
        } else {
            alert("❌ ERRO: " + data.error);
        }
    } catch (err) { alert("Erro na requisição"); }
}

async function listarColetasLogistica() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">BUSCANDO COLETAS...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/fila-coleta`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">🚚 COLETAS LIBERADAS (LOGÍSTICA)</h2>
                ${pedidos.map(p => `
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid #3b82f6;">
                        <div>
                            <span style="font-weight: bold; color: #1e40af;">PEDIDO #${p.id}</span>
                            <div style="font-size: 1.2rem; font-weight: bold;">DESTINO: ${p.escola}</div>
                            <div style="color: #ef4444; font-weight: bold;">📦 VOLUMES: ${p.volumes}</div>
                        </div>
                        <button onclick="confirmarSaidaTransporte(${p.id})" style="padding: 12px 25px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                            INICIAR TRANSPORTE
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html || '<p style="padding:20px;">NENHUMA COLETA AGUARDANDO.</p>';
    } catch (err) { alert("Erro ao carregar coletas"); }
}

async function confirmarSaidaTransporte(id) {
    if (!confirm("CONFIRMA QUE OS VOLUMES FORAM COLETADOS E O TRANSPORTE FOI INICIADO?")) return;
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/iniciar-transporte`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (res.ok) {
            alert("✅ TRANSPORTE INICIADO!");
            listarColetasLogistica();
        }
    } catch (err) { alert("Erro ao processar"); }
}

async function listarPedidosEmCaminho() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">VERIFICANDO ENTREGAS...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/alertas-escola`, { // Rota que já existia no seu backend
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">🚚 PEDIDOS EM TRANSPORTE PARA SUA UNIDADE</h2>
                ${pedidos.map(p => `
                    <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fcd34d; margin-bottom: 15px;">
                        <div style="font-weight: bold; font-size: 1.1rem;">PEDIDO #${p.id} - A CAMINHO</div>
                        <p>Sua solicitação já saiu do estoque e está em transporte.</p>
                        <button onclick="confirmarEntregaEscola(${p.id})" style="margin-top: 10px; padding: 10px 20px; background: #1e40af; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            CONFIRMAR QUE RECEBI A ENTREGA
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html || '<p style="padding:20px;">Nenhum pedido em transporte para seu local no momento.</p>';
    } catch (err) { alert("Erro ao buscar entregas"); }
}

async function confirmarEntregaEscola(id) {
    if (!confirm("CONFIRMA O RECEBIMENTO DESTA ENTREGA?")) return;
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/confirmar-recebimento`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (res.ok) {
            alert("✅ ENTREGA CONCLUÍDA! OBRIGADO.");
            carregarDashboard();
        }
    } catch (err) { alert("Erro ao confirmar"); }
}