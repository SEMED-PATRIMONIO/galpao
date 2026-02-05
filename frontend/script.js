const API_URL = 'https://patrimoniosemed.paiva.api.br';
let TOKEN = localStorage.getItem('token');
const tokenParaUso = localStorage.getItem('token');

function prepararContainerPrincipal() {
    const app = document.getElementById('app-content');
    
    // Aplica a classe CSS padronizada com efeito de vidro
    app.className = 'painel-principal'; 
    
    // Limpa o conteúdo e define um carregamento elegante
    app.innerHTML = `
        <div style="padding:40px; text-align:center; color:#1e3a8a;">
            <div class="spinner"></div> <p style="font-weight:bold; margin-top:10px;">Sincronizando dados...</p>
        </div>
    `;
    
    return app;
}

function inicializarFundo() {
    const bg = document.getElementById('bg-container');
    if (!bg) return;

    // Gera 200 vezes a palavra SEMED para garantir que encha a tela
    let htmlContent = '';
    for (let i = 0; i < 200; i++) {
        htmlContent += '<span>SEMED</span>';
    }
    bg.innerHTML = htmlContent;
}
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
    }});

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usuario = document.getElementById('usuario').value;
    const senha = document.getElementById('senha').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, senha })
        });

        const data = await res.json();

        if (res.ok) {
            // --- INÍCIO DO TRECHO QUE VOCÊ PERGUNTOU ---
            localStorage.setItem('token', data.token);
            localStorage.setItem('perfil', data.perfil);
            localStorage.setItem('nome', data.nome);
            localStorage.setItem('local_id', data.local_id); // Salva o ID da Escola no navegador
            TOKEN = data.token;
            carregarDashboard();
            // --- FIM DO TRECHO ---
        } else {
            alert('ERRO: ' + (data.message || 'Falha no login'));
        }
    } catch (err) {
        console.error("Erro na conexão de login:", err);
        alert("Erro ao conectar com o servidor.");
    }
});

function toggleSenha() {
    const senhaInput = document.getElementById('senha');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (senhaInput.type === 'password') {
        senhaInput.type = 'text';
        eyeIcon.innerHTML = '👁️‍🗨️'; // Ícone de olho aberto
    } else {
        senhaInput.type = 'password';
        eyeIcon.innerHTML = '👁️'; // Ícone de olho fechado/normal
    }
}

function mostrarLogin() {
    const app = document.getElementById('app-content');
    const loginContainer = document.getElementById('login-container');
    
    // 1. Remove fundo anterior se o usuário deslogar e voltar
    const bgAntigo = document.querySelector('.login-bg-wrapper');
    if (bgAntigo) bgAntigo.remove();

    // 2. Criar o fundo com 400 repetições para garantir preenchimento total
    let backgroundHTML = '<div class="login-bg-wrapper">';
    for (let i = 0; i < 400; i++) {
        backgroundHTML += '<span>SEMED</span>';
    }
    backgroundHTML += '</div>';

    // 3. Aplica os estilos ao body
    document.body.style.backgroundColor = "#1e3a8a"; // Cor de segurança
    document.body.insertAdjacentHTML('afterbegin', backgroundHTML);
    
    // 4. Exibe o container de login com efeito suave
    loginContainer.style.display = 'block';
    loginContainer.style.opacity = '0';
    app.style.display = 'none';

    // Pequeno delay para a transição de opacidade
    setTimeout(() => {
        loginContainer.style.transition = 'opacity 1s ease';
        loginContainer.style.opacity = '1';
    }, 100);
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

async function inicializarSessaoUsuario() {
    try {
        const res = await fetch(`${API_URL}/auth/quem-sou-eu`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            localStorage.setItem('nome', user.nome);
            localStorage.setItem('perfil', user.perfil);
            localStorage.setItem('local_id', user.local_id);
            
            // --- LINHA ADICIONADA: Salva o ID do técnico (usuário) ---
            localStorage.setItem('usuario_id', user.id); 
            
            console.log(`Sessão sincronizada: ${user.nome} (ID: ${user.id})`);
        }
    } catch (err) {
        console.error("Erro ao sincronizar sessão:", err);
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
async function carregarDashboard() {
    let chart1, chart2;
    let dadosEstoqueCache = [];
    let categoriaAtual = 'UNIFORMES';
    let carrinhoAdmin = [];
    let chartTecnicos = null; // Variável global para controle do gráfico
    await inicializarSessaoUsuario();
    const perfil = localStorage.getItem('perfil') ? localStorage.getItem('perfil').toLowerCase() : null;
    const nome = localStorage.getItem('nome');
    const localId = localStorage.getItem('local_id');
    const container = document.getElementById('app-content');
    const loginContainer = document.getElementById('login-container');
    let modoComparacao = false;
    if (container) {
        container.style.display = 'block';
        container.style.position = 'relative'; // Reforço via JS
        container.style.zIndex = '20';         // Reforço via JS
    }

    if (!perfil) {
        if (loginContainer) loginContainer.style.display = 'block';
        if (container) container.style.display = 'none';
        return;
    }

    if (loginContainer) loginContainer.style.display = 'none';
    if (container) container.style.display = 'block';

    // Cabeçalho Padrão
    let html = `
        <div class="painel-usuario-vidro">
            <span class="nome-usuario-painel">${nome.toUpperCase()}</span>
            <button onclick="logout()" class="btn-sair-vidro">SAIR</button>
        </div>

        <div id="area-alertas" style="margin-top: 80px; margin-bottom: 20px;"></div>
        
        <div class="grid-menu-principal">
    `;

    // --- 1. FERRAMENTAS COMUNS (Todos os perfis) ---
    const menuComum = `
        <button class="btn-grande btn-vidro" style="grid-column: 1;" onclick="telaAlterarSenha()">
            <i>🔑</i><span>ALTERAR MINHA SENHA</span>
        </button>
    `;

    // --- 2. PERFIL: SUPER (Gestão de Usuários) ---
    if (perfil === 'super') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaGerenciarUsuarios()">
                <i>👥</i><span>GERENCIAR USUÁRIOS</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaAdminDashboard()">
                <i>📈</i><span>PAINEL DE PEDIDOS</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaVisualizarEstoque()">
                <i>👕</i><span>VER ESTOQUE DE UNIFORMES</span>
            </button>
            <button class="btn-grande btn-vidro" style="background:rgba(16, 185, 129, 0.2);" onclick="telaEstoqueMateriaisEPatrimonios()">
                <i>📦</i><span>VER ESTOQUE DE MATERIAIS</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaHistoricoMovimentacoes()">
                <i>📜</i><span>HISTÓRICO</span>
            </button>
        `;
    }
    if (perfil === 'dti') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaCadastroImpressoras()">
                <i>🖨️</i><span>CADASTRAR IMPRESSORAS</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaFilaAtendimentoImpressoras()">
                <i>📋</i><span>CHAMADOS EM ABERTO</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaDashboardImpressoras()">
                <i>📈</i><span>DASHBOARD TÉCNICO</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaConsumoImpressoras()">
                <i>📊</i><span>UTILIZAÇÃO E CONSUMO</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaRelatorioGeralAtivos()">
                <i>📋</i><span>IMPRESSORAS DO CONTRATO</span>
            </button>
        `;
    }
    if (perfil === 'impres') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaListarChamadosAbertos()">
                <i>📋</i><span>FILA DE CHAMADOS</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaConsumoImpressoras()">
                <i>📊</i><span>UTILIZAÇÃO E CONSUMO</span>
            </button>            
        `;
    }
    // --- 3. PERFIL: ESCOLA ---
    if (perfil === 'escola') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaEscolaConfirmarRecebimento()">
                <i>🚚</i><span>CONFIRMAR RECEBIMENTO</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaSolicitarUniforme()">
                <i>👕</i><span>SOLICITAR UNIFORMES</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaDevolucaoUniforme()">
                <i>🔄</i><span>DEVOLVER UNIFORMES</span>
            </button>
            <button class="btn-grande btn-vidro" style="grid-column: 1;" onclick="telaSolicitarServicoImpressora('recarga')">
                <i>💧</i><span>SOLICITAR RECARGA DE TONER</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaSolicitarServicoImpressora('manutencao')">
                <i>🛠️</i><span>SOLICITAR MANUTENÇÃO IMPRESSORA</span>
            </button>
        `;
        // Chama alertas específicos da escola (Pedidos em transporte para o localId)
        setTimeout(() => verificarAlertasEscola(), 500);
    }

    // --- 4. PERFIL: ADMIN ---
    if (perfil === 'admin') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaCadastrosBase()">
                <i>⚙️</i><span>CADASTROS BÁSICOS</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaAdminGerenciarSolicitacoes()">
                <i>⚖️</i><span>AUTORIZAR SOLICITAÇÕES</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaAbastecerEstoque()">
                <i>📥</i><span>ENTRADA ESTOQUE</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaAdminCriarPedido()">
                <i>➕</i><span>CRIAR PEDIDO</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaVisualizarEstoque()">
                <i>👕</i><span>VER ESTOQUE DE UNIFORMES</span>
            </button>
            <button class="btn-grande btn-vidro" style="background:rgba(16, 185, 129, 0.2);" onclick="telaEstoqueMateriaisEPatrimonios()">
                <i>📦</i><span>VER ESTOQUE DE MATERIAIS</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaInventarioLocal()">
                <i>🏷️</i><span>INVENTÁRIO PATRIMÔNIO</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaAdminDashboard()">
                <i>📈</i><span>PAINEL DE PEDIDOS</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaHistoricoMovimentacoes()">
                <i>📜</i><span>HISTÓRICO</span>
            </button>

        `;
        // Chama alertas de novas solicitações de Escolas e Logística
        setTimeout(() => verificarSolicitacoesPendentes(), 500);
    }

    // --- 5. PERFIL: ESTOQUE ---
    if (perfil === 'estoque') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaEstoquePedidosPendentes()">
                <i>📦</i><span>SEPARAÇÃO DE VOLUMES</span>
            </button>
            <button class="btn-grande btn-vidro onclick="telaCadastrosBase()">
                <i>⚙️</i><span>CADASTROS BÁSICOS</span>
            </button>            
            <button class="btn-grande btn-vidro" onclick="telaAbastecerEstoque()">
                <i>📥</i><span>ENTRADA ESTOQUE</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaReceberDevolucoes()">
                <i>🔄</i><span>RECEBER DEVOLUÇÕES</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaVisualizarEstoque()">
                <i>👕</i><span>VER ESTOQUE DE UNIFORMES</span>
            </button>
            <button class="btn-grande btn-vidro" style="background:rgba(16, 185, 129, 0.2);" onclick="telaEstoqueMateriaisEPatrimonios()">
                <i>📦</i><span>VER ESTOQUE DE MATERIAIS</span>
            </button>
            <button class="btn-grande btn-vidro" onclick="telaAdminDashboard()">
                <i>📈</i><span>PAINEL DE PEDIDOS</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaHistoricoMovimentacoes()">
                <i>📜</i><span>HISTÓRICO</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaEntradaPatrimonioLote()">
                <i>🏷️</i><span>LANÇAR ENTRADA PATRIMÔNIO</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaGerenciarPatrimonio()">
                <i>🏷️</i><span>CONSULTAR / MOVER PATRIMÔNIO</span>
            </button>
            <button class="btn-grande btn-vidro btn-breve" onclick="abrirModalBaixa(patrimonioId, produtoId, numeroSerie)">
                <i>🏷️</i><span>BAIXAR PATRIMÔNIO (INSERVÍVEL)</span>
            </button> 
            <button class="btn-grande btn-vidro btn-breve" // --- onclick="telaResumoBaixasAnual()">
                <i>🏷️</i><span>RELATÓRIO ANUAL BAIXA DE PATRIMÔNIO</span>
            </button> 
            <button class="btn-grande btn-vidro" onclick="abrirCalculadoraConversao()">
                <i>🧮</i><span>CALCULADORA</span>
            </button>
        `;
        // Chama alertas de pedidos aguardando separação
        setTimeout(verificarPedidosParaSeparar, 500);
    }

    // --- 6. PERFIL: LOGÍSTICA ---
    if (perfil === 'logistica') {
        html += `
            <button class="btn-grande btn-vidro" onclick="telaLogisticaEntregas()">
                <i>🚚</i><span>RECOLHER E TRANSPORTAR PEDIDO</span>
            </button>
            <button class="btn-grande btn-breve">
                <i>🏷️</i><span>SOLICITAR PATRIMÔNIO</span>
            </button>
        `;
        // Alertas de pedidos prontos para coleta no Estoque Central
        setTimeout(verificarPedidosParaColeta, 500);
    }

    html += menuComum + `</div>`; // Fecha a grid e adiciona o menu comum no fim
    container.innerHTML = html;

    iniciarAlertaPedidos();
}

async function telaVisualizarEstoque() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; color:white; text-align:center;">🔄 SINCRONIZANDO SALDOS DE ESTOQUE...</div>';

    try {
        const res = await fetch(`${API_URL}/estoque/geral`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        dadosEstoqueCache = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div class="painel-usuario-vidro" style="position:relative; width:100%; top:0; right:0; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="color:white; margin:0; font-size:1.2rem;">📊 GESTÃO DE ESTOQUE REAL</h2>
                    <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#64748b;">⬅️ VOLTAR</button>
                </div>

                <div class="container-busca-estoque">
                    <span class="icone-lupa-busca">🔍</span>
                    <input type="text" id="busca-produto" class="input-busca-vidro" 
                           placeholder="Pesquisar produto nesta categoria..." 
                           oninput="filtrarEstoque()">
                </div>

                <div class="container-abas">
                    <div class="aba-item ativa" id="tab-UNIFORMES" onclick="mudarAba('UNIFORMES')">UNIFORMES</div>
                    <div class="aba-item" id="tab-MATERIAL" onclick="mudarAba('MATERIAL')">MATERIAL</div>
                    <div class="aba-item" id="tab-PATRIMONIO" onclick="mudarAba('PATRIMONIO')">PATRIMÔNIO</div>
                </div>

                <div id="conteudo-estoque" class="painel-vidro" style="padding:0; overflow:hidden;"></div>
            </div>

            <div id="modalGrade" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(8px);">
                <div class="painel-vidro" style="width:95%; max-width:450px; background:white;">
                    <h3 id="modalTitulo" style="margin-top:0; color:#1e3a8a; border-bottom:2px solid #f1f5f9; padding-bottom:15px; text-align:center;"></h3>
                    <div id="modalCorpo" style="margin:25px 0; display:grid; grid-template-columns:repeat(3, 1fr); gap:15px; color: #1e3a8a;"></div>
                    <button onclick="document.getElementById('modalGrade').style.display='none'" class="btn-sair-vidro" style="width:100%; background:#ef4444;">FECHAR VISUALIZAÇÃO</button>
                </div>
            </div>
        `;

        mudarAba('UNIFORMES');

    } catch (err) {
        container.innerHTML = "<div class='painel-vidro' style='color:#f87171;'>🚨 Erro ao carregar estoque.</div>";
    }
}

function mudarAba(novaCategoria) {
    categoriaAtual = novaCategoria;
    
    // Atualiza visual das abas
    document.querySelectorAll('.aba-item').forEach(aba => aba.classList.remove('ativa'));
    document.getElementById(`tab-${novaCategoria}`).classList.add('ativa');

    // Limpa o campo de busca ao trocar de categoria para não confundir o usuário
    document.getElementById('busca-produto').value = '';
    
    filtrarEstoque();
}

function filtrarEstoque() {
    const termoBusca = document.getElementById('busca-produto').value.toLowerCase();
    
    // Filtra por Categoria E por Texto (se houver)
    const produtosExibidos = dadosEstoqueCache.filter(p => {
        const matchCategoria = p.tipo === categoriaAtual;
        const matchTexto = p.nome.toLowerCase().includes(termoBusca);
        return matchCategoria && matchTexto;
    });

    const areaTabela = document.getElementById('conteudo-estoque');
    
    if (produtosExibidos.length === 0) {
        areaTabela.innerHTML = `<div style="padding:40px; text-align:center; color:#cbd5e1;">Nenhum item encontrado.</div>`;
        return;
    }

    areaTabela.innerHTML = `
        <table style="width:100%; border-collapse:collapse; color:white;">
            <thead>
                <tr style="background:rgba(255,255,255,0.1);">
                    <th style="padding:15px; text-align:left; font-size:0.8rem;">PRODUTO</th>
                    <th style="padding:15px; text-align:center; font-size:0.8rem;">SALDO REAL</th>
                    <th style="padding:15px; text-align:center; font-size:0.8rem;">STATUS</th>
                </tr>
            </thead>
            <tbody>
                ${produtosExibidos.map(p => {
                    // Garantimos que os valores sejam tratados como números para a comparação
                    const saldo = Number(p.quantidade_estoque) || 0;
                    const minimo = Number(p.alerta_minimo) || 0;

                    const status = saldo <= minimo 
                        ? '<span style="color:#f87171; font-weight:bold; font-size:0.75rem;">🔴 CRÍTICO</span>' 
                        : '<span style="color:#4ade80; font-weight:bold; font-size:0.75rem;">🟢 OK</span>';
                    
                    return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.1); transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                            <td style="padding:15px; font-weight:500; font-size:0.9rem;">${p.nome}</td>
                            <td style="padding:15px; text-align:center;">
                                ${p.tipo === 'UNIFORMES' ? 
                                    `<button onclick="abrirModalGrade(${p.id}, '${p.nome}')" class="btn-sair-vidro" style="background:rgba(59,130,246,0.3); border:1px solid #3b82f6; font-size:0.75rem; padding: 5px 12px; cursor:pointer; width: auto; height: auto; margin: 0;">
                                        🔍 ${saldo} (GRADE)
                                    </button>` : 
                                    `<strong style="font-size:1.1rem; color: #fbbf24;">${saldo}</strong> <small style="color:#94a3b8; font-size:0.7rem;">unid.</small>`
                                }
                            </td>
                            <td style="padding:15px; text-align:center;">${status}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function enviarPedidoUniforme(operacao) {
    const localId = localStorage.getItem('minha_unidade_id');
    
    if (!localId || localId === "null") {
        return alert("Erro: Seu usuário não está vinculado a nenhuma escola no cadastro.");
    }

    const payload = {
        local_destino_id: parseInt(localId),
        operacao: operacao, // 'SOLICITACAO' ou 'DEVOLUCAO'
        itens: carrinhoUniforme
    };

    try {
        const res = await fetch(`${API_URL}/pedidos/uniformes/criar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Enviado com sucesso!");
            carrinhoUniforme = [];
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("❌ Erro: " + erro.error);
        }
    } catch (err) {
        alert("Erro de conexão.");
    }
}

async function abrirFormularioUsuario() {
    // Busca a lista de locais para o dropdown
    const res = await fetch(`${API_URL}/locais/dropdown`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const locais = await res.json();

    const formHTML = `
        <label>VINCULAR À UNIDADE (ESCOLA/SETOR):</label>
        <select id="novo_local_id" style="width:100%; padding:10px; margin-bottom:15px; border-radius:4px;">
            <option value="">-- SELECIONE O LOCAL --</option>
            ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
        </select>
    `;
    // Insira este formHTML dentro do seu modal/container de cadastro
}

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

async function finalizarPedidoUniforme(tipoMovimentacao) {
    // 1. Lemos o ID do local que o sistema 'aprendeu' no login
    const localIdLogado = localStorage.getItem('local_id');

    // Segurança: Se não houver local_id, o usuário não pode pedir nada
    if (!localIdLogado || localIdLogado === "" || localIdLogado === "null") {
        return alert("⚠️ ERRO: Seu usuário não possui um local vinculado. Saia e entre novamente no sistema.");
    }

    if (carrinhoUniforme.length === 0) {
        return alert("Seu carrinho está vazio!");
    }

    // 2. Montamos o objeto que será enviado ao banco
    const dadosPedido = {
        // O local_id do usuário logado torna-se o DESTINO da solicitação
        local_destino_id: parseInt(localIdLogado), 
        tipo_movimentacao: 'UNIFORMES',
        status: 'AGUARDANDO_AUTORIZACAO',
        itens: carrinhoUniforme, // Array com os itens selecionados
        operacao: tipoMovimentacao // 'SOLICITACAO' ou 'DEVOLUCAO'
    };

    try {
        const res = await fetch(`${API_URL}/pedidos/uniformes/criar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(dadosPedido)
        });

        if (res.ok) {
            alert("✨ Pedido realizado com sucesso para sua unidade!");
            carrinhoUniforme = []; // Limpa o carrinho
            carregarDashboard();
        } else {
            alert("Erro ao processar pedido no servidor.");
        }
    } catch (err) {
        console.error("Erro no envio:", err);
        alert("Falha na conexão com o servidor.");
    }
}

async function abrirModalGrade(id, nome) {
    const modal = document.getElementById('modalGrade');
    const corpo = document.getElementById('modalCorpo');
    document.getElementById('modalTitulo').innerText = nome;
    corpo.innerHTML = "Carregando...";
    modal.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/estoque/grade/${id}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const grade = await res.json();

        if (grade.length === 0) {
            corpo.innerHTML = "<p style='grid-column: span 3; text-align:center;'>Nenhum saldo por tamanho registrado.</p>";
        } else {
            corpo.innerHTML = grade.map(g => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; text-align:center; border-radius:6px;">
                    <div style="font-size:0.75rem; color:#64748b; font-weight:bold;">TAM ${g.tamanho}</div>
                    <div style="font-size:1.1rem; font-weight:bold; color:#1e293b;">${g.quantidade}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        corpo.innerHTML = "Erro ao carregar grade.";
    }
}

function gerarCamposProduto() {
    return `
        <label>NOME DO PRODUTO:</label>
        <input type="text" id="cad_nome_produto" placeholder="Ex: CAMISETA POLO" required>
        
        <label>CATEGORIA (OBRIGATÓRIO):</label>
        <select id="cad_tipo_produto" required>
            <option value="" disabled selected>-- SELECIONE A CATEGORIA --</option>
            <option value="MATERIAL">📦 MATERIAL / CONSUMO</option>
            <option value="UNIFORMES">👕 UNIFORMES / VESTUÁRIO</option>
            <option value="PATRIMONIO">🏷️ PATRIMÔNIO</option>
        </select>

        <label>ESTOQUE MÍNIMO (ALERTA):</label>
        <input type="number" id="cad_alerta_minimo" value="10">
    `;
}

async function telaAdminGerenciarSolicitacoes() {
    const app = document.getElementById('app-content');
    const res = await fetch(`${API_URL}/pedidos/admin/pendentes`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const pedidos = await res.json();

    app.innerHTML = `
        <div style="padding:20px; background:#f8fafc; min-height:100vh;">
            <div style="display:flex; justify-content:space-between; margin-bottom:25px;">
                <h2 style="color:#1e3a8a; margin:0; font-size:1.8rem;">🔓 AUTORIZAR SOLICITAÇÕES</h2>
                <button onclick="carregarDashboard()" style="background:#475569; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">⬅ VOLTAR</button>
            </div>

            <div style="display:grid; gap:15px;">
                ${pedidos.map(p => `
                    <div style="background:white; padding:25px; border-radius:12px; border-left: 8px solid #1e40af; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <div style="text-align:left;">
                            <div style="font-weight:bold; color:#1e40af; font-size:1.3rem; margin-bottom:5px;">📍 ${p.escola_nome}</div>
                            <div style="color:#475569; font-size:1rem;">Solicitado por: <b>${p.solicitante}</b></div>
                            <div style="color:#94a3b8; font-size:0.8rem;">Data: ${new Date(p.data_criacao).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <button onclick="analisarPedidoEstoque(${p.id})" style="background:#2563eb; color:white; border:none; padding:15px 30px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem;">ANALISAR ITENS</button>
                    </div>
                `).join('')}
            </div>
        </div>
        <div id="modal-analise" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.9); z-index:1000; justify-content:center; align-items:center;"></div>
    `;
}

async function analisarPedidoEstoque(pedidoId) {
    const modal = document.getElementById('modal-analise');
    const res = await fetch(`${API_URL}/pedidos/detalhes-estoque/${pedidoId}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const itens = await res.json();

    let saldoSuficiente = true;
    const linhas = itens.map(i => {
        const falta = i.solicitado > i.em_estoque;
        if (falta) saldoSuficiente = false;
        return `
            <tr style="border-bottom: 1px solid #eee; background: ${falta ? '#fff1f2' : 'transparent'}">
                <td style="padding:15px; color:#1e3a8a; font-weight:bold;">${i.produto} (${i.tamanho})</td>
                <td style="padding:15px; text-align:center;">${i.solicitado}</td>
                <td style="padding:15px; text-align:center; color:${falta ? '#e11d48' : '#16a34a'}; font-weight:bold;">${i.em_estoque}</td>
                <td style="padding:15px; text-align:right;">${falta ? '❌ SEM SALDO' : '✅ OK'}</td>
            </tr>
        `;
    }).join('');

    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:15px; width:100%; max-width:800px; box-shadow: 0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="color:#1e3a8a; margin-top:0;">📋 Comparação Pedido vs Estoque</h3>
            <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                <thead style="background:#f1f5f9; color:#1e3a8a;">
                    <tr><th style="text-align:left; padding:15px;">PRODUTO</th><th>PEDIDO</th><th>ESTOQUE</th><th>STATUS</th></tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
            <div style="display:flex; gap:15px;">
                <button onclick="editarQuantidades(${pedidoId})" style="flex:1; background:#f59e0b; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">✏️ EDITAR QUANTIDADES</button>
                <button ${!saldoSuficiente ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} 
                        onclick="finalizarAutorizacao(${pedidoId})" 
                        style="flex:1; background:#16a34a; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    ✅ AUTORIZAR SAÍDA
                </button>
                <button onclick="document.getElementById('modal-analise').style.display='none'" style="flex:1; background:#64748b; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">FECHAR</button>
            </div>
        </div>
    `;
}

async function analisarPedido(id) {
    const modal = document.getElementById('modal-analise');
    const res = await fetch(`${API_URL}/pedidos/detalhes-estoque/${id}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const itens = await res.json();

    let estoqueSuficiente = true;
    let htmlItens = itens.map(i => {
        const falta = i.solicitado > i.em_estoque;
        if (falta) estoqueSuficiente = false;
        return `
            <tr style="border-bottom: 1px solid #eee; background: ${falta ? '#fff1f2' : 'transparent'}">
                <td style="padding:10px;">${i.produto} (${i.tamanho})</td>
                <td style="padding:10px; font-weight:bold;">${i.solicitado}</td>
                <td style="padding:10px; color: ${falta ? '#e11d48' : '#16a34a'}; font-weight:bold;">${i.em_estoque}</td>
                <td style="padding:10px;">${falta ? '❌ INSUFICIENTE' : '✅ OK'}</td>
            </tr>
        `;
    }).join('');

    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:700px; max-height:80vh; overflow-y:auto;">
            <h3 style="color:#1e3a8a; margin-top:0;">📊 Análise de Saldo - Pedido #${id}</h3>
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                <thead style="background:#f1f5f9;">
                    <tr><th style="text-align:left; padding:10px;">PRODUTO</th><th>PEDIDO</th><th>ESTOQUE</th><th>STATUS</th></tr>
                </thead>
                <tbody>${htmlItens}</tbody>
            </table>
            
            <div style="display:flex; gap:10px;">
                <button onclick="editarQuantidades(${id})" style="flex:1; background:#f59e0b; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">✏️ EDITAR QUANTIDADES</button>
                <button ${!estoqueSuficiente ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} 
                        onclick="finalizarPedido(${id}, 'APROVADO')" 
                        style="flex:1; background:#16a34a; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    ✅ AUTORIZAR SAÍDA
                </button>
                <button onclick="document.getElementById('modal-analise').style.display='none'" style="flex:1; background:#64748b; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">FECHAR</button>
            </div>
        </div>
    `;
}

async function editarQuantidades(pedidoId) {
    const modal = document.getElementById('modal-analise');
    // Buscamos os dados novamente para garantir que estamos editando a versão mais recente
    const res = await fetch(`${API_URL}/pedidos/detalhes-estoque/${pedidoId}`, { 
        headers: { 'Authorization': `Bearer ${TOKEN}` } 
    });
    const itens = await res.json();

    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:750px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="color:#1e3a8a; margin-top:0; border-bottom: 2px solid #e2e8f0; padding-bottom:10px;">✏️ EDITAR QUANTIDADES - PEDIDO #${pedidoId}</h3>
            <p style="color:#64748b; margin-bottom:20px;">Ajuste as quantidades para que fiquem dentro do limite disponível em estoque.</p>
            
            <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                <thead style="background:#f1f5f9; color:#1e3a8a;">
                    <tr>
                        <th style="text-align:left; padding:12px;">PRODUTO / TAMANHO</th>
                        <th style="padding:12px;">ESTOQUE</th>
                        <th style="padding:12px; width:120px;">NOVA QTD</th>
                    </tr>
                </thead>
                <tbody>
                    ${itens.map(i => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding:12px;">${i.produto} (Tam: ${i.tamanho || 'U'})</td>
                            <td style="padding:12px; text-align:center; font-weight:bold; color:#16a34a;">${i.em_estoque}</td>
                            <td style="padding:12px;">
                                <input type="number" class="input-edicao-qtd" data-item-id="${i.item_id}" value="${i.solicitado}" min="0" 
                                    style="width:100%; padding:8px; border:2px solid #cbd5e1; border-radius:6px; font-weight:bold; text-align:center;">
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="display:flex; gap:15px;">
                <button onclick="salvarEdicaoPedido(${pedidoId})" style="flex:2; background:#1e40af; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;">
                    💾 SALVAR ALTERAÇÕES
                </button>
                <button onclick="analisarPedido(${pedidoId})" style="flex:1; background:#94a3b8; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    CANCELAR
                </button>
            </div>
        </div>
    `;
}

async function salvarEdicaoPedido(pedidoId) {
    const inputs = document.querySelectorAll('.input-edicao-qtd');
    const itensAtualizados = [];

    inputs.forEach(input => {
        itensAtualizados.push({
            item_id: input.getAttribute('data-item-id'),
            nova_qtd: parseInt(input.value)
        });
    });

    try {
        const res = await fetch(`${API_URL}/pedidos/itens/atualizar`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ itens: itensAtualizados })
        });

        if (res.ok) {
            alert("✅ Quantidades ajustadas com sucesso!");
            // Após salvar, volta para a tela de análise para verificar se o botão "Autorizar" já pode ser liberado
            analisarPedido(pedidoId);
        } else {
            alert("Erro ao salvar alterações.");
        }
    } catch (err) {
        alert("Erro de conexão com o servidor.");
    }
}

async function finalizarPedido(pedidoId) {
    if (!confirm("Confirmar autorização e saída de estoque deste pedido?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/finalizar-autorizacao`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ pedidoId: pedidoId })
        });

        if (res.ok) {
            alert("✅ Autorizado! O estoque foi atualizado e o pedido seguiu para SEPARAÇÃO.");
            document.getElementById('modal-analise').style.display = 'none';
            telaAdminGerenciarSolicitacoes(); // Recarrega a lista
        } else {
            const erro = await res.json();
            alert("❌ Erro ao autorizar: " + erro.error);
        }
    } catch (err) {
        alert("🚨 Erro de conexão com o servidor.");
    }
}

async function finalizarAutorizacao(pedidoId) {
    if (!confirm("Deseja autorizar este pedido e dar baixa no estoque?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/autorizar-final`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ pedidoId: pedidoId })
        });

        if (res.ok) {
            alert("✅ Pedido Autorizado! O status agora é 'AGUARDANDO SEPARAÇÃO'.");
            document.getElementById('modal-analise').style.display = 'none';
            telaAdminGerenciarSolicitacoes(); // Recarrega a lista de pendentes
        } else {
            const erro = await res.json();
            alert("❌ Erro ao autorizar: " + erro.error);
        }
    } catch (err) {
        alert("🚨 Erro de conexão com o servidor.");
    }
}

async function abrirEdicaoSolicitacao(pedidoId) {
    const area = document.getElementById(`area-edicao-${pedidoId}`);
    area.innerHTML = "Consultando estoque e carregando itens...";

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/itens-com-estoque`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const itens = await res.json();
        const itensOrdenados = ordenarTamanhos(itens);
        let html = `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; margin-bottom:20px; background:#fff;">
                    <thead>
                        <tr style="text-align:left; border-bottom:2px solid #e2e8f0; background:#f8fafc;">
                            <th style="padding:12px;">Produto / Tipo</th>
                            <th style="padding:12px;">Tam.</th>
                            <th style="padding:12px; text-align:center;">Saldo Atual</th>
                            <th style="padding:12px; width:120px;">Qtd. Autorizar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itensOrdenados.map(item => {
                            const emFalta = item.qtd_solicitada > item.saldo_atual;
                            return `
                            <tr style="border-bottom:1px solid #f1f5f9; ${emFalta ? 'background:#fff5f5;' : ''}">
                                <td style="padding:12px;">
                                    <strong>${item.produto_nome}</strong><br>
                                    <small style="color:#64748b;">${item.produto_tipo}</small>
                                </td>
                                <td style="padding:12px;">${item.tamanho || 'N/A'}</td>
                                <td style="padding:12px; text-align:center;">
                                    <span style="font-weight:bold; color: ${emFalta ? '#e53e3e' : '#2f855a'}">
                                        ${item.saldo_atual}
                                    </span>
                                    ${emFalta ? '<br><small style="color:#e53e3e;">⚠️ Insuficiente</small>' : ''}
                                </td>
                                <td style="padding:12px;">
                                    <input type="number" value="${item.qtd_solicitada}" 
                                        onchange="atualizarQuantidadeItem(${item.item_id}, this.value)"
                                        style="width:80px; padding:8px; border:2px solid ${emFalta ? '#fc8181' : '#cbd5e1'}; border-radius:6px; font-weight:bold;">
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="display:flex; gap:12px; padding-top:10px; border-top:1px solid #e2e8f0;">
                <button onclick="finalizarAprovacao(${pedidoId})" 
                    style="flex:1; background:#10b981; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    ✅ APROVAR COM ESTAS QUANTIDADES
                </button>
                <button onclick="recusarPedido(${pedidoId})" 
                    style="background:#f1f5f9; color:#4a5568; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    ❌ RECUSAR TUDO
                </button>
            </div>
        `;
        area.innerHTML = html;
    } catch (err) { 
        area.innerHTML = '<p style="color:red;">Erro ao cruzar dados de estoque.</p>'; 
    }
}

async function atualizarQuantidadeItem(itemId, novaQtd) {
    try {
        await fetch(`${API_URL}/pedidos/itens/${itemId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ quantidade: novaQtd })
        });
        console.log(`Item ${itemId} atualizado para ${novaQtd}`);
    } catch (err) { alert("Erro ao salvar alteração do item."); }
}

async function finalizarAprovacao(pedidoId) {
    if (!confirm("Confirmar aprovação deste pedido com as quantidades atuais?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/aprovar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            alert("🚀 Pedido APROVADO e enviado para o estoque!");
            telaAdminGerenciarSolicitacoes(); // Recarrega a lista
        }
    } catch (err) { alert("Erro ao aprovar pedido."); }
}

async function atualizarStatusPedido(id, novoStatus) {
    if (!confirm(`Deseja alterar o status do pedido #${id} para ${novoStatus}?`)) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ status: novoStatus })
        });

        if (res.ok) {
            alert("✅ STATUS ATUALIZADO!");
            telaAdminGerenciarSolicitacoes(); // Recarrega a lista
        }
    } catch (err) { alert("Erro ao atualizar pedido."); }
}

async function recusarPedidoAdmin(id) {
    const motivo = prompt("Informe o motivo da recusa:");
    if (!motivo) return alert("É necessário informar um motivo para recusar.");

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ status: 'RECUSADO', motivo_recusa: motivo })
        });

        if (res.ok) {
            alert("❌ SOLICITAÇÃO RECUSADA.");
            telaAdminGerenciarSolicitacoes();
        }
    } catch (err) { alert("Erro ao processar recusa."); }
}

// 1. Busca os itens e mostra no console/tela para o admin
async function carregarDetalhesParaAutorizar(pedidoId) {
    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/itens`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (!res.ok) throw new Error("Erro ao carregar itens");
        const itens = await res.json();

        // Criar uma lista simples de itens para mostrar ao Admin
        let listaItens = itens.map(i => `- ${i.produto_nome} (Qtd: ${i.quantidade_solicitada})`).join('\n');

        if (confirm(`ITENS DO PEDIDO #${pedidoId}:\n\n${listaItens}\n\nDESEJA AUTORIZAR ESTA SOLICITAÇÃO?`)) {
            await processarSolicitacao(pedidoId, 'AUTORIZA');
        } else {
            if (confirm("DESEJA RECUSAR ESTA SOLICITAÇÃO?")) {
                await processarSolicitacao(pedidoId, 'RECUSA');
            }
        }
    } catch (err) {
        alert("Erro ao carregar detalhes: " + err.message);
    }
}

// 2. Envia a decisão (Autorizar/Recusar) para o servidor
async function processarSolicitacao(pedidoId, acao) {
    let motivo = '';
    let status = acao === 'AUTORIZA' ? 'AGUARDANDO_COLETA' : 'RECUSADO';

    if (acao === 'RECUSA') {
        motivo = prompt("INFORME O MOTIVO DA RECUSA:");
        if (!motivo) return; // Cancela se não der motivo
    }

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}` 
            },
            body: JSON.stringify({ status, motivo_recusa: motivo })
        });

        if (res.ok) {
            alert(acao === 'AUTORIZA' ? "✅ SOLICITAÇÃO AUTORIZADA!" : "❌ SOLICITAÇÃO RECUSADA!");
            telaAdminGerenciarSolicitacoes(); // Recarrega a lista
        } else {
            alert("Erro ao processar solicitação.");
        }
    } catch (err) {
        alert("Erro de conexão com o servidor.");
    }
}



async function telaDevolucaoUniforme() {
    // 1. Prepara o container principal (aplica bordas arredondadas e limpa a tela)
    const container = prepararContainerPrincipal();
    container.innerHTML = '<div style="padding:30px; color:#64748b;">⏳ Carregando histórico de recebimentos...</div>';

    try {
        // Busca o "extrato" do que a escola recebeu nos últimos 30 dias
        const res = await fetch(`${API_URL}/pedidos/escola/limite-devolucao`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const itensRecebidos = await res.json();

        container.innerHTML = `
            <div style="padding:30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="color:#1e3a8a; margin:0;">🔄 SOLICITAR DEVOLUÇÃO</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                        ⬅️ VOLTAR
                    </button>
                </div>

                <div style="background: #fff9eb; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <p style="color:#92400e; margin:0; font-size:0.95rem;">
                        Abaixo listamos os uniformes recebidos nos últimos 30 dias. 
                        A devolução é limitada à quantidade total recebida no período.
                    </p>
                </div>

                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead style="background:#f1f5f9; color:#1e3a8a;">
                            <tr>
                                <th style="padding:15px; text-align:left; border-radius: 8px 0 0 0;">PRODUTO / TAMANHO</th>
                                <th style="padding:15px; text-align:center;">RECEBIDO (30d)</th>
                                <th style="padding:15px; width:150px; text-align:center; border-radius: 0 8px 0 0;">DEVOLVER</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itensRecebidos.length === 0 ? 
                                '<tr><td colspan="3" style="padding:30px; text-align:center; color:#64748b;">Nenhum item disponível para devolução.</td></tr>' :
                                itensRecebidos.map(i => `
                                <tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:15px; color:#1e293b;"><b>${i.produto_nome}</b><br><span style="color:#64748b; font-size:0.85rem;">Tam: ${i.tamanho}</span></td>
                                    <td style="padding:15px; text-align:center; color:#1e40af; font-weight:bold; font-size:1.1rem;">${i.total_recebido}</td>
                                    <td style="padding:15px;">
                                        <input type="number" class="input-devolucao" 
                                            data-id="${i.produto_id}" 
                                            data-tam="${i.tamanho}" 
                                            data-max="${i.total_recebido}"
                                            data-nome="${i.produto_nome}"
                                            placeholder="0" min="0" max="${i.total_recebido}"
                                            style="width:100%; padding:10px; border:2px solid #cbd5e1; border-radius:8px; text-align:center; font-weight:bold; outline:none;"
                                            onfocus="this.style.borderColor='#1e3a8a'"
                                            onblur="this.style.borderColor='#cbd5e1'">
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="margin-top:35px; display:flex; gap:15px;">
                    <button onclick="processarSolicitacaoDevolucao()" style="flex:2; background:#1e3a8a; color:white; border:none; padding:18px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem; transition:0.2s;" onmouseover="this.style.backgroundColor='#1e40af'">
                        🚀 ENVIAR SOLICITAÇÃO
                    </button>
                    <button onclick="carregarDashboard()" style="flex:1; background:#94a3b8; color:white; border:none; padding:18px; border-radius:10px; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.backgroundColor='#64748b'">
                        CANCELAR
                    </button>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `
            <div style="padding:30px; text-align:center;">
                <p style="color:#ef4444;">Erro ao carregar dados de devolução.</p>
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">⬅️ VOLTAR</button>
            </div>
        `;
    }
}

function processarSolicitacaoDevolucao() {
    const inputs = document.querySelectorAll('.input-devolucao');
    const itensDevolucao = [];
    let erroValidacao = "";

    inputs.forEach(input => {
        const qtdDevolver = parseInt(input.value) || 0;
        const qtdMax = parseInt(input.getAttribute('data-max'));
        const nomeProd = input.getAttribute('data-nome');
        const tam = input.getAttribute('data-tam');

        if (qtdDevolver > qtdMax) {
            erroValidacao += `❌ Você não pode devolver ${qtdDevolver} unidades de ${nomeProd} (${tam}). O limite recebido foi ${qtdMax}.\n`;
        }

        if (qtdDevolver > 0 && qtdDevolver <= qtdMax) {
            itensDevolucao.push({
                produto_id: input.getAttribute('data-id'),
                tamanho: tam,
                quantidade: qtdDevolver
            });
        }
    });

    if (erroValidacao) {
        alert("⚠️ ERRO DE QUANTIDADE:\n\n" + erroValidacao);
        return;
    }

    if (itensDevolucao.length === 0) {
        alert("Informe pelo menos uma quantidade válida para devolução.");
        return;
    }

    // Se passou na validação, envia para a sua rota de criar pedido (operacao: 'DEVOLUCAO')
    finalizarEnvioDevolucao(itensDevolucao);
}

async function finalizarEnvioDevolucao(itens) {
    if (!confirm("Confirmar o envio desta solicitação de devolução?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/escola/devolver`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ itensDevolucao: itens })
        });

        if (res.ok) {
            alert("✅ Solicitação enviada! O Administrador será notificado para autorizar a recolha.");
            carregarDashboard(); // Volta para a tela principal
        } else {
            const erro = await res.json();
            alert("❌ Erro ao enviar: " + erro.error);
        }
    } catch (err) {
        alert("🚨 Erro de conexão com o servidor.");
    }
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
                <button onclick="listarSolicitacoesPendentes()" style="margin-bottom:20px;">⬅ VOLTAR</button>
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
async function confirmarRecebimentoantigo(pedidoId) {
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

// Abre o modal e carrega os locais para o select
async function abrirModalCadastroUsuario() {
    const modal = document.getElementById('modalCadastro'); // Reutilizando o seu container de modal
    const formContainer = document.getElementById('formDinamico');
    
    try {
        // Busca os locais disponíveis para vincular ao novo utilizador
        const res = await fetch(`${API_URL}/cadastros/locais`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const locais = await res.json();

        document.getElementById('selecionarTabela').style.display = 'none'; // Esconde o select de tabelas se existir
        
        formContainer.innerHTML = `
            <h3 style="margin-top:0; color:#1e3a8a;">🆕 REGISTAR NOVO UTILIZADOR</h3>
            
            <label>NOME COMPLETO:</label>
            <input type="text" id="user_nome" placeholder="Ex: JOÃO SILVA" style="width:100%; padding:10px; margin-bottom:10px;">

            <label>NOME DE UTILIZADOR (LOGIN):</label>
            <input type="text" id="user_login" placeholder="Ex: joao.silva" style="width:100%; padding:10px; margin-bottom:10px;">

            <label>PALAVRA-PASSE (PROVISÓRIA):</label>
            <input type="password" id="user_senha" placeholder="******" style="width:100%; padding:10px; margin-bottom:10px;">

            <label>PERFIL DE ACESSO:</label>
            <select id="user_perfil" style="width:100%; padding:10px; margin-bottom:10px;">
                <option value="admin">ADMINISTRADOR</option>
                <option value="estoque">ESTOQUE CENTRAL</option>
                <option value="logistica">LOGÍSTICA / MOTORISTA</option>
                <option value="escola">UNIDADE ESCOLAR</option>
                <option value="super">SUPERVISOR (SUPER)</option>
            </select>

            <label>VINCULAR À UNIDADE (LOCAL):</label>
            <select id="user_local" style="width:100%; padding:10px; margin-bottom:15px;">
                <option value="">NENHUM (GERAL)</option>
                ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
            </select>

            <button onclick="salvarNovoUsuario()" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                GRAVAR UTILIZADOR
            </button>
            <button onclick="document.getElementById('modalCadastro').style.display='none'" style="width:100%; margin-top:10px; background:none; border:none; color:#666; cursor:pointer;">CANCELAR</button>
        `;

        modal.style.display = 'flex';
    } catch (err) {
        alert("Erro ao carregar lista de unidades.");
    }
}

// Envia os dados para o backend
async function salvarNovoUsuario() {
    // 1. Captura os valores dos campos do formulário
    const nome = document.getElementById('novo_nome').value.trim();
    const senha = document.getElementById('nova_senha').value;
    const perfil = document.getElementById('novo_perfil').value;
    const local_id = document.getElementById('novo_local_id').value;

    // 2. Validações básicas antes de enviar ao servidor
    if (!nome || !senha || !perfil) {
        return alert("⚠️ Preencha Nome, Senha e Perfil obrigatoriamente.");
    }

    // Se o perfil for 'escola', o local_id DEVE ser preenchido
    if (perfil === 'escola' && !local_id) {
        return alert("⚠️ Usuários do perfil ESCOLA precisam ser vinculados a uma unidade.");
    }

    // 3. Monta o objeto de dados (o 'corpo' da requisição)
    const payload = {
        nome: nome,
        senha: senha,
        perfil: perfil,
        local_id: local_id ? parseInt(local_id) : null, // Converte para número ou envia nulo
        status: 'ativo'
    };

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/usuarios/criar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            alert("✨ Funcionário cadastrado com sucesso!");
            
            // Limpa os campos para o próximo cadastro
            document.getElementById('novo_nome').value = '';
            document.getElementById('nova_senha').value = '';
            
            // Recarrega a tela para atualizar a tabela de funcionários
            telaGerenciarUsuarios();
        } else {
            alert("❌ Erro ao cadastrar: " + (data.error || data.message));
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
        alert("🚨 Falha na conexão com o servidor.");
    }
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
    container.innerHTML = '<div style="padding:20px; font-weight:bold; color:white;">🔍 Carregando usuários e locais...</div>';

    try {
        const token = localStorage.getItem('token');

        // 1. Buscamos usuários e locais em paralelo
        const [resUsuarios, resLocais] = await Promise.all([
            fetch(`${API_URL}/usuarios/lista`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/locais/dropdown`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!resUsuarios.ok || !resLocais.ok) throw new Error("Falha ao buscar dados no servidor.");

        const usuarios = await resUsuarios.json();
        const locais = await resLocais.json();

        // Mapeamento para exibição amigável na tabela
        const nomesPerfis = {
            'escola': 'Escola',
            'admin': 'Administração',
            'estoque': 'Estoque',
            'logistica': 'Logística',
            'super': 'Supervisão',
            'dti': 'DTI - Admin',
            'impres': 'Técnico Impressora'
        };

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:15px;">
                    <h2 style="color:white; margin:0;">👥 GERENCIAR USUÁRIOS E ACESSOS</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>

                <div style="display: grid; grid-template-columns: 350px 1fr; gap: 25px; align-items: start;">
                    
                    <div class="painel-vidro" style="border-top: 4px solid #10b981;">
                        <h3 style="margin-top:0; color:#10b981;">➕ Novo Usuário</h3>
                        
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:white;">NOME/LOGIN:</label>
                        <input type="text" id="novo_nome" class="input-vidro" placeholder="Ex: joao.silva" style="width:100%; margin-bottom:15px;">

                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:white;">SENHA:</label>
                        <input type="password" id="nova_senha" class="input-vidro" placeholder="****" style="width:100%; margin-bottom:15px;">

                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:white;">PERFIL DE ACESSO:</label>
                        <select id="novo_perfil" class="input-vidro" style="width:100%; margin-bottom:15px;">
                            <option value="escola">ESCOLA (Acesso Restrito)</option>
                            <option value="admin">ADMIN (Gestão Geral)</option>
                            <option value="estoque">ESTOQUE (Operacional)</option>
                            <option value="logistica">LOGÍSTICA (Transporte)</option>
                            <option value="dti">DTI - Admin</option>
                            <option value="impres">Técnico Impressora</option>
                            <option value="super">SUPER (Total)</option>
                        </select>

                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:white;">VINCULAR À UNIDADE:</label>
                        <select id="novo_local_id" class="input-vidro" style="width:100%; margin-bottom:20px;">
                            <option value="">-- SELECIONE A ESCOLA/SETOR --</option>
                            ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                        </select>

                        <button onclick="salvarNovoUsuario()" style="width:100%; background:#10b981; color:white; border:none; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:16px;">
                            💾 CADASTRAR FUNCIONÁRIO
                        </button>
                    </div>

                    <div class="painel-vidro">
                        <h3 style="margin-top:0; color:white;">Funcionários Cadastrados</h3>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; color:white;">
                                <thead style="background:rgba(255,255,255,0.1);">
                                    <tr>
                                        <th style="padding:12px; text-align:left; border-bottom:2px solid rgba(255,255,255,0.2);">Nome</th>
                                        <th style="padding:12px; text-align:left; border-bottom:2px solid rgba(255,255,255,0.2);">Perfil</th>
                                        <th style="padding:12px; text-align:left; border-bottom:2px solid rgba(255,255,255,0.2);">Lotação/Local</th>
                                        <th style="padding:12px; text-align:center; border-bottom:2px solid rgba(255,255,255,0.2);">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${usuarios.map(u => `
                                        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                                            <td style="padding:12px; font-weight:bold;">${u.nome}</td>
                                            <td style="padding:12px;">
                                                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:bold;">
                                                    ${nomesPerfis[u.perfil] || u.perfil.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style="padding:12px; color:#cbd5e1;">${u.local_nome || '<span style="color:#f87171;">Não Vinculado</span>'}</td>
                                            <td style="padding:12px; text-align:center;">
                                                <span style="color:${u.status === 'ativo' ? '#4ade80' : '#f87171'}; font-weight:bold;">
                                                    ${u.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (err) {
        console.error("Erro na tela de usuários:", err);
        alert("Erro ao carregar dados. Verifique o console.");
        container.innerHTML = `<div style="padding:20px; color:red;">⚠️ Erro técnico: ${err.message}</div>`;
    }
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

async function alternarStatusUsuario(id, statusAtual) {
    const novoStatus = statusAtual === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    if (!confirm(`Deseja alterar o status do usuário para ${novoStatus}?`)) return;

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ status: novoStatus })
        });
        if (res.ok) {
            telaGerenciarUsuarios(); // Recarrega a lista
        }
    } catch (err) { alert("Erro ao atualizar status."); }
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

function telaCadastroCategoria() {
    const area = document.getElementById('area-formulario-cadastro');
    area.innerHTML = `
        <div class="card-login" style="max-width: 100%; text-align: left;">
            <h3 style="color: white;">📁 NOVA CATEGORIA</h3>
            <label style="color: #cbd5e1; font-size: 0.8rem;">NOME DA CATEGORIA:</label>
            <input type="text" id="cad_cat_nome" placeholder="Ex: INFORMÁTICA, LIMPEZA..." class="input-vidro" style="width: 100%;">
            <button onclick="salvarNovaCategoria()" class="btn-grande btn-vidro" style="background: #10b981; margin-top: 15px;">
                CONFIRMAR CADASTRO
            </button>
        </div>
    `;
}

async function salvarNovaCategoria() {
    const nome = document.getElementById('cad_cat_nome').value;
    if (!nome) return alert("Digite o nome da categoria!");

    try {
        const res = await fetch(`${API_URL}/categorias`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ nome })
        });

        if (res.ok) {
            alert("✅ Categoria salva!");
            document.getElementById('cad_cat_nome').value = '';
        } else {
            const erro = await res.json();
            alert("❌ Erro: " + erro.error);
        }
    } catch (e) { alert("Erro de conexão."); }
}

async function telaCadastrosBase() {
    const app = document.getElementById('app-content');
    app.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:30px;">
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">⬅ VOLTAR</button>
                <h2 style="color:#1e3a8a; margin:0;">🛠️ CADASTROS DO SISTEMA</h2>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:15px; margin-bottom:30px;">
                <button onclick="telaCadastroCategoria()" class="btn-quadrado-cad">📁<br>CATEGORIA</button>
                <button onclick="telaCadastroLocal()" class="btn-quadrado-cad">📍<br>LOCAL</button>
                <button onclick="telaCadastroSetor()" class="btn-quadrado-cad">🏢<br>SETOR</button>
                <button onclick="formProduto()" class="btn-quadrado-cad">📦<br>PRODUTO</button>
            </div>

            <div id="area-formulario-cadastro"></div>
        </div>
    `;
}

function telaCadastroSetor() {
    const area = document.getElementById('area-formulario-cadastro');
    area.innerHTML = `
        <div class="card-login" style="max-width: 100%; text-align: left; animation: slideIn 0.3s ease-out;">
            <h3 style="color: white; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                📂 NOVO SETOR (DETALHAMENTO)
            </h3>
            
            <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 20px;">
                Use para especificar locais internos (Ex: COZINHA, SALA DOS PROFESSORES, TI).
            </p>

            <div style="margin-top: 10px;">
                <label style="color: #cbd5e1; font-size: 0.8rem; display: block; margin-bottom: 8px;">
                    NOME DO SETOR:
                </label>
                <input type="text" id="cad_setor_nome" placeholder="Ex: SECRETARIA" 
                       class="input-vidro" style="width: 100%; text-transform: uppercase;">
            </div>

            <button onclick="salvarNovoSetor()" class="btn-grande btn-vidro" 
                    style="background: #10b981; margin-top: 25px; width: 100%;">
                ✔️ CADASTRAR SETOR
            </button>
        </div>
    `;
    setTimeout(() => document.getElementById('cad_setor_nome').focus(), 300);
}

async function salvarNovoSetor() {
    const nome = document.getElementById('cad_setor_nome').value;
    const token = localStorage.getItem('token');

    if (!nome) return alert("Por favor, informe o nome do setor.");

    try {
        const res = await fetch(`${API_URL}/setores`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nome })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ " + data.message);
            document.getElementById('cad_setor_nome').value = '';
        } else {
            alert("⚠️ " + data.error);
        }
    } catch (e) {
        alert("Erro ao conectar com o servidor.");
    }
}

async function formProduto() {
    const area = document.getElementById('area-formulario-cadastro');
    area.innerHTML = `<div class="painel-vidro">🔍 Consultando categorias...</div>`;

    try {
        const res = await fetch(`${API_URL}/categorias`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const categorias = await res.json();

        area.innerHTML = `
            <div class="card-login" style="max-width: 100%; text-align: left;">
                <h3 style="text-align: center; color: white;">CADASTRO DE NOVO ITEM</h3>
                
                <label style="color: white; display: block; margin-top: 10px;">NOME DO PRODUTO:</label>
                <input type="text" id="prod_nome" placeholder="Ex: TENIS, CAMISA, PAPEL A4..." style="text-transform: uppercase;">
                
                <label style="color: white; display: block; margin-top: 10px;">TIPO:</label>
                <select id="prod_tipo" class="input-grade" style="width: 100%; height: 50px;" onchange="ajustarExibicaoAlerta()">
                    <option value="MATERIAL">MATERIAL</option>
                    <option value="UNIFORMES">UNIFORMES</option>
                    <option value="PATRIMONIO">PATRIMÔNIO</option>
                </select>

                <label style="color: white; display: block; margin-top: 10px;">CATEGORIA:</label>
                <select id="prod_categoria" class="input-grade" style="width: 100%; height: 50px;">
                    <option value="">-- SELECIONE --</option>
                    ${categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                </select>

                <div id="div_alerta_minimo">
                    <label style="color: white; display: block; margin-top: 10px;">ALERTA DE ESTOQUE BAIXO:</label>
                    <input type="number" id="prod_alerta" value="0">
                </div>

                <button onclick="salvarProdutoNovo()" style="background: var(--success); margin-top: 25px; width: 100%; font-weight: bold;">
                    CADASTRAR E GERAR GRADE
                </button>
            </div>
        `;
        ajustarExibicaoAlerta();
    } catch (err) {
        area.innerHTML = `<div class="painel-vidro" style="color:red;">Erro ao carregar categorias.</div>`;
    }
}

async function salvarProdutoNovo() {
    const nome = document.getElementById('prod_nome').value.toUpperCase().trim();
    const tipo = document.getElementById('prod_tipo').value;
    const categoriaSelect = document.getElementById('prod_categoria');
    const categoria_id = categoriaSelect.value;
    const alerta_minimo = document.getElementById('prod_alerta').value;

    if (!nome) return alert("O nome do produto é obrigatório!");

    const payload = {
        nome: nome,
        tipo: tipo,
        // Envia null se não houver categoria selecionada
        categoria_id: categoria_id ? parseInt(categoria_id) : null,
        alerta_minimo: parseInt(alerta_minimo) || 0
    };

    try {
        const res = await fetch(`${API_URL}/cadastros/produtos`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Cadastro realizado com sucesso!");
            formProduto(); // Limpa a tela
        } else {
            const erro = await res.json();
            alert("❌ Erro no Servidor: " + erro.error);
        }
    } catch (err) {
        console.error("Erro de conexão:", err);
        alert("🚨 Falha de conexão com o servidor.");
    }
}

function ajustarExibicaoAlerta() {
    const tipo = document.getElementById('prod_tipo').value;
    document.getElementById('div_alerta_minimo').style.display = (tipo === 'PATRIMONIO') ? 'none' : 'block';
}

function ajustarCamposTipo() {
    const tipo = document.getElementById('prod_tipo').value;
    const divAlerta = document.getElementById('div_alerta_minimo');
    // Só mostra alerta para Material e Uniformes
    divAlerta.style.display = (tipo === 'PATRIMONIO') ? 'none' : 'block';
}

function toggleAlerta() {
    const tipo = document.getElementById('p_tipo').value;
    const divAlerta = document.getElementById('div_p_alerta');
    const inputAlerta = document.getElementById('p_alerta');

    if (tipo === 'PATRIMONIO') {
        // Esconde o campo de alerta e zera o valor
        divAlerta.style.display = 'none';
        inputAlerta.value = 0;
    } else {
        // Mostra para Materiais e Uniformes
        divAlerta.style.display = 'block';
    }
}

function toggleAlertaEstoque() {
    const tipo = document.getElementById('prod_tipo').value;
    document.getElementById('div_alerta_minimo').style.display = (tipo === 'PATRIMONIO') ? 'none' : 'block';
}

async function salvarNovoProduto(event) {
    event.preventDefault();
    
    const dados = {
        nome: document.getElementById('prod_nome').value,
        tipo: document.getElementById('prod_tipo').value,
        categoria: document.getElementById('prod_categoria').value,
        descricao: document.getElementById('prod_descricao').value
    };

    try {
        const res = await fetch(`${API_URL}/produtos/cadastrar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            alert("✅ Produto cadastrado com sucesso no catálogo!");
            carregarDashboard(); // Volta para a tela principal
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) {
        alert("Falha na conexão com o servidor.");
    }
}

async function telaEntradaPatrimonioLote() {
    const area = document.getElementById('app-content');
    
    // Busca produtos do tipo PATRIMONIO
    const res = await fetch(`${API_URL}/produtos`, { headers: {'Authorization': `Bearer ${TOKEN}`} });
    const produtos = await res.json();
    const listaPatrimonios = produtos.filter(p => p.tipo === 'PATRIMONIO');

    area.innerHTML = `
        <div class="painel-vidro" style="max-width: 800px; margin: auto;">
            <h2 style="color:white; text-align:center;">📥 ENTRADA DE PATRIMÔNIO (LOTE)</h2>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <input type="text" id="nf_chave" placeholder="CHAVE DA NFe (44 dígitos)" class="input-vidro" maxlength="44">
                <input type="text" id="nf_numero" placeholder="NÚMERO DA NF" class="input-vidro">
                <select id="ent_produto_id" class="input-vidro">
                    <option value="">-- SELECIONE O PRODUTO --</option>
                    ${listaPatrimonios.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                </select>
                <input type="number" id="ent_qtd" placeholder="QUANTIDADE" class="input-vidro" oninput="gerarCamposSeries()">
            </div>

            <div id="container-series" style="max-height: 400px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; display: none;">
                <h4 style="color: #fbbf24; margin-top:0;">📝 INFORME AS PLAQUETAS/SÉRIES:</h4>
                <div id="lista-inputs-series" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"></div>
            </div>

            <button onclick="salvarEntradaLote()" id="btn-salvar-lote" class="btn-grande btn-vidro" style="background:#059669; margin-top:20px; display:none; width:100%;">
                FINALIZAR ENTRADA NO ESTOQUE CENTRAL
            </button>
        </div>
    `;
}



function gerarCamposSeries() {
    const qtd = parseInt(document.getElementById('ent_qtd').value);
    const container = document.getElementById('container-series');
    const lista = document.getElementById('lista-inputs-series');
    const btn = document.getElementById('btn-salvar-lote');

    if (qtd > 0) {
        container.style.display = 'block';
        btn.style.display = 'block';
        lista.innerHTML = '';
        for (let i = 1; i <= qtd; i++) {
            lista.innerHTML += `
                <input type="text" class="input-serie-item input-vidro" placeholder="Plaqueta #${i}" required>
            `;
        }
    } else {
        container.style.display = 'none';
        btn.style.display = 'none';
    }
}

async function salvarLotePatrimonio() {
    // 1. Coleta dados do Documento Fiscal
    const tipoDoc = document.getElementById('doc_tipo').value;
    const numDoc = document.getElementById('doc_numero')?.value || '';
    const serieDoc = document.getElementById('doc_serie')?.value || '';
    const chaveNfe = document.getElementById('doc_chave')?.value || '';

    // 2. Coleta dados do Produto
    const produtoId = document.getElementById('lote_produto').value;
    const quantidade = parseInt(document.getElementById('lote_qtd').value);

    // 3. Coleta e Valida os Números de Série
    const inputsSerie = document.querySelectorAll('.serie-item');
    const listaSeries = [];
    let erroSerie = false;

    inputsSerie.forEach((input, index) => {
        const valor = input.value.trim();
        if (!valor) {
            input.style.borderColor = "#ef4444"; // Marca erro em vermelho
            erroSerie = true;
        } else {
            input.style.borderColor = "#fbbf24"; // Restaura cor padrão
            listaSeries.push(valor);
        }
    });

    // --- VALIDAÇÕES ---
    if (tipoDoc === 'DANFE' && (!numDoc || !serieDoc)) {
        return alert("Por favor, preencha o número e a série da Nota Fiscal.");
    }
    if (tipoDoc === 'CHAVE' && chaveNfe.length < 44) {
        return alert("A Chave de Acesso deve conter os 44 dígitos bipados.");
    }
    if (!produtoId || isNaN(quantidade)) {
        return alert("Selecione o produto e informe a quantidade total.");
    }
    if (erroSerie) {
        return alert("Existem campos de série/plaqueta vazios. Todos os itens devem ser identificados.");
    }

    // 4. Envio dos Dados para o Servidor
    if (!confirm(`Confirmar a entrada de ${quantidade} itens no patrimônio?`)) return;

    try {
        const payload = {
            doc: { tipo: tipoDoc, numero: numDoc, serie: serieDoc, chave: chaveNfe },
            itens: { produto_id: produtoId, quantidade, series: listaSeries }
        };

        const res = await fetch(`${API_URL}/estoque/entrada-patrimonio-lote`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ " + data.message);
            carregarDashboard(); // Retorna ao menu
        } else {
            // Caso o banco rejeite (ex: número de série já existente)
            alert("⚠️ " + data.error);
        }
    } catch (err) {
        alert("Erro crítico de conexão com o servidor.");
    }
}

function alternarCamposDoc() {
    const tipo = document.getElementById('doc_tipo').value;
    const container = document.getElementById('container_campos_doc');

    if (tipo === 'DANFE') {
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 100px; gap:10px;">
                <input type="text" id="doc_numero" placeholder="Número da Nota" class="input-vidro" style="width:100%;">
                <input type="text" id="doc_serie" placeholder="Série" class="input-vidro" style="width:100%;">
            </div>
        `;
    } else {
        container.innerHTML = `
            <input type="text" id="doc_chave" placeholder="Bipe ou Digite a Chave da NFe (44 dígitos)" class="input-vidro" style="width:100%;">
        `;
    }
}

function gerarInputsSerie() {
    const qtd = parseInt(document.getElementById('lote_qtd').value);
    const container = document.getElementById('container_series_lote');
    const sessao = document.getElementById('sessao_series');

    if (qtd > 0) {
        sessao.style.display = 'block';
        container.innerHTML = '';
        for (let i = 1; i <= qtd; i++) {
            container.innerHTML += `
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                    <label style="color:#cbd5e1; font-size:0.7rem; display:block;">ITEM ${i}:</label>
                    <input type="text" class="input-vidro serie-item" placeholder="Série/Plaqueta" style="width:100%; border-color:#fbbf24;">
                </div>
            `;
        }
    } else {
        sessao.style.display = 'none';
    }
}

function gerarCamposSerieLote() {
    const qtd = document.getElementById('lote_qtd').value;
    const container = document.getElementById('container_series_lote');
    const btn = document.getElementById('btn-salvar-lote');
    container.innerHTML = '';
    
    if (qtd > 0) {
        btn.style.display = 'block';
        for (let i = 1; i <= qtd; i++) {
            container.innerHTML += `
                <input type="text" class="input-serie-lote" placeholder="PLAQUETA ${i}">
            `;
        }
    }
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

async function salvarEntradaLote() {
    const seriesInputs = document.querySelectorAll('.input-serie-item');
    const payload = {
        tipo_doc: 'NFe',
        numero_doc: document.getElementById('nf_numero').value,
        chave_nfe: document.getElementById('nf_chave').value,
        produto_id: document.getElementById('ent_produto_id').value,
        series: Array.from(seriesInputs).map(input => input.value).filter(v => v !== '')
    };

    if (payload.series.length === 0) return alert("Informe as plaquetas!");

    try {
        const res = await fetch(`${API_URL}/estoque/entrada-patrimonio`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Lote registrado com sucesso no Estoque Central!");
            telaEntradaPatrimonioLote(); // Recarrega tela
        } else {
            const err = await res.json();
            alert("Erro: " + err.error);
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
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

async function enviarPedidoEscola(tipo) {
    // 🟢 BUSCA O LOCAL GUARDADO: Lê o ID que salvamos no login
    const localIdLogado = localStorage.getItem('local_id');
    
    if (!localIdLogado || localIdLogado === "") {
        return alert("ERRO: Seu usuário não está vinculado a uma escola. Contate o administrador.");
    }

    if (carrinhoSolicitacao.length === 0) return alert("Adicione itens à solicitação!");

    const dadosPedido = {
        local_destino_id: parseInt(localIdLogado), // Envia o ID da escola do usuário
        tipo_pedido: tipo,
        itens: carrinhoSolicitacao
    };

    try {
        const res = await fetch(`${API_URL}/pedidos/escola/solicitar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(dadosPedido)
        });

        if (res.ok) {
            alert("✅ Solicitação enviada com sucesso!");
            carrinhoSolicitacao = [];
            carregarDashboard();
        } else {
            alert("Erro ao enviar solicitação.");
        }
    } catch (err) {
        alert("Erro de conexão com o servidor.");
    }
}

function ordenarTamanhos(lista) {
    const ordemLetras = { 'PP': 1, 'P': 2, 'M': 3, 'G': 4, 'GG': 5, 'EXG': 6, 'UNICO': 7 };
    return lista.sort((a, b) => {
        const tA = String(a.tamanho || a);
        const tB = String(b.tamanho || b);
        if (!isNaN(tA) && !isNaN(tB)) return parseInt(tA) - parseInt(tB);
        if (ordemLetras[tA] && ordemLetras[tB]) return ordemLetras[tA] - ordemLetras[tB];
        return tA.localeCompare(tB);
    });
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

async function abrirModalConferencia(pedidoId) {
    const modal = document.getElementById('modal-analise');
    const res = await fetch(`${API_URL}/pedidos/detalhes/${pedidoId}`, { headers: {'Authorization': `Bearer ${TOKEN}`} });
    const itens = await res.json();

    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:800px; max-height:90vh; overflow-y:auto;">
            <h2 style="color:#1e3a8a;">📦 CONFERÊNCIA DE SAÍDA</h2>
            <p style="color:#64748b;">Confirme as quantidades que estão saindo agora.</p>
            
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                <thead style="background:#f1f5f9; color:#1e3a8a;">
                    <tr>
                        <th style="padding:10px; text-align:left;">PRODUTO</th>
                        <th style="padding:10px;">SOLICITADO</th>
                        <th style="padding:10px;">ENVIAR AGORA</th>
                    </tr>
                </thead>
                <tbody>
                    ${itens.map(i => `
                        <tr style="border-bottom:1px solid #eee;">
                            <td style="padding:10px;">${i.produto} (Tam: ${i.tamanho})</td>
                            <td style="padding:10px; text-align:center;">${i.quantidade}</td>
                            <td style="padding:10px; text-align:center;">
                                <input type="number" class="input-remessa" data-id="${i.produto_id}" data-tam="${i.tamanho}" 
                                    value="${i.quantidade}" min="0" max="${i.quantidade}"
                                    style="width:70px; padding:8px; border:2px solid #cbd5e1; border-radius:6px; font-weight:bold; text-align:center;">
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <input type="text" id="motorista" placeholder="Nome do Motorista" style="padding:12px; border:1px solid #ccc; border-radius:6px;">
                <input type="text" id="placa" placeholder="Placa do Veículo" style="padding:12px; border:1px solid #ccc; border-radius:6px;">
            </div>
            
            <div style="display:flex; gap:10px;">
                <button onclick="enviarRemessaFinal(${pedidoId})" style="flex:2; background:#10b981; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    🚚 FINALIZAR E GERAR ROMANEIO
                </button>
                <button onclick="modal.style.display='none'" style="flex:1; background:#94a3b8; color:white; border:none; border-radius:8px; cursor:pointer;">CANCELAR</button>
            </div>
        </div>
    `;
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

async function enviarRemessaFinal(pedidoId) {
    // 1. Coleta os dados do Motorista e Veículo
    const motorista = document.getElementById('motorista').value;
    const placa = document.getElementById('placa').value;

    if (!motorista || !placa) {
        alert("⚠️ Por favor, preencha o nome do motorista e a placa do veículo.");
        return;
    }

    // 2. Coleta os itens e as quantidades que o estoque confirmou
    const inputs = document.querySelectorAll('.input-remessa');
    const itensParaEnviar = [];

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itensParaEnviar.push({
                produto_id: input.getAttribute('data-id'),
                tamanho: input.getAttribute('data-tam'),
                qtd_enviada: qtd
            });
        }
    });

    if (itensParaEnviar.length === 0) {
        alert("❌ Você não pode gerar uma remessa vazia. Informe as quantidades.");
        return;
    }

    // 3. Envia para o Backend
    try {
        const res = await fetch(`${API_URL}/pedidos/estoque/finalizar-remessa`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ 
                pedidoId, 
                itensParaEnviar, 
                motorista, 
                placa 
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ Remessa gerada e estoque atualizado!");
            
            // Fecha o modal de conferência
            document.getElementById('modal-analise').style.display = 'none';
            
            // Recarrega a lista de pedidos pendentes do estoque
            telaEstoquePedidosPendentes();

            // 🖨️ ABRE O ROMANEIO PARA IMPRESSÃO AUTOMATICAMENTE
            imprimirRomaneio(data.romaneioId);
            
        } else {
            alert("Erro ao processar remessa: " + data.error);
        }
    } catch (err) {
        console.error(err);
        alert("🚨 Erro de comunicação com o servidor.");
    }
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
        const res = await fetch(`${API_URL}/pedidos/contagem/alertas`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        // Se não for um JSON (ex: erro 500 enviando HTML), interrompe sem dar erro no console
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;

        const data = await res.json();
        // ... restante da sua lógica
    } catch (error) {
        // Silencia o erro para não travar o restante do script
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
    // 1. Remove qualquer modal aberto anteriormente para não duplicar
    const modalAntigo = document.querySelector('.modal-overlay');
    if (modalAntigo) modalAntigo.remove();

    // 2. Criamos o elemento do modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // 3. Função interna para fechar o modal
    const fechar = () => modal.remove();

    modal.innerHTML = `
        <div class="modal-box" style="
            max-width: 400px; 
            border-top: 5px solid #3498db; 
            position: relative; 
            background: rgba(255, 255, 255, 0.97); /* Fundo quase sólido para garantir leitura */
            backdrop-filter: blur(12px);           /* Desfoque do fundo para estilo moderno */
            -webkit-backdrop-filter: blur(12px);   /* Suporte para Safari */
            padding: 25px; 
            border-radius: 12px; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <button id="btn-voltar-calc" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                
                <h3 style="margin:0; font-size: 16px; color: #1e293b;">🧮 CALCULADORA</h3>
                
                <button id="btn-x-calc" style="background:none; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
            </div>
            
            <p style="font-size: 13px; color: #475569; margin-bottom:20px;">Converta quantidades totais em embalagens.</p>

            <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
                <label style="font-size: 12px; font-weight: 800; color: #1e293b;">QUANTIDADE TOTAL:</label>
                <input type="number" id="calc_total" class="input-field" placeholder="Ex: 10" oninput="calcularConversao()" style="background: white;">

                <label style="font-size: 12px; font-weight: 800; color: #1e293b;">UNIDADES POR EMBALAGEM:</label>
                <input type="number" id="calc_embalagem" class="input-field" placeholder="Ex: 4" oninput="calcularConversao()" style="background: white;">

                <label style="font-size: 12px; font-weight: 800; color: #1e293b;">NOME DA EMBALAGEM:</label>
                <input type="text" id="calc_nome_emb" class="input-field" value="LATA" oninput="calcularConversao()" style="background: white;">
            </div>

            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #e2e8f0;">

            <div id="resultado_calculadora" style="background: #f1f5f9; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; min-height: 60px; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; color: #1e293b; font-size: 15px;">
                Aguardando dados...
            </div>
            
            <button id="btn-fechar-calc" class="btn-block" style="margin-top: 20px; background: #3498db; color: white; border: none; padding: 12px; border-radius: 6px; width: 100%; cursor: pointer; font-weight: bold; transition: 0.2s;">FECHAR</button>
        </div>
    `;

    document.body.appendChild(modal);

    // 4. Fechamento ao clicar fora da caixa (opcional, mas recomendado)
    modal.onclick = (e) => { if(e.target === modal) fechar(); };

    // 5. Atribuindo os eventos de clique
    document.getElementById('btn-voltar-calc').onclick = () => { fechar(); carregarDashboard(); };
    document.getElementById('btn-x-calc').onclick = fechar;
    document.getElementById('btn-fechar-calc').onclick = fechar;
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
async function renderizarDashboardGeral() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">📊 Sincronizando fluxo logístico...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/dashboard/contagem`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const c = await res.json(); // Abreviação de 'contagem'

        // Função auxiliar para garantir que status vazios mostrem '0'
        const getQtd = (status) => c[status] || 0;

        container.innerHTML = `
            <div style="padding:20px; background:#f0f2f5; min-height:100vh;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                    <h2 style="color:#1e3a8a; margin:0;">📦 PAINEL GERAL DE FLUXO (Tempo Real)</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>

                <h3 style="color:#64748b; font-size:0.9rem; border-bottom:1px solid #cbd5e1; padding-bottom:5px;">🏢 ADMINISTRATIVO / ESCOLA</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px;">
                    ${cardDashboard("⚖️ PENDENTES", getQtd('AGUARDANDO_AUTORIZACAO'), "#6366f1", 'AGUARDANDO_AUTORIZACAO')}
                    ${cardDashboard("✅ APROVADOS", getQtd('APROVADO'), "#10b981", 'APROVADO')}
                    ${cardDashboard("❌ RECUSADOS", getQtd('RECUSADO'), "#ef4444", 'RECUSADO')}
                </div>

                <h3 style="color:#64748b; font-size:0.9rem; border-bottom:1px solid #cbd5e1; padding-bottom:5px;">📦 OPERACIONAL (ESTOQUE)</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px;">
                    ${cardDashboard("⏳ AGUARD. SEPARAÇÃO", getQtd('AGUARDANDO_SEPARACAO'), "#f59e0b", 'AGUARDANDO_SEPARACAO')}
                    ${cardDashboard("🧺 EM SEPARAÇÃO", getQtd('EM_SEPARACAO') + getQtd('SEPARACAO_INICIADA'), "#3b82f6", 'EM_SEPARACAO')}
                    ${cardDashboard("🚩 COLETA LIBERADA", getQtd('COLETA_LIBERADA'), "#8b5cf6", 'COLETA_LIBERADA')}
                </div>

                <h3 style="color:#64748b; font-size:0.9rem; border-bottom:1px solid #cbd5e1; padding-bottom:5px;">🚚 LOGÍSTICA / TRANSPORTE</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px;">
                    ${cardDashboard("🚛 AGUARD. COLETA", getQtd('AGUARDANDO_COLETA'), "#06b6d4", 'AGUARDANDO_COLETA')}
                    ${cardDashboard("🛣️ EM TRÂNSITO", getQtd('EM_TRANSPORTE'), "#f97316", 'EM_TRANSPORTE')}
                    ${cardDashboard("🏁 ENTREGUES", getQtd('ENTREGUE'), "#059669", 'ENTREGUE')}
                    ${cardDashboard("🔄 DEVOLUÇÕES", getQtd('DEVOLUCAO_PENDENTE') + getQtd('DEVOLUCAO_EM_TRANSITO') + getQtd('DEVOLVIDO'), "#475569", 'DEVOLVIDO')}
                </div>
            </div>
        `;
    } catch (e) { alert("Erro ao atualizar painel."); }
}

// FUNÇÃO AUXILIAR PARA CRIAR OS CARDS (Mantém o estilo do seu print)
function cardDashboard(titulo, valor, cor, statusBusca) {
    return `
        <div onclick="verPedidosPorStatus('${statusBusca}')" style="background:white; padding:20px; border-radius:12px; border-left:8px solid ${cor}; box-shadow:0 4px 6px rgba(0,0,0,0.05); cursor:pointer; transition:transform 0.2s;">
            <div style="color:#64748b; font-size:0.8rem; font-weight:bold; margin-bottom:10px;">${titulo}</div>
            <div style="font-size:2rem; font-weight:bold; color:#1e293b;">${valor}</div>
        </div>
    `;
}

function inicializarGraficos(dadosEvolucao, dadosStats) {
    // 1. Gráfico de Linhas/Barras (Evolução)
    const ctxBarra = document.getElementById('chartEvolucao').getContext('2d');
    new Chart(ctxBarra, {
        type: 'line',
        data: {
            labels: dadosEvolucao.map(d => d.data),
            datasets: [{
                label: 'Pedidos Entregues',
                data: dadosEvolucao.map(d => d.total),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // 2. Gráfico de Pizza (Status)
    const ctxPizza = document.getElementById('chartPizza').getContext('2d');
    new Chart(ctxPizza, {
        type: 'doughnut',
        data: {
            labels: dadosStats.map(s => s.status.replace('_', ' ')),
            datasets: [{
                data: dadosStats.map(s => s.total),
                backgroundColor: ['#fbbf24', '#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ef4444']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// Função para atualizar a badge no menu
async function atualizarBadgeNotificacao() {
    const perfil = localStorage.getItem('perfil');
    // Apenas Admin e Estoque veem notificações de novos pedidos
    if (perfil === 'escola') return;

    try {
        const res = await fetch(`${API_URL}/pedidos/notificacoes/contagem`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        
        const badge = document.getElementById('badge-pendentes');
        if (data.total > 0) {
            badge.innerText = data.total > 99 ? '99+' : data.total;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        console.error("Erro ao buscar notificações");
    }
}

// Iniciar o monitoramento (Verifica a cada 30 segundos)
function iniciarMonitoramentoPedidos() {
    atualizarBadgeNotificacao(); // Verifica logo ao carregar
    setInterval(atualizarBadgeNotificacao, 30000); // 30000ms = 30 segundos
}

// Função auxiliar para criar os cards
function renderizarCardInfo(label, total, cor, status) {
    return `
        <div onclick="verListaPorStatus('${status}', '${label}')" 
             style="background:white; padding:15px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.05); border-left:6px solid ${cor}; cursor:pointer; transition:all 0.2s;"
             onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="color:#64748b; font-size:0.75rem; font-weight:bold; letter-spacing:0.5px;">${label}</div>
            <div style="font-size:1.8rem; font-weight:bold; color:#1e293b; margin-top:5px;">${total}</div>
        </div>
    `;
}

async function verListaPorStatus(status, label) {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div>Buscando pedidos...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/lista-geral`, { // Use sua rota de lista geral
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const todos = await res.json();
        const filtrados = todos.filter(p => p.status === status);

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="color:#1e3a8a;">📌 ${label}</h3>
                    <button onclick="renderizarDashboardGeral()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">⬅️ VOLTAR</button>
                </div>
                
                <div style="background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left;">
                                <th style="padding:12px;">ID</th>
                                <th style="padding:12px;">Destino</th>
                                <th style="padding:12px;">Data</th>
                                <th style="padding:12px;">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtrados.map(p => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:12px;">#${p.id}</td>
                                    <td style="padding:12px;">${p.escola_nome}</td>
                                    <td style="padding:12px;">${new Date(p.data_criacao).toLocaleDateString()}</td>
                                    <td style="padding:12px;">
                                        <button onclick="verDetalhesPedidoCompleto(${p.id}, '${status}', '${label}')" style="background:#1e40af; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">VER TUDO</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) { alert("Erro ao carregar lista."); }
}

async function verDetalhesPedidoCompleto(id, statusOrigem, labelOrigem) {
    const container = document.getElementById('app-content');
    
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/detalhes-gerais`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const info = data.info;

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#1e3a8a;">📄 DETALHES DO PEDIDO #${id}</h2>
                    <button onclick="verListaPorStatus('${statusOrigem}', '${labelOrigem}')" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">⬅️ VOLTAR</button>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
                    <div style="background:#f8fafc; padding:20px; border-radius:8px;">
                        <h4>INFORMAÇÕES GERAIS</h4>
                        <p><strong>Destino:</strong> ${info.escola_nome}</p>
                        <p><strong>Solicitante:</strong> ${info.solicitante_nome}</p>
                        <p><strong>Data Criação:</strong> ${new Date(info.data_criacao).toLocaleString()}</p>
                        <p><strong>Status Atual:</strong> <span style="background:#dcfce7; padding:4px 8px; border-radius:4px;">${info.status}</span></p>
                    </div>

                    <div style="background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
                        <h4>ITENS SOLICITADOS</h4>
                        <table style="width:100%; border-collapse:collapse;">
                            <tr style="text-align:left; border-bottom:2px solid #eee;">
                                <th style="padding:8px;">Produto</th>
                                <th style="padding:8px;">Tamanho</th>
                                <th style="padding:8px;">Qtd</th>
                            </tr>
                            ${data.itens.map(i => `
                                <tr style="border-bottom:1px solid #f9f9f9;">
                                    <td style="padding:8px;">${i.produto_nome}</td>
                                    <td style="padding:8px;">${i.tamanho || '-'}</td>
                                    <td style="padding:8px;">${i.quantidade}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (err) { alert("Erro ao carregar detalhes."); }
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


// Função auxiliar para agrupar uniformes por nome na visualização
function renderizarEstoqueUniformes(dados) {
    const agrupado = {};
    dados.forEach(item => {
        if (!agrupado[item.produto]) agrupado[item.produto] = [];
        agrupado[item.produto].push(item);
    });

    return Object.keys(agrupado).map(produto => `
        <div style="background:white; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1); border-top:4px solid #3b82f6;">
            <strong style="display:block; margin-bottom:10px; font-size:1.1rem;">${produto}</strong>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:5px;">
                ${agrupado[produto].map(t => `
                    <div style="background:#f9fafb; padding:5px; border-radius:4px; text-align:center; border:1px solid #eee;">
                        <div style="font-size:0.7rem; color:#666;">TAM ${t.tamanho}</div>
                        <div style="font-weight:bold;">${t.quantidade}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
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

// Variável global temporária para o carrinho
let carrinhoSolicitacao = [];

async function telaSolicitarUniforme() {
    const container = prepararContainerPrincipal();
    container.innerHTML = '<div style="padding:20px;">Carregando produtos...</div>';
    
    carrinhoSolicitacao = [];

    try {
        const res = await fetch(`${API_URL}/produtos/tipo/UNIFORMES`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const produtos = await res.json();

        const tituloTela = "👕 NOVA SOLICITAÇÃO DE UNIFORMES";

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                    <h2 style="color:#1e3a8a; margin:0;">${tituloTela}</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); height: fit-content;">
                        <h3 style="margin-top:0;">Adicionar Item</h3>
                        <label>PRODUTO:</label>
                        <select id="solicitar_produto_id" onchange="configurarGradeTamanhosDinamicamente()" style="width:100%; padding:10px; margin-bottom:15px;">
                            ${produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                        </select>

                        <label>TAMANHO:</label>
                        <select id="solicitar_tamanho" style="width:100%; padding:10px; margin-bottom:15px;">
                            <option>P</option><option>M</option><option>G</option><option>GG</option>
                        </select>

                        <label>QUANTIDADE:</label>
                        <input type="number" id="solicitar_qtd" value="1" min="1" style="width:100%; padding:10px; margin-bottom:15px;">

                        <button onclick="adicionarAoCarrinhoSolicitacao()" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                            ➕ ADICIONAR À LISTA
                        </button>
                    </div>

                    <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        <h3 style="margin-top:0;">Itens na Solicitação</h3>
                        <div id="lista_carrinho_solicitacao">
                            <p style="color:#666;">Nenhum item adicionado ainda.</p>
                        </div>
                        <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
                        <button id="btnEnviarSolicitacao" onclick="enviarPedidoEscola('SOLICITACAO')" disabled style="width:100%; padding:15px; background:#1e40af; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; opacity:0.5;">
                            🚀 ENVIAR SOLICITAÇÃO COMPLETA
                        </button>
                    </div>
                </div>
            </div>
        `;

        // ADICIONADO: Chama a função uma vez logo após carregar a tela para o primeiro item da lista
        configurarGradeTamanhosDinamicamente();

    } catch (e) { 
        console.error(e);
        alert("Erro ao carregar formulário de solicitação."); 
    }
}

function configurarGradeTamanhosDinamicamente() {
    const selectProd = document.getElementById('solicitar_produto_id');
    const selectTam = document.getElementById('solicitar_tamanho');
    
    if (!selectProd || !selectTam) return;

    // Pega o nome do produto selecionado no momento
    const nomeProduto = selectProd.options[selectProd.selectedIndex].text.toUpperCase();

    let htmlTamanhos = "";

    // Verifica se o produto é TÊNIS
    if (nomeProduto.includes('TENIS') || nomeProduto.includes('TÊNIS')) {
        // Grade Numérica para Calçados
        const gradeCalcado = ['22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43'];
        htmlTamanhos = gradeCalcado.map(t => `<option>${t}</option>`).join('');
    } else {
        // Grade Padrão de Vestuário (Roupas)
        const gradeVestuario = ['PP', 'P', 'M', 'G', 'GG', '2', '4', '6', '8', '10', '12', '14', '16'];
        htmlTamanhos = gradeVestuario.map(t => `<option>${t}</option>`).join('');
    }

    // Aplica a nova lista de opções ao select de tamanhos
    selectTam.innerHTML = htmlTamanhos;
}

function configurarGradeAdmin(produtoId) {
    const selectProd = document.getElementById('solicitar_produto_id');
    const selectTam = document.getElementById('solicitar_tamanho');
    
    if (!selectProd || !selectTam) return;

    const opcaoSelecionada = selectProd.options[selectProd.selectedIndex];
    const tipoProduto = opcaoSelecionada ? opcaoSelecionada.getAttribute('data-tipo') : '';
    const nomeProduto = opcaoSelecionada ? opcaoSelecionada.text.toUpperCase() : '';

    let htmlTamanhos = "";

    if (tipoProduto !== 'UNIFORMES' || !produtoId) {
        htmlTamanhos = '<option value="UNICO">ÚNICO</option>';
    } else if (nomeProduto.includes('TENIS') || nomeProduto.includes('TÊNIS')) {
        const gradeCalcado = [
            '22', '23', '24', '25', '26', '27', '28', '29', '30', 
            '31', '32', '33', '34', '35', '36', '37', '38', '39', 
            '40', '41', '42', '43'
        ];
        htmlTamanhos = gradeCalcado.map(t => `<option value="${t}">${t}</option>`).join('');
    } else {
        const gradeVestuario = ['P', 'M', 'G', 'GG', '2', '4', '6', '8', '10', '12', '14', '16'];
        htmlTamanhos = gradeVestuario.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    selectTam.innerHTML = htmlTamanhos;
}

function adicionarAoCarrinhoSolicitacao() {
    const selectProd = document.getElementById('solicitar_produto_id');
    const produto_id = selectProd.value;
    const nome = selectProd.options[selectProd.selectedIndex].text;
    const tamanho = document.getElementById('solicitar_tamanho').value;
    const quantidade = parseInt(document.getElementById('solicitar_qtd').value);

    if (quantidade <= 0) return alert("Informe uma quantidade válida.");

    carrinhoSolicitacao.push({ produto_id, nome, tamanho, quantidade });
    renderizarCarrinhoSolicitacao();
}

function removerDoCarrinho(index) {
    carrinhoSolicitacao.splice(index, 1);
    renderizarCarrinhoSolicitacao();
}

function renderizarCarrinhoSolicitacao() {
    const container = document.getElementById('lista_carrinho_solicitacao');
    const btn = document.getElementById('btnEnviarSolicitacao');
    
    if (carrinhoSolicitacao.length === 0) {
        container.innerHTML = '<p style="color:#666;">Nenhum item adicionado ainda.</p>';
        btn.disabled = true;
        btn.style.opacity = "0.5";
        return;
    }

    btn.disabled = false;
    btn.style.opacity = "1";
    
    container.innerHTML = `
        <table style="width:100%; border-collapse:collapse;">
            ${carrinhoSolicitacao.map((item, index) => `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px 0;"><strong>${item.nome}</strong><br><small>TAM: ${item.tamanho} | QTD: ${item.quantidade}</small></td>
                    <td style="text-align:right;"><button onclick="removerDoCarrinho(${index})" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button></td>
                </tr>
            `).join('')}
        </table>
    `;
}

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

async function visualizarDetalhesPedido(id) {
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/itens`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const itens = await res.json();

        let tabelaHtml = `
            <div style="margin-top:15px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <h4 style="margin:0 0 10px 0; color:#1e3a8a;">📋 ITENS DO PEDIDO #${id}</h4>
                <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                    <thead>
                        <tr style="border-bottom:1px solid #cbd5e1; text-align:left;">
                            <th style="padding:5px;">Produto</th>
                            <th style="padding:5px;">Tam.</th>
                            <th style="padding:5px;">Qtd.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itens.map(i => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:5px;">${i.nome} <small>(${i.tipo})</small></td>
                                <td style="padding:5px;">${i.tamanho || '-'}</td>
                                <td style="padding:5px;">${i.quantidade}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Exibe em um modal ou injeta em algum lugar da tela
        // Exemplo: alert ou criar um modal flutuante simples
        document.getElementById(`detalhes-pedido-${id}`).innerHTML = tabelaHtml;
        
    } catch (err) {
        alert("Erro ao carregar detalhes.");
    }
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
    if (!tabela) return alert("POR FAVOR, SELECIONE UMA TABELA.");

    let payload = {};
    // Ajuste o endpoint conforme a sua rota unificada (geralmente /cadastros/nome_tabela)
    let endpoint = `${API_URL}/cadastros/${tabela}`; 

    try {
        if (tabela === 'categorias') {
            payload = { nome: document.getElementById('cad_nome_categoria').value.toUpperCase() };
        } 
        else if (tabela === 'locais') {
            payload = { 
                nome: document.getElementById('cad_nome_local').value.toUpperCase(),
                tipo_local: document.getElementById('cad_tipo_local').value 
            };
        } 
        else if (tabela === 'setores') {
            payload = { 
                nome: document.getElementById('cad_nome_setor').value.toUpperCase(),
                local_id: document.getElementById('cad_local_id_setor').value 
            };
        } 
        else if (tabela === 'produtos') {
            const nome = document.getElementById('cad_nome_produto').value;
            const tipo = document.getElementById('cad_tipo_produto').value;
            const alerta = document.getElementById('cad_alerta_minimo').value;

            if (!nome || !tipo) return alert("NOME E CATEGORIA SÃO OBRIGATÓRIOS!");

            payload = { 
                nome: nome.toUpperCase(), 
                tipo: tipo, 
                alerta_minimo: parseInt(alerta) || 0 
            };
        }

        if (Object.keys(payload).length === 0) return alert("PREENCHA OS CAMPOS!");

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ REGISTO SALVO COM SUCESSO!");
            document.getElementById('modalCadastro').style.display = 'none';
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("❌ ERRO: " + (erro.error || "Falha ao salvar"));
        }
    } catch (f) {
        alert("Erro de ligação ao servidor.");
    }
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

async function telaEntradaEstoque() {
    const container = document.getElementById('app-content');
    
    let html = `
        <div style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="color:#1e3a8a;">📥 ENTRADA DE ESTOQUE</h2>
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">⬅️ VOLTAR</button>
            </div>

            <div style="background:white; padding:20px; border-radius:8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width:600px;">
                <label>TIPO DE PRODUTO:</label>
                <select id="tipo_entrada" onchange="carregarProdutosEntrada(this.value)" style="width:100%; padding:10px; margin-bottom:15px; border-radius:4px;">
                    <option value="">Selecione...</option>
                    <option value="MATERIAL">📦 MATERIAL / CONSUMO</option>
                    <option value="UNIFORMES">👕 UNIFORMES / VESTUÁRIO</option>
                </select>

                <label>PRODUTO:</label>
                <select id="produto_entrada" style="width:100%; padding:10px; margin-bottom:15px; border-radius:4px;">
                    <option value="">Selecione o tipo primeiro...</option>
                </select>

                <div id="campos_dinamicos_entrada"></div>

                <button onclick="salvarEntradaEstoque()" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:10px;">
                    CONFIRMAR ENTRADA
                </button>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

async function salvarEntradaEstoque() {
    const produto_id = document.getElementById('produto_entrada').value;
    const tipo = document.getElementById('tipo_entrada').value;
    let grade = [];
    let quantidade_total = 0;

    if (tipo === 'UNIFORMES') {
        const inputs = document.querySelectorAll('.qtd-grade');
        inputs.forEach(i => {
            const qtd = parseInt(i.value) || 0;
            if (qtd > 0) {
                grade.push({ tamanho: i.dataset.tamanho, quantidade: qtd });
                quantidade_total += qtd;
            }
        });
    } else {
        quantidade_total = parseInt(document.getElementById('qtd_total_material').value) || 0;
    }

    if (quantidade_total <= 0) return alert("Informe uma quantidade válida!");

    try {
        const res = await fetch(`${API_URL}/estoque/entrada`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ produto_id, tipo, grade, quantidade_total })
        });

        if (res.ok) {
            alert("✅ ESTOQUE ATUALIZADO!");
            telaEntradaEstoque();
        } else {
            alert("❌ Erro ao salvar entrada.");
        }
    } catch (err) { alert("Erro de conexão."); }
}

// Carrega os produtos dinamicamente ao mudar o tipo
async function carregarProdutosEntrada(tipo) {
    const select = document.getElementById('produto_entrada');
    const camposExtras = document.getElementById('campos_dinamicos_entrada');
    camposExtras.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/produtos/tipo/${tipo}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const produtos = await res.json();
        
        select.innerHTML = '<option value="">Selecione o produto...</option>' + 
                          produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');

        select.onchange = () => {
            const nomeProduto = select.options[select.selectedIndex].text;
            camposExtras.innerHTML = '';

            if (tipo === 'UNIFORMES') {
                let tamanhos = [];
                // Lógica para Tênis (Grade 22-43)
                if (nomeProduto.includes('TENIS') || nomeProduto.includes('CALCADO')) {
                    for (let i = 22; i <= 43; i++) tamanhos.push(i.toString());
                } else {
                    tamanhos = ['2', '4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G', 'GG', 'XG'];
                }

                camposExtras.innerHTML = `
                    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px; margin-top:15px;">
                        ${tamanhos.map(t => `
                            <div>
                                <label style="font-size:0.7rem;">TAM ${t}</label>
                                <input type="number" class="qtd-grade" data-tamanho="${t}" value="0" min="0" style="width:100%;">
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                camposExtras.innerHTML = `<label>QTD TOTAL:</label><input type="number" id="qtd_total_material" value="0" style="width:100%; padding:10px;">`;
            }
        };
    } catch (err) { alert("Erro ao carregar lista de produtos."); }
}

function renderizarGradeTamanhos(tipo, nomeProduto) {
    const camposExtras = document.getElementById('campos_dinamicos_entrada');
    camposExtras.innerHTML = '';

    if (tipo.toUpperCase() === 'UNIFORMES') {
        let tamanhos = [];
        
        // Verifica se é Tênis (agora aceita variações com ou sem acento)
        const eTenis = nomeProduto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('TENIS');

        if (eTenis) {
            for (let i = 22; i <= 43; i++) tamanhos.push(i.toString());
        } else {
            tamanhos = ['2', '4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G', 'GG', 'XG'];
        }

        camposExtras.innerHTML = `
            <p style="margin-top:10px;"><strong>GRADE DE QUANTIDADES:</strong></p>
            <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:5px; padding:10px; background:#f1f5f9; border-radius:5px;">
                ${tamanhos.map(t => `
                    <div style="text-align:center;">
                        <label style="display:block; font-size:0.7rem;">${t}</label>
                        <input type="number" class="qtd-grade" data-tamanho="${t}" value="0" min="0" style="width:45px;">
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        camposExtras.innerHTML = `
            <label style="display:block; margin-top:10px;">QUANTIDADE TOTAL:</label>
            <input type="number" id="qtd_total_material" value="0" min="1" style="width:100%; padding:8px;">
        `;
    }
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
async function iniciarProcessoSeparacao(pedidoId) {
    try {
        // 1. Avisa o servidor que a separação começou (muda status para SEPARACAO_INICIADA se ainda não for)
        await fetch(`${API_URL}/pedidos/estoque/iniciar-separacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ pedidoId })
        });

        // 2. Em vez de recarregar a lista, abrimos a tela de conferência de itens
        abrirTelaConferenciaItens(pedidoId);

    } catch (err) {
        alert("Erro ao iniciar processo.");
    }
}

async function abrirTelaConferenciaItens(pedidoId) {
    const container = document.getElementById('app-content');
    
    try {
        // Rota que deve retornar os itens com a soma do que já foi enviado por remessas
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/conferencia-itens`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const itens = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <h2 style="color:#1e3a8a;">📝 CONFERÊNCIA DE SAÍDA - PEDIDO #${pedidoId}</h2>
                <table style="width:100%; border-collapse:collapse; background:white;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #eee;">
                            <th style="padding:12px;">PRODUTO</th>
                            <th style="padding:12px;">TAM.</th>
                            <th style="padding:12px;">PEDIDO</th>
                            <th style="padding:12px;">JÁ ENVIADO</th>
                            <th style="padding:12px; background:#fff7ed;">NESTA REMESSA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itens.map(i => {
                            const pendente = i.quantidade - i.total_enviado;
                            return `
                            <tr>
                                <td style="padding:12px;">${i.nome}</td>
                                <td style="padding:12px; text-align:center;">${i.tamanho}</td>
                                <td style="padding:12px; text-align:center;">${i.quantidade}</td>
                                <td style="padding:12px; text-align:center; color:blue;">${i.total_enviado}</td>
                                <td style="padding:12px; background:#fff7ed; text-align:center;">
                                    <input type="number" class="qtd-envio" 
                                           data-prod-id="${i.produto_id}" 
                                           data-tam="${i.tamanho}" 
                                           data-max="${pendente}"
                                           value="${pendente}" min="0" max="${pendente}" 
                                           style="width:60px; padding:5px;">
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <button onclick="salvarRemessa(${pedidoId})" style="margin-top:20px; padding:15px; background:#1e40af; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                    🚀 FINALIZAR REMESSA (ATUALIZAR ESTOQUE)
                </button>
            </div>
        `;
    } catch (err) { alert("Erro ao carregar itens."); }
}

async function salvarRemessa(pedidoId) {
    const inputs = document.querySelectorAll('.qtd-envio');
    const itensRemessa = [];
    let erroValidacao = false;

    inputs.forEach(input => {
        const qtd = parseInt(input.value) || 0;
        const maxPermitido = parseInt(input.dataset.max); // Pega o que ainda falta enviar

        if (qtd > maxPermitido) {
            alert(`Erro: Você tentou enviar ${qtd} unidades, mas o saldo pendente é de apenas ${maxPermitido}.`);
            erroValidacao = true;
            return;
        }

        if (qtd > 0) {
            itensRemessa.push({
                produto_id: input.dataset.prodId,
                tamanho: input.dataset.tam,
                quantidade_enviada: qtd
            });
        }
    });

    if (erroValidacao) return; // Interrompe se houver erro
    if (itensRemessa.length === 0) return alert("Informe a quantidade de pelo menos um item.");

    if (!confirm("Confirmar o registro desta remessa de saída?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/estoque/finalizar-remessa`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}` 
            },
            body: JSON.stringify({ pedidoId, itens: itensRemessa })
        });
        if (res.ok) {
            const data = await res.json();
            
            // Pequeno delay para o usuário respirar após o clique
            setTimeout(() => {
                if (confirm(`✅ Remessa #${data.remessaId} Salva!\n\nDeseja compartilhar o Romaneio via WhatsApp agora?`)) {
                    gerarECompartilharRomaneio(data.remessaId);
                }
                telaEstoquePedidosPendentes(); // Recarrega a fila
            }, 300);

        } else {
            const data = await res.json();
            alert("Erro: " + data.error);
        }
    } catch (err) {
        alert("Erro de conexão.");
    }
}

async function telaAbastecerEstoque() {
    const container = document.getElementById('app-content');
    
    container.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="color:#1e3a8a;">📥 ENTRADA DE ESTOQUE</h2>
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">⬅️ VOLTAR</button>
            </div>

            <div style="background:white; padding:20px; border-radius:8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width:600px;">
                <label>TIPO DE PRODUTO:</label>
                <select id="tipo_entrada" onchange="carregarProdutosEntrada(this.value)" style="width:100%; padding:10px; margin-bottom:15px; border-radius:4px;">
                    <option value="">Selecione...</option>
                    <option value="MATERIAL">📦 MATERIAL / CONSUMO</option>
                    <option value="UNIFORMES">👕 UNIFORMES / VESTUÁRIO</option>
                </select>

                <label>PRODUTO:</label>
                <select id="produto_entrada" style="width:100%; padding:10px; margin-bottom:15px; border-radius:4px;">
                    <option value="">Selecione o tipo primeiro...</option>
                </select>

                <div id="campos_dinamicos_entrada"></div>

                <button onclick="salvarEntradaEstoque()" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:10px;">
                    CONFIRMAR ENTRADA
                </button>
            </div>
        </div>
    `;
}

async function enviarEntradaEstoque() {
    const inputs = document.querySelectorAll('.input-entrada-estoque');
    const itens = [];

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

    if (itens.length === 0) return alert("INSIRA AO MENOS UMA QUANTIDADE PARA ENTRADA!");

    if (!confirm("CONFIRMA A ENTRADA DESTAS QUANTIDADES NO ESTOQUE CENTRAL?")) return;

    try {
        const res = await fetch(`${API_URL}/estoque/entrada-uniforme`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}` 
            },
            body: JSON.stringify({ itens })
        });

        if (res.ok) {
            alert("✅ ESTOQUE ATUALIZADO!");
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("❌ ERRO: " + erro.error);
        }
    } catch (err) {
        alert("Erro na conexão com o servidor.");
    }
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

let carrinhoAdmin = [];

async function telaAdminCriarPedido() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="painel-vidro">🔍 Sincronizando dados de produtos e locais...</div>';
    
    carrinhoAdminDireto = []; 

    try {
        const [resLocais, resProdutos] = await Promise.all([
            fetch(`${API_URL}/locais/dropdown`, { headers: {'Authorization': `Bearer ${TOKEN}`} }),
            fetch(`${API_URL}/estoque/geral`, { headers: {'Authorization': `Bearer ${TOKEN}`} })
        ]);

        const locais = await resLocais.json();
        const produtos = await resProdutos.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div class="painel-usuario-vidro" style="position:relative; width:100%; top:0; right:0; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="color:white; margin:0;">📝 PEDIDO DIRETO (ADMIN)</h2>
                    <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#64748b;">⬅ VOLTAR</button>
                </div>

                <div class="grid-menu-principal" style="grid-template-columns: 1fr 1.2fr; gap: 20px; align-items: start; max-width: 1200px;">
                    
                    <div class="painel-vidro" style="text-align: left;">
                        <h3 style="color: #4ade80; margin-top:0;">1. Configurar Envio</h3>
                        
                        <label style="color:white; display:block; margin-bottom:8px;">DESTINO:</label>
                        <select id="admin_direto_local" class="input-vidro" style="width:100%; margin-bottom:15px;">
                            <option value="">-- SELECIONE A UNIDADE --</option>
                            ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                        </select>

                        <label style="color:white; display:block; margin-bottom:8px;">PRODUTO:</label>
                        <select id="admin_direto_produto" class="input-vidro" style="width:100%; margin-bottom:15px;">
                            <option value="">-- SELECIONE O ITEM --</option>
                            ${produtos.map(p => `<option value="${p.id}">${p.nome} (Saldo: ${p.quantidade_estoque})</option>`).join('')}
                        </select>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
                            <div>
                                <label style="color:white; display:block; margin-bottom:8px;">TAMANHO:</label>
                                <select id="admin_direto_tamanho" class="input-vidro" style="width:100%;">
                                    <option value="UNICO">ÚNICO</option>
                                    <option value="P">P</option><option value="M">M</option>
                                    <option value="G">G</option><option value="GG">GG</option>
                                </select>
                            </div>
                            <div>
                                <label style="color:white; display:block; margin-bottom:8px;">QTD:</label>
                                <input type="number" id="admin_direto_qtd" value="1" min="1" class="input-vidro" style="width:100%;">
                            </div>
                        </div>

                        <button onclick="adicionarAoCarrinhoAdminDireto()" class="btn-grande btn-vidro" style="background: #10b981;">
                            ➕ ADICIONAR AO PEDIDO
                        </button>
                    </div>

                    <div class="painel-vidro">
                        <h3 style="color: white; margin-top:0;">2. Resumo do Pedido</h3>
                        <div id="display-carrinho-admin" style="min-height: 150px; color: #cbd5e1; text-align: left;">
                            Aguardando itens...
                        </div>
                        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;">
                        <button id="btnFinalizarAdmin" onclick="enviarPedidoAdminDireto()" disabled class="btn-grande btn-vidro" style="width:100%; opacity:0.5;">
                            🚀 ENVIAR PARA EXPEDIÇÃO
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        alert("Erro ao sincronizar tabelas: produtos/locais.");
    }
}

async function enviarPedidoAdminDireto() {
    const localId = document.getElementById('admin_direto_local').value;
    if (!localId) return alert("Selecione o local de destino.");

    if (!confirm("Isso gerará baixa imediata no estoque e enviará o pedido para a expedição. Confirma?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/admin-direto-final`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ local_destino_id: localId, itens: carrinhoAdminDireto })
        });

        if (res.ok) {
            alert("✅ Pedido finalizado com sucesso!");
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) { alert("Falha na comunicação com o servidor."); }
}

function adicionarAoCarrinhoAdminDireto() {
    const select = document.getElementById('admin_direto_produto');
    const produtoId = select.value;
    const nome = select.options[select.selectedIndex].text;
    const tamanho = document.getElementById('admin_direto_tamanho').value;
    const qtd = parseInt(document.getElementById('admin_direto_qtd').value);

    if (!produtoId || qtd <= 0) return alert("Selecione um produto válido.");

    // Verifica se já existe a combinação ID + TAMANHO no carrinho
    const itemExistente = carrinhoAdminDireto.find(i => i.produto_id === produtoId && i.tamanho === tamanho);

    if (itemExistente) {
        itemExistente.quantidade += qtd; // Soma a quantidade ao item já existente
    } else {
        carrinhoAdminDireto.push({ produto_id: produtoId, nome, tamanho, quantidade: qtd });
    }

    document.getElementById('admin_direto_qtd').value = 1;
    atualizarVisualCarrinhoAdmin();
}

function atualizarVisualCarrinhoAdmin() {
    const display = document.getElementById('display-carrinho-admin');
    const btn = document.getElementById('btnFinalizarAdmin');

    if (carrinhoAdminDireto.length === 0) {
        display.innerHTML = "Sua lista está vazia.";
        btn.disabled = true;
        btn.style.opacity = "0.5";
        return;
    }

    display.innerHTML = carrinhoAdminDireto.map((item, index) => `
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <span><b>${item.quantidade}x</b> ${item.nome} (${item.tamanho})</span>
            <button onclick="removerItemAdmin(${index})" style="background:none; border:none; color:#f87171; cursor:pointer;">❌</button>
        </div>
    `).join('');

    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.background = "#3b82f6";
}

async function salvarPedidoDiretoAdmin() {
    const local_id = document.getElementById('admin_local_destino').value;
    
    try {
        const res = await fetch(`${API_URL}/pedidos/admin-direto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ local_destino_id: local_id, itens: carrinhoAdmin })
        });

        if (res.ok) {
            alert("✅ Sucesso! Pedido enviado para o estoque e baixa realizada.");
            carrinhoAdmin = [];
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) {
        alert("Falha de rede.");
    }
}

async function enviarPedidoGeralAdmin() {
    const localId = document.getElementById('pedido_local_id').value;
    if (!localId) return alert("Selecione a Unidade de Destino!");
    if (carrinhoSolicitacao.length === 0) return alert("Adicione itens ao pedido!");

    const dados = {
        local_destino_id: localId,
        tipo_pedido: 'PEDIDO_ADMIN',
        itens: carrinhoSolicitacao
    };

    try {
        const res = await fetch(`${API_URL}/pedidos/admin/direto`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            alert("🚀 Pedido criado e enviado diretamente para SEPARAÇÃO no estoque!");
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) {
        alert("Erro de conexão.");
    }
}

async function carregarProdutosAdmin(tipo) {
    const select = document.getElementById('admin_produto_id');
    const campos = document.getElementById('campos_especificos_admin');
    campos.innerHTML = '';
    
    const res = await fetch(`${API_URL}/produtos/tipo/${tipo}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const produtos = await res.json();
    select.innerHTML = produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');

    if (tipo === 'UNIFORMES') {
        campos.innerHTML = `
            <label>TAMANHO:</label>
            <select id="admin_tamanho" style="width:100%; padding:10px; margin-bottom:15px;">
                <option>P</option><option>M</option><option>G</option><option>GG</option><option>2</option><option>4</option>
                </select>
            <label>QUANTIDADE:</label>
            <input type="number" id="admin_qtd" value="1" min="1" style="width:100%; padding:10px; margin-bottom:15px;">
        `;
    } else {
        campos.innerHTML = `
            <label>QUANTIDADE:</label>
            <input type="number" id="admin_qtd" value="1" min="1" style="width:100%; padding:10px; margin-bottom:15px;">
        `;
    }
}

async function enviarPedidoDiretoAdmin() {
    const local_destino_id = document.getElementById('admin_local_destino').value;
    if (!local_destino_id) return alert("Selecione o local de destino!");

    try {
        const res = await fetch(`${API_URL}/pedidos/admin/criar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ local_destino_id, itens: carrinhoAdmin })
        });

        if (res.ok) {
            alert("✅ PEDIDO CRIADO! O estoque já pode visualizar para separação.");
            carregarDashboard();
        }
    } catch (e) { alert("Erro ao enviar pedido."); }
}

async function abrirPainelSeparacao() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; font-weight:bold;">Buscando pedidos aprovados...</div>';

    try {
        const tokenAtual = localStorage.getItem('token'); 
        const res = await fetch(`${API_URL}/pedidos/estoque/autorizados`, {
            headers: { 'Authorization': `Bearer ${tokenAtual}` }
        });

        if (!res.ok) throw new Error("Erro ao acessar o servidor.");

        const pedidos = await res.json();
        const tituloTela = "📦 SEPARAÇÃO DE VOLUMES";

        // Montagem do HTML - O Cabeçalho com VOLTAR sempre aparece primeiro
        let html = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                    <h2 style="color:#1e3a8a; margin:0;">${tituloTela}</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>
        `;

        // Lógica condicional: Se a lista estiver vazia ou se houver pedidos
        if (pedidos.length === 0) {
            html += `
                <div style="text-align:center; padding:50px; background:#f8fafc; border-radius:12px; border:2px dashed #cbd5e1; color:#64748b; margin-top:20px;">
                    <div style="font-size:4rem; margin-bottom:15px;">📋</div>
                    <h3 style="margin:0; color:#1e3a8a;">NENHUM PEDIDO AUTORIZADO</h3>
                    <p style="margin-top:10px;">No momento, não existem pedidos aguardando separação no estoque central.</p>
                </div>
            `;
        } else {
            html += `
                <p style="margin-bottom:20px; color:#475569;">Os pedidos abaixo foram <strong>APROVADOS</strong> e aguardam a separação física dos itens:</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
                    ${pedidos.map(p => `
                        <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border-top:5px solid #3b82f6;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                                <div>
                                    <span style="display:inline-block; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-bottom:5px;">PEDIDO #${p.id}</span>
                                    <h4 style="margin:0; color:#1e293b;">${p.escola_nome}</h4>
                                </div>
                                <small style="color:#94a3b8;">${new Date(p.data_criacao).toLocaleDateString()}</small>
                            </div>
                            
                            <button onclick="iniciarConferenciaPedido(${p.id})" style="width:100%; padding:12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; transition: background 0.2s;">
                                📦 INICIAR SEPARAÇÃO
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += `</div>`; // Fecha a div principal
        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="padding:20px; text-align:center;">
                <p style="color:#b91c1c; font-weight:bold;">⚠️ Falha ao carregar os dados de separação.</p>
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; margin-top:10px;">VOLTAR AO DASHBOARD</button>
            </div>
        `;
    }
}

async function telaGerarRemessa(pedidoId) {
    const container = document.getElementById('app-content');
    
    // Busca os itens do pedido com o saldo já enviado (precisamos criar essa rota ou adaptar a existente)
    const res = await fetch(`${API_URL}/pedidos/${pedidoId}/itens`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const itens = await res.json();

    container.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>🚚 GERAR REMESSA - PEDIDO #${pedidoId}</h2>
                <button onclick="abrirPainelSeparacao()" style="padding:8px 15px; cursor:pointer;">⬅️ VOLTAR</button>
            </div>

            <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                <label>Informação do Veículo / Motorista:</label>
                <input type="text" id="veiculo_info" placeholder="Ex: Caminhão Placa ABC-1234" style="width:100%; padding:10px; margin-bottom:20px;">

                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:left; background:#f8fafc;">
                            <th style="padding:10px;">PRODUTO</th>
                            <th style="padding:10px; text-align:center;">AUTORIZADO</th>
                            <th style="padding:10px; text-align:center;">RESTANTE</th>
                            <th style="padding:10px; text-align:center; background:#fef3c7;">ENVIAR AGORA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itens.map(item => {
                            const restante = item.quantidade_solicitada - (item.quantidade_enviada || 0);
                            return `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">${item.produto_nome} (TAM: ${item.tamanho})</td>
                                <td style="padding:10px; text-align:center;">${item.quantidade_solicitada}</td>
                                <td style="padding:10px; text-align:center; color:${restante > 0 ? 'red' : 'green'};"><strong>${restante}</strong></td>
                                <td style="padding:10px; text-align:center; background:#fffbeb;">
                                    <input type="number" class="qtd-enviar" 
                                           data-prod="${item.produto_id}" 
                                           data-tam="${item.tamanho}" 
                                           value="${restante}" max="${restante}" min="0" 
                                           style="width:60px; padding:5px; text-align:center; font-weight:bold; border:1px solid #f59e0b;">
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>

                <button onclick="finalizarSaidaEstoque(${pedidoId})" style="width:100%; margin-top:20px; padding:15px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                    CONFIRMAR SAÍDA DESTE CARREGAMENTO
                </button>
            </div>
        </div>`;
}

async function finalizarSaidaEstoque(pedidoId) {
    const inputs = document.querySelectorAll('.qtd-enviar');
    const veiculo = document.getElementById('veiculo_info').value;
    const itens = Array.from(inputs).map(i => ({
        produto_id: i.dataset.prod,
        tamanho: i.dataset.tam,
        qtd_enviar: parseInt(i.value) || 0
    })).filter(item => item.qtd_enviar > 0);

    if (itens.length === 0) return alert("Nenhuma quantidade informada para saída!");

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/remessa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ itens, veiculo })
        });

        if (res.ok) {
            alert("✅ REMESSA REGISTRADA E ESTOQUE ATUALIZADO!");
            abrirPainelSeparacao();
        }
    } catch (e) { alert("Erro ao processar saída."); }
}

async function antigoabrirPainelSeparacao(id) {
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
        const tokenAtual = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/pedidos/alertas-escola`, { 
            headers: { 'Authorization': `Bearer ${tokenAtual}` }
        });

        // PROTEÇÃO: Se a resposta não for OK (200), pegamos o texto do erro
        if (!res.ok) {
            const erroTexto = await res.text(); // Lê como texto para ver o HTML de erro
            console.error("Erro do servidor:", erroTexto);
            throw new Error("O servidor retornou um erro. Verifique o console.");
        }

        const pedidos = await res.json();
        const tituloTela = "🚚 PEDIDOS EM TRANSPORTE";

        let html = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                    <h2 style="color: #1e3a8a; margin:0;">${tituloTela}</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>
                
                ${pedidos.length === 0 ? '<p style="text-align:center; color:#666; padding:20px;">Nenhum pedido em transporte para sua unidade no momento.</p>' : ''}
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                    ${pedidos.map(p => `
                        <div style="background:white; padding:15px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); border-left:5px solid #3b82f6;">
                            <div style="margin-bottom:10px;">
                                <strong style="color:#1e3a8a;">PEDIDO #${p.id}</strong><br>
                                <small style="color:#666;">Data: ${new Date(p.data_criacao).toLocaleDateString()}</small>
                            </div>
                            <button onclick="confirmarEntregaEscola(${p.id})" style="width:100%; padding:10px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                                ✅ CONFIRMAR RECEBIMENTO
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (err) { 
        console.error(err);
        alert("Erro ao buscar entregas: " + err.message); 
    }
}

async function confirmarEntregaEscola(id) {
    if (!confirm("CONFIRMA O RECEBIMENTO DESTA ENTREGA NA SUA UNIDADE?")) return;
    
    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/confirmar-recebimento`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            }
        });

        if (res.ok) {
            alert("✅ RECEBIMENTO REGISTRADO! O estoque da unidade será atualizado.");
            listarPedidosEmCaminho(); // Recarrega a lista
        } else {
            const erro = await res.json();
            alert("Erro: " + (erro.error || "Falha ao confirmar."));
        }
    } catch (err) { 
        alert("Erro de conexão com o servidor."); 
    }
}

// --- 1. LISTAR COLETAS PENDENTES ---
async function listarColetaLogistica() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">Verificando cargas prontas no estoque...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/logistica/aguardando-coleta`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div style="padding:20px;">
                <h2 style="color:#1e3a8a;">🚚 PEDIDOS PRONTOS PARA COLETA</h2>
                <div class="grid-logistica">
                    ${pedidos.map(p => `
                        <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); margin-bottom:15px; border-left:5px solid #3b82f6;">
                            <div style="font-weight:bold; font-size:1.1rem; color:#1e3a8a;">PEDIDO #${p.id}</div>
                            <p><strong>DESTINO:</strong> ${p.escola_nome}</p>
                            <p style="font-size:0.9rem; color:#666;">Este pedido possui ${p.total_remessas} volume(s) preparado(s).</p>
                            
                            <button onclick="confirmarColetaLogistica(${p.id})" style="width:100%; margin-top:10px; padding:12px; background:#1e40af; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                                🚛 CONFIRMAR QUE COLETEI / INICIAR TRANSPORTE
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        container.innerHTML = html || '<p style="padding:20px;">Nenhuma carga pronta para coleta no momento.</p>';
    } catch (e) { alert("Erro ao carregar coletas."); }
}

async function confirmarColetaLogistica(id) {
    if (!confirm(`Confirma que está retirando o Pedido #${id} para transporte?`)) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/coletar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (res.ok) {
            alert("✅ TRANSPORTE INICIADO! A escola de destino já pode visualizar o status.");
            listarColetaLogistica();
        }
    } catch (e) { alert("Erro ao confirmar coleta."); }
}

// --- 2. SOLICITAR PATRIMÔNIO (LOGÍSTICA) ---
async function telaSolicitarPatrimonio() {
    // Reutilizamos a lógica da escola, mas filtramos apenas por PATRIMONIO
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">Carregando catálogo de patrimônio...</div>';

    try {
        const res = await fetch(`${API_URL}/produtos/tipo/PATRIMONIO`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const produtos = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                    <h2 style="color:#1e3a8a; margin:0;">🏷️ SOLICITAR MOVIMENTAÇÃO DE PATRIMÔNIO</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>

                <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); max-width:500px;">
                    <label>PRODUTO (MODELO):</label>
                    <select id="solic_pat_id" style="width:100%; padding:10px; margin-bottom:15px;">
                        ${produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                    </select>
                    
                    <label>QUANTIDADE DE ITENS:</label>
                    <input type="number" id="solic_pat_qtd" value="1" min="1" style="width:100%; padding:10px; margin-bottom:15px;">

                    <button onclick="enviarSolicitacaoPatrimonioLog()" style="width:100%; padding:12px; background:#1e40af; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                        SOLICITAR AO ADMIN
                    </button>
                </div>
            </div>`;
    } catch (e) { 
        alert("Erro ao carregar produtos de patrimônio."); 
    }
}

async function atualizarGradeTamanhos(produtoId) {
    const selectTamanho = document.getElementById('solicitar_tamanho');
    if (!selectTamanho) return;

    selectTamanho.innerHTML = '<option>Carregando...</option>';

    try {
        const res = await fetch(`${API_URL}/produtos/${produtoId}/grade`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const grade = await res.json();

        selectTamanho.innerHTML = ''; // Limpa o "Carregando"

        if (grade.length === 0) {
            selectTamanho.innerHTML = '<option value="UNICO">ÚNICO</option>';
        } else {
            grade.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.tamanho;
                opt.textContent = item.tamanho;
                selectTamanho.appendChild(opt);
            });
        }
    } catch (err) {
        selectTamanho.innerHTML = '<option value="UNICO">ERRO AO CARREGAR</option>';
    }
}

async function enviarSolicitacaoPatrimonioLog() {
    const produto_id = document.getElementById('solic_pat_id').value;
    const quantidade = parseInt(document.getElementById('solic_pat_qtd').value);

    if (!produto_id || quantidade <= 0) {
        return alert("POR FAVOR, SELECIONE O PRODUTO E A QUANTIDADE.");
    }

    // Criamos o array de itens no padrão que a rota /pedidos/escola/solicitar espera
    const itens = [{
        produto_id: produto_id,
        tamanho: 'N/A', // Padrão para itens que não são uniformes
        quantidade: quantidade
    }];

    try {
        // Reutilizamos a rota de solicitação que identifica automaticamente o local_id do utilizador
        const res = await fetch(`${API_URL}/pedidos/escola/solicitar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ itens })
        });

        if (res.ok) {
            alert("✅ SOLICITAÇÃO DE PATRIMÓNIO ENVIADA COM SUCESSO!");
            carregarDashboard();
        } else {
            const erro = await res.json();
            alert("❌ ERRO AO SOLICITAR: " + (erro.error || "Verifique os dados."));
        }
    } catch (err) {
        console.error("Erro na solicitação de património:", err);
        alert("Erro de ligação ao servidor.");
    }
}

// Função para abrir o histórico de remessas de um pedido
async function telaRelatorioRemessas(pedidoId) {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">A carregar histórico de transporte...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoId}/remessas`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const remessas = await res.json();

        let html = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#1e3a8a;">📜 HISTÓRICO DE REMESSAS - PEDIDO #${pedidoId}</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">⬅️ VOLTAR</button>
                </div>`;

        if (remessas.length === 0) {
            html += `<p>Nenhuma remessa (viagem) registada para este pedido até ao momento.</p>`;
        } else {
            for (const r of remessas) {
                // Para cada remessa, buscamos os itens dela
                const resItens = await fetch(`${API_URL}/remessas/${r.id}/itens`, {
                    headers: { 'Authorization': `Bearer ${TOKEN}` }
                });
                const itens = await resItens.json();

                html += `
                    <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); margin-bottom:20px; border-top:4px solid #3b82f6;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                            <div>
                                <strong>DATA DE SAÍDA:</strong> ${new Date(r.data_saida).toLocaleString()}<br>
                                <strong>VEÍCULO:</strong> ${r.veiculo_info || 'Não informado'}
                            </div>
                            <div style="text-align:right;">
                                <small>Despachado por: ${r.usuario_nome}</small>
                            </div>
                        </div>

                        <table style="width:100%; border-collapse:collapse; background:#f8fafc;">
                            <thead>
                                <tr style="text-align:left; font-size:0.85rem; border-bottom:1px solid #ddd;">
                                    <th style="padding:8px;">PRODUTO</th>
                                    <th style="padding:8px; text-align:center;">TAMANHO</th>
                                    <th style="padding:8px; text-align:center;">QTD ENVIADA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itens.map(item => `
                                    <tr>
                                        <td style="padding:8px;">${item.produto_nome}</td>
                                        <td style="padding:8px; text-align:center;">${item.tamanho}</td>
                                        <td style="padding:8px; text-align:center; font-weight:bold;">${item.quantidade_enviada}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }

        html += `</div>`;
        container.innerHTML = html;
    } catch (err) {
        alert("Erro ao carregar o relatório.");
    }
}

async function telaReceberDevolucoes() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">A procurar devoluções pendentes...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/estoque/devolucoes-pendentes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        let html = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                    <h2 style="color:#1e3a8a; margin:0;">🔄 RECEBER DEVOLUÇÕES (CONFERÊNCIA)</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>
        `;

        if (pedidos.length === 0) {
            html += `<p style="background:#f3f4f6; padding:20px; border-radius:8px; text-align:center;">Nenhuma devolução pendente para conferência.</p>`;
        } else {
            for (const p of pedidos) {
                const resItens = await fetch(`${API_URL}/pedidos/${p.id}/itens`, {
                    headers: { 'Authorization': `Bearer ${TOKEN}` }
                });
                const itens = await resItens.json();

                html += `
                    <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); margin-bottom:20px; border-left:5px solid #6366f1;">
                        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:15px;">
                            <div>
                                <strong>DEVOLUÇÃO #${p.id} - ${p.escola_nome}</strong><br>
                                <small>Enviada em: ${new Date(p.data_criacao).toLocaleString()}</small>
                            </div>
                            <button onclick="confirmarRecebimentoDevolucao(${p.id})" style="background:#10b981; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">
                                ✅ CONFIRMAR CHEGADA NO STOCK
                            </button>
                        </div>
                        
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <tr style="background:#f8fafc; text-align:left;">
                                <th style="padding:8px; border-bottom:1px solid #eee;">PRODUTO</th>
                                <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">TAMANHO</th>
                                <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">QTD A RECEBER</th>
                            </tr>
                            ${itens.map(item => `
                                <tr>
                                    <td style="padding:8px; border-bottom:1px solid #eee;">${item.produto_nome}</td>
                                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${item.tamanho}</td>
                                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; font-weight:bold;">${item.quantidade_solicitada}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                `;
            }
        }
        html += `</div>`;
        container.innerHTML = html;
    } catch (err) { alert("Erro ao carregar devoluções."); }
}

async function confirmarRecebimentoDevolucao(id) {
    if (!confirm("Confirma que todos os itens desta lista chegaram fisicamente ao stock central?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/confirmar-devolucao`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (res.ok) {
            alert("✅ STOCK ATUALIZADO COM SUCESSO!");
            telaReceberDevolucoes();
        } else {
            alert("Erro ao processar a devolução no servidor.");
        }
    } catch (err) { alert("Erro ao processar."); }
}

async function telaAcompanhamentoGeral() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">Carregando histórico de pedidos...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/lista-geral`, { // Certifique-se que esta rota existe no backend
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const pedidos = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#1e3a8a; margin:0;">📋 ACOMPANHAMENTO DE PEDIDOS E REMESSAS</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>

                <div style="background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
                                <th style="padding:15px;">ID</th>
                                <th style="padding:15px;">DESTINO</th>
                                <th style="padding:15px;">STATUS</th>
                                <th style="padding:15px;">DATA</th>
                                <th style="padding:15px; text-align:center;">AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedidos.map(p => `
                                <tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:15px;">#${p.id}</td>
                                    <td style="padding:15px;">${p.escola_nome || 'N/A'}</td>
                                    <td style="padding:15px;">
                                        <span style="padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; 
                                            background:${p.status === 'ENTREGUE' ? '#dcfce7' : '#fef3c7'}; 
                                            color:${p.status === 'ENTREGUE' ? '#166534' : '#92400e'};">
                                            ${p.status}
                                        </span>
                                    </td>
                                    <td style="padding:15px;">${new Date(p.data_criacao).toLocaleDateString()}</td>
                                    <td style="padding:15px; text-align:center;">
                                        <button onclick="telaRelatorioRemessas(${p.id})" style="background:#1e40af; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.85rem;">
                                            🔍 VER DETALHES / REMESSAS
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar lista de acompanhamento.");
    }
}

async function telaGerenciarPatrimonio() {
    const area = document.getElementById('app-content');
    area.innerHTML = `
        <div class="painel-vidro" style="max-width: 600px; margin: auto;">
            <h2 style="color:white; text-align:center;">🔍 CONSULTA E TRANSFERÊNCIA</h2>
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <input type="text" id="busca_serie" placeholder="BIPE OU DIGITE A PLAQUETA..." class="input-vidro" style="flex:1;">
                <button onclick="buscarDadosPatrimonio()" class="btn-vidro" style="background:#3b82f6;">PESQUISAR</button>
            </div>
            <div id="resultado-consulta"></div>
        </div>
    `;
}

async function buscarDadosPatrimonio() {
    const serie = document.getElementById('busca_serie').value;
    const res = await fetch(`${API_URL}/estoque/patrimonio/${serie}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (!res.ok) return alert("Item não localizado.");
    const item = await res.json();
    
    // Carrega locais e setores para a opção de transferência
    const [resLocais, resSetores] = await Promise.all([
        fetch(`${API_URL}/locais/lista-simples`, { headers: {'Authorization': `Bearer ${TOKEN}`} }),
        fetch(`${API_URL}/setores`, { headers: {'Authorization': `Bearer ${TOKEN}`} })
    ]);
    const locais = await resLocais.json();
    const setores = await resSetores.json();

    document.getElementById('resultado-consulta').innerHTML = `
        <div style="background:rgba(255,255,255,0.1); padding:20px; border-radius:8px; color:white;">
            <p><strong>Produto:</strong> ${item.produto_nome}</p>
            <p><strong>Local Atual:</strong> <span style="color:#fbbf24">${item.local_nome}</span></p>
            <p><strong>Setor:</strong> ${item.setor_nome || 'Não definido'}</p>
            <p><strong>Nota Fiscal:</strong> ${item.nf_numero || 'S/NF'}</p>
            
            <hr style="opacity:0.2; margin:20px 0;">
            <h4 style="color:#4ade80;">MUDAR LOCALIZAÇÃO:</h4>
            <select id="transf_local" class="input-vidro" style="width:100%; margin-bottom:10px;">
                ${locais.map(l => `<option value="${l.id}" ${l.id === item.local_id ? 'selected' : ''}>${l.nome}</option>`).join('')}
            </select>
            <select id="transf_setor" class="input-vidro" style="width:100%; margin-bottom:10px;">
                <option value="">-- SELECIONE O SETOR --</option>
                ${setores.map(s => `<option value="${s.id}" ${s.id === item.setor_id ? 'selected' : ''}>${s.nome}</option>`).join('')}
            </select>
            <input type="text" id="transf_obs" placeholder="Motivo da mudança..." class="input-vidro" style="width:100%; margin-bottom:15px;">
            <button onclick="executarTransferencia(${item.id}, ${item.produto_id})" class="btn-grande btn-vidro" style="background:#059669; width:100%;">CONFIRMAR TRANSFERÊNCIA</button>
            <button onclick="abrirModalBaixa(${item.id}, ${item.produto_id}, '${item.numero_serie}')" class="btn-grande btn-vidro" style="background:#991b1b; flex:1;">DAR BAIXA (INSERVÍVEL)</button>
        </div>
    `;
}

async function executarTransferencia(patrimonio_id, produto_id) {
    const payload = {
        patrimonio_id,
        produto_id,
        novo_local_id: document.getElementById('transf_local').value,
        novo_setor_id: document.getElementById('transf_setor').value,
        observacao: document.getElementById('transf_obs').value
    };

    const res = await fetch(`${API_URL}/estoque/transferir-patrimonio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("✅ Movimentação registada!");
        telaGerenciarPatrimonio();
    }
}

function abrirModalCadastro(tipoCadastro) {
    if (tipoCadastro !== 'produtos') return;

    const container = document.getElementById('app-content');
    const tituloTela = "📦 CADASTRO DE NOVO PRODUTO";

    container.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                <h2 style="color:#1e3a8a; margin:0;">${tituloTela}</h2>
                <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
            </div>

            <div style="background:white; max-width:600px; margin: 0 auto; padding:30px; border-radius:12px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
                <form id="formCadastroProduto" onsubmit="salvarNovoProduto(event)">
                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:5px;">NOME DO PRODUTO:</label>
                        <input type="text" id="prod_nome" required style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>

                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:5px;">TIPO DE ITEM:</label>
                        <select id="prod_tipo" required style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                            <option value="MATERIAL">MATERIAL (Consumo/Expediente)</option>
                            <option value="PATRIMÔNIO">PATRIMÔNIO (Item Permanente)</option>
                            <option value="UNIFORMES">UNIFORMES</option>
                        </select>
                    </div>

                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:5px;">CATEGORIA / GRUPO:</label>
                        <input type="text" id="prod_categoria" placeholder="Ex: Limpeza, Papelaria, Móveis..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-weight:bold; margin-bottom:5px;">DESCRIÇÃO ADICIONAL:</label>
                        <textarea id="prod_descricao" rows="3" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;"></textarea>
                    </div>

                    <button type="submit" style="width:100%; padding:15px; background:#1e40af; color:white; border:none; border-radius:6px; font-weight:bold; font-size:1rem; cursor:pointer;">
                        💾 SALVAR CADASTRO
                    </button>
                </form>
            </div>
        </div>
    `;
}

async function telaAdminCriarUsuario() {
    const container = document.getElementById('app-content');
    
    // 1. Busca os locais cadastrados
    const res = await fetch(`${API_URL}/locais/lista-simples`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const locais = await res.json();

    container.innerHTML = `
        <div style="padding:20px;">
            <h2>👤 CADASTRAR NOVO FUNCIONÁRIO</h2>
            <form id="form-criar-usuario" style="max-width:400px; background:white; padding:20px; border-radius:8px;">
                <label>NOME COMPLETO:</label>
                <input type="text" id="novo_nome" required style="width:100%; margin-bottom:15px; padding:10px;">

                <label>PERFIL DE ACESSO:</label>
                <select id="novo_perfil" required style="width:100%; margin-bottom:15px; padding:10px;">
                    <option value="escola">ESCOLA (Acesso Restrito)</option>
                    <option value="logistica">INFRA (Acesso Restrito)</option>
                    <option value="admin">ADMINISTRADOR</option>
                    <option value="estoque">ESTOQUE</option>
                    <option value="super">SUPER (Total)</option>
                </select>

                <label>VINCULAR A UM LOCAL (ESCOLA/SETOR):</label>
                <select id="novo_local_id" required style="width:100%; margin-bottom:15px; padding:10px;">
                    <option value="">-- SELECIONE O LOCAL --</option>
                    ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                </select>

                <button type="submit" style="width:100%; background:#10b981; color:white; padding:15px; border:none; border-radius:4px; font-weight:bold;">
                    SALVAR USUÁRIO
                </button>
            </form>
        </div>
    `;
}

async function salvarProduto() {
    const nome = document.getElementById('p_nome').value.trim();
    const categoria_id = document.getElementById('p_categoria').value;
    const tipo = document.getElementById('p_tipo').value;
    const alerta_minimo = parseInt(document.getElementById('p_alerta').value) || 0;

    if (!nome || !categoria_id) {
        return alert("Por favor, preencha o nome e selecione uma categoria.");
    }

    const payload = {
        nome: nome.toUpperCase(),
        categoria_id: parseInt(categoria_id),
        tipo: tipo,
        alerta_minimo: alerta_minimo,
        quantidade_estoque: 0 // Todo produto novo nasce com saldo zero
    };

    try {
        const res = await fetch(`${API_URL}/produtos`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Produto cadastrado com sucesso!");
            formProduto(); // Limpa/Reseta o formulário
        } else {
            const erro = await res.json();
            alert("❌ Erro ao salvar: " + erro.error);
        }
    } catch (err) {
        alert("Erro de comunicação com o servidor.");
    }
}

function gerarCamposPlaquetas() {
    const qtd = parseInt(document.getElementById('entrada_qtd').value);
    const container = document.getElementById('container-plaquetas');
    container.innerHTML = ''; // Limpa antes de gerar

    if (qtd > 0 && qtd <= 500) { // Limite de segurança
        for (let i = 1; i <= qtd; i++) {
            container.innerHTML += `
                <div style="margin-bottom: 10px;">
                    <label>Plaqueta/Série #${i}:</label>
                    <input type="text" class="input-plaqueta-item input-vidro" 
                           placeholder="Bipe ou digite a identificação..." required>
                </div>
            `;
        }
    }
}

async function telaAdminVerPedidos() {
    const app = document.getElementById('app-content');
    
    try {
        const res = await fetch(`${API_URL}/pedidos/lista-geral`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        app.innerHTML = `
            <div style="padding:20px;">
                <button onclick="carregarDashboard()" class="btn-voltar">⬅ VOLTAR</button>
                <h2 style="color:#1e3a8a; margin-bottom:20px;">📋 GESTÃO DE PEDIDOS (ADMIN)</h2>
                
                <table style="width:100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background: #1e40af; color: white; text-align: left;">
                            <th style="padding: 12px;">ID</th>
                            <th style="padding: 12px;">DATA</th>
                            <th style="padding: 12px;">SOLICITANTE</th>
                            <th style="padding: 12px;">DESTINO (ESCOLA)</th>
                            <th style="padding: 12px;">TIPO</th>
                            <th style="padding: 12px;">STATUS</th>
                            <th style="padding: 12px;">AÇÃO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedidos.map(p => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px;">#${p.id}</td>
                                <td style="padding: 12px;">${new Date(p.data_criacao).toLocaleDateString('pt-BR')}</td>
                                <td style="padding: 12px;">${p.solicitante}</td>
                                <td style="padding: 12px; font-weight: bold; color: #1e40af;">📍 ${p.escola_destino || 'NÃO DEFINIDO'}</td>
                                <td style="padding: 12px;">${p.tipo_pedido}</td>
                                <td style="padding: 12px;">
                                    <span class="status-badge ${p.status.toLowerCase()}">${p.status}</span>
                                </td>
                                <td style="padding: 12px;">
                                    <button onclick="verDetalhesPedido(${p.id})" style="padding: 5px 10px; cursor: pointer;">👁️ VER</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar a lista de pedidos.");
    }
}

async function telaEstoquePedidosPendentes() {
    const app = document.getElementById('app-content');
    app.style.background = "#f8fafc"; // Cor clara para leitura
    
    try {
        const res = await fetch(`${API_URL}/pedidos/estoque/pendentes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        app.innerHTML = `
            <div style="padding:30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="color:#1e3a8a; margin:0;">📦 PEDIDOS PARA SEPARAÇÃO</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">⬅️ VOLTAR</button>
                </div>

                <div style="display:grid; gap:15px;">
                    ${pedidos.length === 0 ? 
                        '<p style="color:#64748b; text-align:center; padding:20px;">Nenhum pedido aguardando separação no momento.</p>' : 
                        pedidos.map(p => {
                            // Lógica de Cores e Labels baseada no Status Real
                            let corStatus = '#10b981'; // Verde padrão (Aprovado)
                            let labelBotao = '▶️ INICIAR SEPARAÇÃO';

                            if (p.status === 'EM_SEPARACAO') {
                                corStatus = '#f59e0b'; // Laranja (Parcial)
                                labelBotao = '🔄 COMPLETAR REMESSA';
                            } else if (p.status === 'AGUARDANDO_SEPARACAO' || p.status === 'SEPARACAO_INICIADA') {
                                corStatus = '#3b82f6'; // Azul (Iniciado ou aguardando)
                                labelBotao = '📦 CONTINUAR SEPARAÇÃO';
                            }

                            return `
                                <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.1); border-left:10px solid ${corStatus}; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-size:1.1rem; font-weight:bold; color:#1e293b; margin-bottom:5px;">
                                            📍 ${p.escola_nome || 'Local Não Identificado'}
                                        </div>
                                        <div style="color:#64748b; font-size:0.9rem;">
                                            Pedido <strong>#${p.id}</strong> | Status: 
                                            <span style="color:${corStatus}; font-weight:bold;">${p.status.replace(/_/g, ' ')}</span>
                                        </div>
                                    </div>
                                    <button onclick="iniciarProcessoSeparacao(${p.id})" style="background:${corStatus}; color:white; border:none; padding:12px 25px; border-radius:6px; cursor:pointer; font-weight:bold; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                                        ${labelBotao}
                                    </button>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        alert("Erro ao carregar pedidos para o estoque.");
    }
}

async function imprimirRomaneio(remessaId) {
    try {
        const res = await fetch(`${API_URL}/pedidos/remessa/${remessaId}/detalhes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const dados = await res.json();
        
        const info = dados[0];
        const dataFormatada = new Date(info.data_criacao).toLocaleString();

        const janelaImpressao = window.open('', '_blank');
        janelaImpressao.document.write(`
            <html>
            <head>
                <title>Romaneio #${remessaId}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .assinatura { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                    .campo-assinatura { border-top: 1px solid #000; text-align: center; padding-top: 5px; margin-top: 40px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ROMANEIO DE ENTREGA #${remessaId}</h1>
                    <p>Referente ao Pedido #${info.pedido_id}</p>
                </div>
                
                <div class="info-grid">
                    <div>
                        <strong>DESTINO:</strong> ${info.escola_nome}<br>
                        <strong>ENDEREÇO:</strong> ${info.escola_endereco || 'Não informado'}
                    </div>
                    <div style="text-align: right;">
                        <strong>DATA/HORA:</strong> ${dataFormatada}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>PRODUTO</th>
                            <th>TAMANHO</th>
                            <th>QUANTIDADE ENVIADA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(item => `
                            <tr>
                                <td>${item.produto_nome}</td>
                                <td>${item.tamanho}</td>
                                <td>${item.quantidade_enviada}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="assinatura">
                    <div class="campo-assinatura">Responsável pela Saída (Estoque)</div>
                    <div class="campo-assinatura">Recebido por (Escola)</div>
                </div>

                <script>
                    window.onload = function() { window.print(); window.close(); };
                </script>
            </body>
            </html>
        `);
        janelaImpressao.document.close();
    } catch (err) {
        alert("Erro ao gerar romaneio.");
    }
}

async function telaAdminDashboard() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="text-align:center; padding:50px;">🔄 Sincronizando fluxo logístico...</div>';

    try {
        const res = await fetch(`${API_URL}/admin/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const s = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <h2 style="text-align:center; color:#1e3a8a; margin-bottom:30px;">🔄 CICLO DE ATENDIMENTO SEMED</h2>
                
                <div class="fluxo-container">
                    ${renderCirculo('SOLICITADO', s.qtd_solicitado, '📩', '#ef4444')}
                    ${renderCirculo('AUTORIZADO', s.qtd_autorizado, '⚖️', '#f59e0b')}
                    ${renderCirculo('EM SEPARAÇÃO', s.qtd_separacao, '📦', '#8b5cf6')}
                    ${renderCirculo('PRONTO', s.qtd_pronto, '✅', '#3b82f6')}
                    ${renderCirculo('EM_TRANSPORTE', s.qtd_transporte, '🚚', '#06b6d4')}
                    ${renderCirculo('ENTREGUE', s.qtd_entregue, '🏠', '#10b981')}
                </div>

                <div id="detalhes-dashboard" style="margin-top:40px; background:white; border-radius:15px; padding:25px; box-shadow:0 10px 25px rgba(0,0,0,0.05); min-height:300px;">
                    <h3 id="titulo-fase" style="color:#1e3a8a; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">📊 Detalhes da Operação</h3>
                    <div id="lista-fase-conteudo" style="margin-top:15px;">
                        <p style="text-align:center; color:#94a3b8;">Clique em uma fase do círculo para investigar os pedidos.</p>
                    </div>
                </div>
            </div>
        `;
    } catch (err) { console.error(err); }
}

function renderCirculo(fase, qtd, icone, cor) {
    return `
        <div class="fase-card" style="border-color: ${qtd > 0 ? cor : '#e2e8f0'}" onclick="verDetalhesFase('${fase}')">
            <span class="icone">${icone}</span>
            <span class="qtd" style="color:${cor}">${qtd}</span>
            <span class="label">${fase}</span>
        </div>
    `;
}

function renderCard(fase, qtd, cor, icone) {
    return `
        <div class="card-estatistica" 
             onclick="detalharFase('${fase}')"
             style="background:white; border-top:5px solid ${cor}; padding:20px; border-radius:8px; shadow:0 2px 4px rgba(0,0,0,0.05); cursor:pointer; text-align:center; transition: transform 0.2s;">
            <div style="font-size:1.5rem;">${icone}</div>
            <div style="font-size:2rem; font-weight:bold; color:#1e293b;">${qtd}</div>
            <div style="font-size:0.8rem; color:#64748b; font-weight:bold;">${fase}</div>
        </div>
    `;
}

window.verDetalhesFase = async function(fase) {
    const listaArea = document.getElementById('lista-fase-conteudo');
    const titulo = document.getElementById('titulo-fase');
    titulo.innerText = `📋 LISTAGEM: ${fase}`;
    listaArea.innerHTML = '🔍 Carregando dados...';

    const res = await fetch(`${API_URL}/admin/dashboard/detalhes/${fase}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const dados = await res.json();

    if (dados.length === 0) {
        listaArea.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum registro nesta fase.</p>';
        return;
    }

    listaArea.innerHTML = `
        <table style="width:100%; border-collapse:collapse;">
            <tr style="text-align:left; background:#f8fafc; color:#64748b; font-size:0.8rem;">
                <th style="padding:12px;">ID</th>
                <th style="padding:12px;">UNIDADE ESCOLAR</th>
                <th style="padding:12px;">AÇÃO</th>
            </tr>
            ${dados.map(d => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:bold;">#${d.id}</td>
                    <td style="padding:12px;">${d.escola}</td>
                    <td style="padding:12px;">
                        <button class="btn-investigar" data-id="${d.id}" style="background:#3b82f6; color:white; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">🔍 Itens</button>
                    </td>
                </tr>
            `).join('')}
        </table>
        <div id="box-produtos" style="margin-top:20px;"></div>
    `;
};

async function telaLogisticaEntregas() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">🚚 Buscando remessas prontas para saída...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/logistica/remessas-pendentes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (!res.ok) throw new Error("Falha ao carregar remessas.");
        
        const remessas = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#1e3a8a;">🚛 COLETA DE REMESSAS (SAÍDA)</h2>
                    <button onclick="carregarDashboard()" style="background:#64748b; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer;">⬅️ VOLTAR</button>
                </div>

                <div style="display:grid; gap:15px;">
                    ${remessas.length === 0 ? `
                        <div style="background:#f1f5f9; padding:40px; text-align:center; border-radius:10px; color:#64748b;">
                            Nenhuma remessa aguardando coleta no momento.
                        </div>` : 
                        remessas.map(r => `
                        <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.1); border-left:8px solid #8b5cf6;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight:bold; font-size:1.1rem; color:#1e293b;">${r.escola_nome}</div>
                                    <div style="color:#64748b; font-size:0.9rem;">
                                        Remessa: <strong>#${r.remessa_id}</strong> (Pedido #${r.pedido_id})
                                    </div>
                                    <div style="margin-top:5px; font-size:0.8rem; color:#94a3b8;">
                                        Pronta desde: ${new Date(r.data_remessa).toLocaleString('pt-BR')}
                                    </div>
                                </div>
                                
                                <button class="btn-coletar-remessa" 
                                        data-remessa-id="${r.remessa_id}" 
                                        style="background:#1e40af; color:white; border:none; padding:12px 25px; border-radius:6px; cursor:pointer; font-weight:bold; transition: background 0.3s;">
                                    🚚 COLETAR REMESSA
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="padding:20px; color:red;">Erro ao carregar logística: ${err.message}</div>`;
    }
}

window.detalharFase = async function(fase) {
    const area = document.getElementById('detalhes-fase');
    area.innerHTML = '🔍 Buscando listagem...';

    const res = await fetch(`${API_URL}/admin/pedidos-por-fase?status=${fase}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const lista = await res.json();

    area.innerHTML = `
        <h3 style="color:#1e3a8a; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">Lista: ${fase}</h3>
        <table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="text-align:left; color:#64748b; font-size:0.85rem;">
                    <th style="padding:10px;">ID</th>
                    <th style="padding:10px;">ESCOLA</th>
                    <th style="padding:10px;">DATA</th>
                    <th style="padding:10px;">AÇÃO</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(p => `
                    <tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:10px; font-weight:bold;">#${p.id}</td>
                        <td style="padding:10px;">${p.escola_nome}</td>
                        <td style="padding:10px; font-size:0.8rem;">${new Date(p.data_criacao).toLocaleDateString()}</td>
                        <td style="padding:10px;">
                            <button onclick="verItensPedido(${p.id})" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; padding:5px 10px;">👁️ Ver Itens</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};

window.verItensPedido = async function(pedidoId) {
    // Aqui você chama a rota que já criamos de detalhes e mostra em um modal ou abaixo da linha
    const res = await fetch(`${API_URL}/pedidos/${pedidoId}/detalhes`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const itens = await res.json();
    
    let htmlItens = `<div style="background:#f8fafc; padding:15px; border-radius:8px; margin-top:10px; border-left:4px solid #3b82f6;">
        <h4 style="margin:0 0 10px 0;">Produtos do Pedido #${pedidoId}:</h4>`;
    
    itens.forEach(i => {
        htmlItens += `<div style="display:flex; justify-content:space-between; font-size:0.9rem; padding:4px 0; border-bottom:1px dashed #e2e8f0;">
            <span>${i.produto_nome} (${i.tamanho})</span>
            <strong>Qtd: ${i.quantidade}</strong>
        </div>`;
    });
    htmlItens += `</div>`;
    
    alert("Dados carregados com sucesso! (Você pode substituir este alert por um Modal flutuante)");
    // Para um efeito visual melhor, você pode injetar este htmlItens dentro de uma div modal
};

// Garante que a função seja global antes de qualquer coisa
async function telaLogisticaColeta() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px;">🚚 Buscando pedidos prontos para coleta...</div>';

    try {
        const res = await fetch(`${API_URL}/pedidos/logistica/prontos`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const pedidos = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <h2 style="color:#1e3a8a;">🚛 PEDIDOS LIBERADOS PARA COLETA</h2>
                <div style="display:grid; gap:15px;">
                    ${pedidos.length === 0 ? '<p>Nenhum pedido aguardando coleta no momento.</p>' : 
                        pedidos.map(p => `
                        <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.1); border-left:8px solid #8b5cf6;">
                            <div style="font-weight:bold; font-size:1.1rem;">${p.escola_nome}</div>
                            <div style="color:#64748b;">Pedido #${p.id} | Volumes: <strong>${p.volumes}</strong></div>
                            <div style="margin-top:10px;">
                                <button onclick="iniciarTransporte(${p.id})" style="background:#1e40af; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">
                                    🚚 REGISTRAR COLETA / SAÍDA
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar pedidos da logística.");
    }
}

window.iniciarTransporteRemessa = async function(remessaId) {
    console.log("Botão clicado para remessa:", remessaId);

    if (!confirm(`Deseja iniciar o transporte da remessa #${remessaId}?`)) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/remessa/${remessaId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ novoStatus: 'EM_TRANSPORTE' })
        });

        if (res.ok) {
            alert("🚚 Transporte iniciado!");
            // IMPORTANTE: Chama a função que desenha a tela de logística novamente
            // Isso fará a remessa sumir da lista (pois o status mudou)
            if (typeof telaLogisticaEntrega === 'function') {
                telaLogisticaEntrega(); 
            }
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) {
        console.error(err);
        alert("Falha ao conectar com o servidor.");
    }
};

async function telaEscolaConfirmarRecebimento() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; text-align:center;">🔍 Localizando mercadorias em trânsito...</div>';

    try {
        const res = await fetch(`${API_URL}/escola/remessas-a-caminho`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (!res.ok) {
            const erro = await res.json();
            throw new Error(erro.error || "Erro ao buscar dados.");
        }

        const dados = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <h2 style="color:#1e3a8a; margin-bottom:20px;">🚚 RECEBIMENTO DE MERCADORIA</h2>
                <div style="display:grid; gap:15px;">
                    ${dados.length === 0 ? `
                        <div style="background:#f8fafc; padding:40px; text-align:center; border-radius:10px; color:#64748b; border:1px dashed #cbd5e1;">
                            Nenhuma remessa vindo para sua unidade no momento.
                        </div>` : 
                        dados.map(r => `
                        <div style="background:#fffbeb; padding:20px; border-radius:10px; border-left:10px solid #f59e0b; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight:bold; font-size:1.1rem; color:#92400e;">📦 CARGA A CAMINHO</div>
                                    <div style="color:#b45309; margin-top:5px;">
                                        Remessa: <strong>#${r.remessa_id}</strong> | Pedido: #${r.pedido_id}
                                    </div>
                                    <div style="font-size:0.8rem; color:#d97706; margin-top:5px;">
                                        Escola: ${r.escola_nome}
                                    </div>
                                </div>
                                <button class="btn-confirmar-entrega" data-remessa-id="${r.remessa_id}" 
                                        style="background:#059669; color:white; border:none; padding:12px 25px; border-radius:6px; cursor:pointer; font-weight:bold;">
                                    ✅ CONFIRMAR CHEGADA
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `
            <div style="padding:20px; color:#ef4444; background:#fef2f2; border:1px solid #fee2e2; border-radius:8px;">
                <strong>⚠️ Falha:</strong> ${err.message}
            </div>`;
    }
}

async function confirmarRecebimentoRemessa(remessaId, pedidoId) {
    if (!confirm("Você confirma que conferiu e recebeu todos os itens desta remessa?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/escola/confirmar-recebimento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ remessaId, pedidoId })
        });

        if (res.ok) {
            alert("✨ Recebimento registrado! O estoque da escola foi atualizado.");
            telaEscolaConfirmarRecebimento(); // Atualiza a lista
        }
    } catch (err) { alert("Erro ao processar recebimento."); }
}

async function confirmarEntregaFinal(pedidoId) {
    if(!confirm("Confirma que todos os itens deste pedido foram recebidos na unidade?")) return;
    
    const res = await fetch(`${API_URL}/pedidos/escola/confirmar-recebimento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ pedidoId })
    });

    if(res.ok) {
        alert("🎉 Excelente! O ciclo do pedido foi concluído.");
        telaEscolaConfirmarRecebimento();
    }
}

async function processarDocumentoRomaneio(remessaId, acao = 'imprimir') {
    // 1. Busca os dados (usando a rota que já criamos)
    const res = await fetch(`${API_URL}/pedidos/remessa/${remessaId}/detalhes`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const dados = await res.json();
    const info = dados[0];

    // 2. Criamos um elemento temporário com o layout do romaneio
    const elemento = document.createElement('div');
    elemento.innerHTML = `
        <div style="padding:40px; font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align:center; color:#1e3a8a;">ROMANEIO DE ENTREGA #${remessaId}</h1>
            <p style="text-align:center;">Pedido #${info.pedido_id} | Emissão: ${new Date().toLocaleString()}</p>
            <hr>
            <p><strong>DESTINO:</strong> ${info.escola_nome}</p>
            <p><strong>ENDEREÇO:</strong> ${info.escola_endereco || 'Não informado'}</p>
            <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                <thead>
                    <tr style="background:#f2f2f2;">
                        <th style="border:1px solid #ddd; padding:8px;">PRODUTO</th>
                        <th style="border:1px solid #ddd; padding:8px;">TAM.</th>
                        <th style="border:1px solid #ddd; padding:8px;">QTD</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.map(i => `<tr><td style="border:1px solid #ddd; padding:8px;">${i.produto_nome}</td><td style="border:1px solid #ddd; padding:8px;">${i.tamanho}</td><td style="border:1px solid #ddd; padding:8px;">${i.quantidade_enviada}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;

    const opt = {
        margin: 10,
        filename: `romaneio_${remessaId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (acao === 'imprimir') {
        html2pdf().set(opt).from(elemento).save();
    } else if (acao === 'compartilhar') {
        // Gera o PDF como um Blob para compartilhar
        const pdfBlob = await html2pdf().set(opt).from(elemento).output('blob');
        const arquivo = new File([pdfBlob], `romaneio_${remessaId}.pdf`, { type: 'application/pdf' });

        if (navigator.share) {
            try {
                await navigator.share({
                    files: [arquivo],
                    title: `Romaneio #${remessaId}`,
                    text: `Segue o romaneio da entrega para a escola ${info.escola_nome}`
                });
            } catch (err) { console.log("Compartilhamento cancelado."); }
        } else {
            alert("Seu navegador não suporta compartilhamento de arquivos. O PDF será baixado.");
            html2pdf().set(opt).from(elemento).save();
        }
    }
}

async function gerarECompartilharRomaneio(remessaId) {
    try {
        // 1. Busca os dados no servidor
        const res = await fetch(`${API_URL}/pedidos/remessa/${remessaId}/detalhes`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (!res.ok) {
            const erroServidor = await res.json();
            throw new Error(erroServidor.error || "Erro ao buscar dados no servidor.");
        }

        const dados = await res.json();
        
        if (!dados || dados.length === 0) {
            throw new Error("Nenhum item encontrado para esta remessa.");
        }

        const info = dados[0];

        // 2. Cria a estrutura visual do romaneio (HTML)
        const elemento = document.createElement('div');
        elemento.innerHTML = `
            <div style="padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #fff;">
                <div style="text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #1e40af;">ROMANEIO DE SAÍDA</h2>
                    <p style="margin: 5px 0; font-size: 1.2rem; font-weight: bold;">Remessa #${remessaId}</p>
                </div>

                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Escola:</strong> ${info.escola_nome}</p>
                    <p style="margin: 5px 0;"><strong>Pedido Origem:</strong> #${info.pedido_id}</p>
                    <p style="margin: 5px 0;"><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #1e40af; color: white;">
                            <th style="padding: 12px; text-align: left; border: 1px solid #1e40af;">PRODUTO</th>
                            <th style="padding: 12px; text-align: center; border: 1px solid #1e40af;">TAM.</th>
                            <th style="padding: 12px; text-align: center; border: 1px solid #1e40af;">QTD</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(i => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 12px; font-weight: 500;">${i.produto_nome}</td>
                                <td style="padding: 12px; text-align: center;">${i.tamanho}</td>
                                <td style="padding: 12px; text-align: center; font-weight: bold;">${i.quantidade_enviada}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="text-align: center; color: #64748b; font-size: 0.8rem; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
                    <p>Documento Logístico Digital - Verificado via Sistema Central SEMED</p>
                </div>
            </div>
        `;

        // 3. Configurações do PDF
        const opt = {
            margin: 10,
            filename: `romaneio_${remessaId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 4. Gera o PDF como Blob
        const pdfBlob = await html2pdf().set(opt).from(elemento).output('blob');
        const file = new File([pdfBlob], `Romaneio_${remessaId}.pdf`, { type: 'application/pdf' });

        // 5. Lógica de Compartilhamento / Download (À prova de erros de gesto)
        try {
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Romaneio #${remessaId} - ${info.escola_nome}`,
                    text: `Segue romaneio digital da remessa #${remessaId} para a escola ${info.escola_nome}.`
                });
            } else {
                throw new Error("API de compartilhamento não suportada neste navegador.");
            }
        } catch (shareErr) {
            // Se o erro for de segurança (User Gesture) ou indisponibilidade, faz o download
            console.warn("Redirecionando para download direto:", shareErr.message);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(pdfBlob);
            link.download = `Romaneio_${remessaId}.pdf`;
            link.click();
            
            if (shareErr.name === 'NotAllowedError') {
                alert("O navegador bloqueou o compartilhamento direto. O romaneio foi baixado na sua pasta de Downloads.");
            } else {
                alert("Compartilhamento indisponível. O PDF foi baixado automaticamente.");
            }
        }

    } catch (err) {
        console.error("Erro crítico ao processar romaneio:", err);
        alert(`Falha ao gerar documento: ${err.message}`);
    }
}

async function carregarAlertasEscola() {
    // Busca remessas destinadas a esta escola que estão 'EM_TRANSPORTE'
    const res = await fetch(`${API_URL}/pedidos/escola/remessas-a-caminho`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const remessas = await res.json();

    const areaAlerta = document.getElementById('alertas-transporte');
    if (remessas.length > 0) {
        areaAlerta.innerHTML = remessas.map(r => `
            <div class="alerta-viagem" style="background: #fef3c7; border-left: 5px solid #d97706; padding: 15px; margin-bottom: 10px;">
                <p><strong>🚚 MERCADORIA A CAMINHO!</strong></p>
                <p>Remessa #${r.id} saiu do estoque e está em transporte.</p>
                <button onclick="confirmarRecebimento(${r.id})">Confirmar Recebimento</button>
            </div>
        `).join('');
    }
}

window.confirmarRecebimento = async function(remessaId) {
    if (!confirm(`Confirma que todos os itens da Remessa #${remessaId} foram entregues na unidade?`)) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/remessa/${remessaId}/confirmar-recebimento`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}` 
            }
        });

        if (res.ok) {
            alert("Sucesso! O recebimento foi registado no sistema.");
            // Recarrega os alertas para o card amarelo desaparecer
            if (typeof carregarAlertasEscola === 'function') carregarAlertasEscola();
            // Se tiver uma função de histórico na tela da escola, recarrega-a também
            if (typeof carregarHistoricoEscola === 'function') carregarHistoricoEscola();
        } else {
            const erro = await res.json();
            throw new Error(erro.error);
        }
    } catch (err) {
        console.error("Erro ao confirmar:", err);
        alert("Falha ao confirmar recebimento: " + err.message);
    }
};

document.addEventListener('click', async (event) => {
    // 1. Detecta qual botão foi clicado (usando closest para ignorar ícones/emojis internos)
    const btnColetar = event.target.closest('.btn-coletar-remessa');
    const btnConfirmar = event.target.closest('.btn-confirmar-entrega');
    const btnVerItens = event.target.closest('.btn-ver-itens-admin');

    // --- LOGICA DA LOGÍSTICA ---
    if (btnColetar) {
        const id = btnColetar.getAttribute('data-remessa-id');
        if (!confirm(`Confirmar o início do transporte para a Remessa #${id}?`)) return;

        try {
            const res = await fetch(`${API_URL}/logistica/iniciar-transporte/${id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                alert("🚚 Transporte iniciado!");
                telaLogisticaEntregas(); 
            }
        } catch (err) { alert("Erro na conexão."); }
    }

    // --- LOGICA DA ESCOLA ---
    else if (btnConfirmar) {
        const id = btnConfirmar.getAttribute('data-remessa-id');
        if (!confirm(`Confirma que a Remessa #${id} chegou na escola?`)) return;

        try {
            const res = await fetch(`${API_URL}/escola/confirmar-recebimento/${id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            if (res.ok) {
                alert("✅ Recebimento registrado!");
                telaEscolaConfirmarRecebimento(); 
            }
        } catch (err) { alert("Erro ao confirmar."); }
    }

    // --- LOGICA DO DASHBOARD ADMIN (SURPRESA) ---
    else if (btnVerItens) {
        const pedidoId = btnVerItens.getAttribute('data-pedido-id');
        investigarPedido(pedidoId); // Aquela função que mostra os produtos
    }
});

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-investigar');
    if (!btn) return;

    const id = btn.dataset.id;
    const box = document.getElementById('box-produtos');
    box.innerHTML = '📦 Buscando produtos...';

    const res = await fetch(`${API_URL}/pedidos/${id}/itens`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const itens = await res.json();

    box.innerHTML = `
        <div style="background:#eff6ff; border:2px solid #dbeafe; padding:15px; border-radius:10px;">
            <h4 style="margin:0 0 10px 0; color:#1e40af;">Produtos do Registro #${id}</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-weight:bold; font-size:0.8rem; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">
                <span>PRODUTO</span><span>TAMANHO</span><span>QUANTIDADE</span>
            </div>
            ${itens.map(i => `
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.85rem; padding:8px 0; border-bottom:1px solid #dbeafe;">
                    <span>${i.produto_nome}</span>
                    <span>${i.tamanho}</span>
                    <span style="font-weight:bold;">${i.quantidade}</span>
                </div>
            `).join('')}
        </div>
    `;
    // Rola a tela suavemente para os produtos
    box.scrollIntoView({ behavior: 'smooth' });
});

async function telaSolicitarServicoImpressora(tipoServico) {
    const container = document.getElementById('app-content');
    
    // 1. Tenta buscar o ID do navegador
    let localId = localStorage.getItem('local_id');

    // 2. Se o ID for inválido (undefined ou null), tenta atualizar a sessão antes de desistir
    if (!localId || localId === "undefined" || localId === "null") {
        await inicializarSessaoUsuario();
        localId = localStorage.getItem('local_id');
    }

    const titulo = tipoServico === 'recarga' ? 'SOLICITAR RECARGA' : 'SOLICITAR MANUTENÇÃO';

    // Monta a estrutura da tela
    container.innerHTML = `
        <div class="painel-vidro">
            <h2 style="color: white; margin-bottom: 20px;">${titulo}</h2>
            <div id="lista-imp" class="grid-menu-principal">
                <div style="color: white; grid-column: 1/-1;">🔍 Localizando impressoras para sua unidade...</div>
            </div>
            <button onclick="carregarDashboard()" class="btn-sair-vidro" style="margin-top: 30px; background: #475569; width: 200px;">
                ⬅️ VOLTAR
            </button>
        </div>
    `;

    try {
        // Se após a tentativa de atualização o ID continuar vindo "undefined", paramos aqui
        if (!localId || localId === "undefined") {
            throw new Error("Não foi possível identificar sua unidade escolar. Por favor, saia do sistema e entre novamente.");
        }

        const res = await fetch(`${API_URL}/impressoras/local/${localId}`, { 
            headers: {'Authorization': `Bearer ${localStorage.getItem('token')}`} 
        });

        const dados = await res.json();
        const area = document.getElementById('lista-imp');

        if (!res.ok) throw new Error(dados.error || "Erro ao consultar impressoras.");

        if (dados.length === 0) {
            area.innerHTML = `<p style="color: #fca5a5; grid-column: 1/-1;">Nenhuma impressora encontrada para o local ${localId}.</p>`;
            return;
        }

        area.innerHTML = dados.map(imp => {
            const img = imp.modelo === 'mono' ? 'mono.png' : 'color.png';
            return `
                <button class="btn-grande btn-vidro" onclick="abrirChamadoFinal(${imp.id}, '${tipoServico}')">
                    <img src="${img}" style="width:80px; margin-bottom:10px;">
                    <span style="color: #fbbf24;">${imp.modelo.toUpperCase()}</span>
                </button>
            `;
        }).join('');

    } catch (err) {
        document.getElementById('lista-imp').innerHTML = `
            <div style="color: #fca5a5; grid-column: 1/-1;">
                ⚠️ ${err.message}
            </div>`;
    }
}

function telaDashboardImpressoras() {
    const area = document.getElementById('app-content');
    const hoje = new Date().toISOString().split('T')[0];
    const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    area.innerHTML = `
        <div class="painel-vidro" style="max-width: 1300px; margin: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#475569; margin:0; width:100px; font-size:0.8rem;">⬅️ VOLTAR</button>
                <h2 style="color:white; margin:0; font-size:1.3rem;">📊 GESTÃO TÉCNICA DE ATENDIMENTOS</h2>
                <button onclick="telaComparativoLocais()" class="btn-vidro btn-breve" style="background:#0ea5e9; font-size:0.75rem; padding:0 15px; height:38px; margin:0;">⚖️ COMPARATIVO</button>
            </div>
            
            <div style="display:flex; gap:10px; justify-content:center; align-items:center; margin-bottom:25px; background:rgba(255,255,255,0.05); padding:10px; border-radius:10px;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <label style="color:white; font-size:0.7rem;">DE:</label>
                    <input type="date" id="dash_data_inicio" value="${primeiroDia}" class="input-vidro" style="width:125px; font-size:0.8rem; height:32px; padding:0 5px;">
                    <label style="color:white; font-size:0.7rem;">ATÉ:</label>
                    <input type="date" id="dash_data_fim" value="${hoje}" class="input-vidro" style="width:125px; font-size:0.8rem; height:32px; padding:0 5px;">
                    <button onclick="atualizarStatsImpressoras()" class="btn-vidro" style="background:#3b82f6; font-size:0.7rem; width:80px; height:32px; margin:0;">🔍 FILTRAR</button>
                </div>
            </div>

            <div id="container-lista-atendimentos" style="max-height:500px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:8px;">
                <table style="width:100%; border-collapse: collapse; color:white; font-size:0.75rem;">
                    <thead style="background:rgba(0,0,0,0.5); position:sticky; top:0; z-index:10;">
                        <tr>
                            <th style="padding:10px; text-align:left;">ABERTURA</th>
                            <th style="padding:10px; text-align:center;">SLA UTIL</th>
                            <th style="padding:10px; text-align:left;">ATENDIMENTO</th>
                            <th style="padding:10px; text-align:left;">UNIDADE</th>
                            <th style="padding:10px; text-align:left;">MODELO</th>
                            <th style="padding:10px; text-align:left;">TÉCNICO</th>
                            <th style="padding:10px; text-align:center;">CONTADOR</th>
                            <th style="padding:10px; text-align:left;">OBSERVAÇÕES</th>
                        </tr>
                    </thead>
                    <tbody id="corpo-tabela-atendimentos"></tbody>
                </table>
            </div>
        </div>
    `;
    atualizarStatsImpressoras();
}

async function atualizarStatsImpressoras() {
    const inicio = document.getElementById('dash_data_inicio').value;
    const fim = document.getElementById('dash_data_fim').value;

    try {
        const res = await fetch(`${API_URL}/impressoras/dashboard-stats?inicio=${inicio}&fim=${fim}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const corpo = document.getElementById('corpo-tabela-atendimentos');

        if (!data.atendimentos || data.atendimentos.length === 0) {
            corpo.innerHTML = `<tr><td colspan="8" style="padding:20px; text-align:center; color:#94a3b8;">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        corpo.innerHTML = data.atendimentos.map(at => {
            const dataAbertura = new Date(at.data_abertura).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'});
            const dataFechamento = new Date(at.data_fechamento).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'});
            
            // Obtém o objeto com o texto formatado e a cor do alerta
            const sla = calcularSLAUtil(at.data_abertura, at.data_fechamento);

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:10px;">${dataAbertura}</td>
                    <td style="padding:10px; text-align:center; color:${sla.cor}; font-weight:bold; text-shadow: 0 0 10px ${sla.cor}44;">
                        ${sla.texto}
                    </td>
                    <td style="padding:10px;">${dataFechamento}</td>
                    <td style="padding:10px; color:#fbbf24; font-weight:bold;">${at.unidade}</td>
                    <td style="padding:10px;">${at.modelo.toUpperCase()}</td>
                    <td style="padding:10px;">${at.tecnico || '---'}</td>
                    <td style="padding:10px; text-align:center;">${at.contador || 0}</td>
                    <td style="padding:10px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:help; color:#cbd5e1;" title="${at.obs}">
                        ${at.obs || '-'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Erro ao atualizar dashboard:", err);
    }
}

async function compartilharStatusImpressoras() {
    const inicio = document.getElementById('dash_data_inicio').value;
    const fim = document.getElementById('dash_data_fim').value;
    
    // Captura os valores que já estão nos cards
    const recargas = document.getElementById('kpi-recargas').innerText;
    const abertos = document.getElementById('kpi-abertos').innerText;
    const tempo = document.getElementById('kpi-tempo').innerText;

    const areaOculta = document.getElementById('area-pdf-oculta');
    
    // Monta o layout do PDF
    areaOculta.innerHTML = `
        <div style="text-align:center; border-bottom:2px solid #1e40af; padding-bottom:10px; margin-bottom:20px;">
            <h2 style="margin:0; color:#1e40af;">SEMED - GESTÃO DE IMPRESSORAS</h2>
            <p style="margin:5px 0; font-weight:bold;">Relatório de Desempenho Técnico</p>
            <p style="font-size:0.8rem; color:#666;">Período: ${inicio.split('-').reverse().join('/')} até ${fim.split('-').reverse().join('/')}</p>
        </div>
        
        <div style="margin-bottom:20px;">
            <p><strong>🔹 Recargas Realizadas:</strong> ${recargas}</p>
            <p><strong>🔹 Chamados em Aberto:</strong> ${abertos}</p>
            <p><strong>🔹 Tempo Médio de Atendimento:</strong> ${tempo}</p>
        </div>
        
        <div style="font-size:0.7rem; color:#999; margin-top:30px; border-top:1px solid #eee; padding-top:10px;">
            Relatório gerado automaticamente pelo Sistema de Logística em ${new Date().toLocaleString()}
        </div>
    `;

    // 1. Gera o PDF como um Blob
    const opt = {
        margin: 10,
        filename: 'Resumo_Impressoras.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().set(opt).from(areaOculta).output('blob');
        const arquivo = new File([pdfBlob], "Resumo_Atendimento_Impressoras.pdf", { type: 'application/pdf' });

        // 2. Aciona o compartilhamento nativo
        if (navigator.share) {
            await navigator.share({
                title: 'Relatório SEMED - Impressoras',
                text: `Resumo de atendimentos e recargas (${inicio} a ${fim})`,
                files: [arquivo]
            });
        } else {
            // Fallback: Se o navegador não suportar share (ex: PCs antigos), apenas baixa o PDF
            html2pdf().set(opt).from(areaOculta).save();
            alert("Compartilhamento nativo não suportado. O PDF foi baixado.");
        }
    } catch (err) {
        console.error("Erro ao compartilhar:", err);
    }
}

async function abrirChamadoFinal(impressoraId, tipoServico) {
    const container = document.getElementById('app-content');

    // Se for Recarga, o processo é simplificado
    if (tipoServico === 'recarga') {
        if (!confirm("Confirmar solicitação de recarga de toner para esta impressora?")) return;
        enviarChamadoAoServidor({ impressora_id: impressoraId, tipo: 'recarga' });
        return;
    }

    // Se for Manutenção, montamos o formulário de diagnóstico
    container.innerHTML = `
        <div class="painel-vidro" style="max-width: 500px; margin: 0 auto; text-align: left;">
            <h2 style="color: white; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
                🛠️ DETALHES DA MANUTENÇÃO
            </h2>
            
            <div style="margin-top: 20px;">
                <label style="color: white; display: block; margin-bottom: 8px;">O que está acontecendo?</label>
                <select id="motivo-manutencao" class="input-vidro" style="width: 100%;" onchange="verificarMotivoOutros(this.value)">
                    <option value="">Selecione um problema...</option>
                    <option value="Não liga">Não liga</option>
                    <option value="Não digitaliza">Não digitaliza</option>
                    <option value="Está amassando papel">Está amassando papel</option>
                    <option value="Não puxa o papel">Não puxa o papel</option>
                    <option value="Impressão com falhas">Impressão com falhas</option>
                    <option value="outros">Outros (Descrever abaixo)</option>
                </select>
            </div>

            <div id="campo-outros" style="display: none; margin-top: 20px;">
                <label style="color: white; display: block; margin-bottom: 8px;">Descreva o problema:</label>
                <textarea id="obs-manutencao" class="input-vidro" style="width: 100%; height: 80px;" placeholder="Detalhe o defeito aqui..."></textarea>
            </div>

            <div style="margin-top: 30px; display: flex; gap: 10px;">
                <button onclick="telaSolicitarServicoImpressora('manutencao')" class="btn-sair-vidro" style="background: #64748b;">CANCELAR</button>
                <button onclick="validarEEnviarManutencao(${impressoraId})" class="btn-sair-vidro" style="background: #059669; flex: 1;">ENVIAR CHAMADO</button>
            </div>
        </div>
    `;
}

function verificarMotivoOutros(valor) {
    const campo = document.getElementById('campo-outros');
    campo.style.display = valor === 'outros' ? 'block' : 'none';
}

async function validarEEnviarManutencao(impressoraId) {
    const motivo = document.getElementById('motivo-manutencao').value;
    const obs = document.getElementById('obs-manutencao').value;

    if (!motivo) {
        alert("Por favor, selecione o motivo da manutenção.");
        return;
    }

    if (motivo === 'outros' && obs.trim().length < 5) {
        alert("Para o motivo 'Outros', é obrigatório descrever o problema detalhadamente.");
        return;
    }

    enviarChamadoAoServidor({
        impressora_id: impressoraId,
        tipo: 'manutencao',
        motivo: motivo === 'outros' ? 'Outros - Ver observações' : motivo,
        observacoes: obs
    });
}

async function enviarChamadoAoServidor(dados) {
    try {
        const res = await fetch(`${API_URL}/impressoras/chamado`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const resultado = await res.json();

        if (res.ok) {
            alert("✅ " + resultado.message);
            carregarDashboard(); // Retorna ao menu principal
        } else {
            // Aqui o servidor avisará se já existe um chamado em aberto
            alert("⚠️ " + resultado.error);
        }
    } catch (err) {
        alert("Erro de conexão com o servidor.");
    }
}

async function telaListarChamadosAbertos() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; text-align:center; color:white;">🔍 Consultando fila de chamados...</div>';

    try {
        const res = await fetch(`${API_URL}/impressoras/chamados/abertos`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const chamados = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <h2 style="color: white; margin-bottom: 25px; text-align: center;">📋 CHAMADOS AGUARDANDO ATENDIMENTO</h2>
                <div class="grid-menu-principal" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                    ${chamados.length === 0 ? 
                        `<p style="color:white; text-align:center; grid-column: 1/-1;">Não há chamados abertos no momento.</p>` : 
                        chamados.map(c => `
                        <div class="painel-vidro" style="text-align: left; position: relative;">
                            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                                <img src="${c.modelo === 'mono' ? 'mono.png' : 'color.png'}" style="width: 50px;">
                                <div>
                                    <strong style="color: #fbbf24; font-size: 1.1rem;">${c.tipo.toUpperCase()}</strong><br>
                                    <small style="color: #cbd5e1;">${c.escola_nome}</small>
                                </div>
                            </div>
                            
                            <div style="color: white; font-size: 0.9rem; margin-bottom: 15px;">
                                <strong>Motivo:</strong> ${c.motivo || 'N/A'}<br>
                                ${c.observacoes ? `<p style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 5px; margin-top: 5px;">"${c.observacoes}"</p>` : ''}
                                <small style="color: #94a3b8;">Aberto em: ${new Date(c.data_abertura).toLocaleString('pt-BR')}</small>
                            </div>

                            <button onclick="abrirModalConclusao(${c.id})" 
                                    class="btn-sair-vidro" 
                                    style="background: #059669; width: 100%; padding: 10px;">
                                ✅ FINALIZAR ATENDIMENTO
                            </button>
                        </div>
                    `).join('')}
                </div>
                <button onclick="carregarDashboard()" class="btn-sair-vidro" style="margin-top: 20px; background: #475569;">VOLTAR</button>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar chamados.");
    }
}

async function executarEncerramentoChamado(chamadoId, dados) {
    try {
        const res = await fetch(`${API_URL}/impressoras/concluir-chamado/${chamadoId}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}` 
            },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            alert("✅ Chamado encerrado e contador registrado!");
            document.getElementById('modal-conclusao').remove();
            telaListarChamadosAbertos(); // Recarrega a lista para remover o item concluído
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) {
        alert("Erro de conexão com o servidor.");
    }
}

async function telaCadastroImpressoras() {
    const container = document.getElementById('app-content');
    // 1. Limpa e mostra carregando
    container.innerHTML = '<div class="painel-vidro">🔍 Tentando carregar locais...</div>';

    const tokenAtual = localStorage.getItem('token');

    try {
        // 2. Faz a chamada para a rota correta do seu api.routes.js
        const res = await fetch(`${API_URL}/locais/lista-simples`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${tokenAtual}`,
                'Content-Type': 'application/json'
            }
        });

        // DEBUG: Se não estiver OK, vamos ver o que aconteceu
        if (!res.ok) {
            const erroTexto = await res.text(); // Tenta ler a mensagem do servidor
            throw new Error(`Servidor respondeu com status ${res.status}: ${erroTexto}`);
        }

        const locais = await res.json();

        // 3. Se chegou aqui, deu certo. Monta a tela:
        container.innerHTML = `
            <div class="painel-vidro" style="max-width: 500px; margin: 0 auto; text-align: left;">
                <h2 style="color: white; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; text-align:center;">
                    🖨️ CADASTRAR IMPRESSORA
                </h2>
                
                <div style="margin-top: 25px;">
                    <label style="color: white; display: block; margin-bottom: 8px;">Unidade Escolar / Local:</label>
                    <select id="reg-imp-local" class="input-vidro" style="width: 100%;">
                        <option value="">-- SELECIONE O LOCAL --</option>
                        ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                    </select>
                </div>

                <div style="margin-top: 20px;">
                    <label style="color: white; display: block; margin-bottom: 8px;">Modelo da Impressora:</label>
                    <select id="reg-imp-modelo" class="input-vidro" style="width: 100%;">
                        <option value="">Selecione o tipo...</option>
                        <option value="mono">MONOCROMÁTICA</option>
                        <option value="color">COLORIDA</option>
                        <option value="duplicadora">DUPLICADORA</option>
                    </select>
                </div>

                <div style="margin-top: 35px; display: flex; gap: 10px;">
                    <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background: #475569;">VOLTAR</button>
                    <button onclick="executarCadastroImpressora()" class="btn-sair-vidro" style="background: #059669; flex: 1;">
                        SALVAR
                    </button>
                </div>
            </div>
        `;

    } catch (err) {
        // 4. Se der erro, tira o "Carregando..." e mostra o erro real na tela
        console.error("Erro detalhado:", err);
        container.innerHTML = `
            <div class="painel-vidro" style="border: 2px solid #ef4444;">
                <h3 style="color: #ef4444;">⚠️ Erro de Comunicação</h3>
                <p style="color: white;">${err.message}</p>
                <button onclick="telaCadastroImpressoras()" class="btn-vidro" style="margin-top:10px;">Tentar Novamente</button>
                <button onclick="carregarDashboard()" class="btn-vidro" style="margin-top:10px; background: #64748b;">Voltar</button>
            </div>
        `;
    }
}

async function executarCadastroImpressora() {
    const tokenParaUso = localStorage.getItem('token');
    const local_id = document.getElementById('reg-imp-local').value;
    const modelo = document.getElementById('reg-imp-modelo').value;

    if (!local_id || !modelo) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/impressoras`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ local_id, modelo })
        });

        if (res.ok) {
            alert("✅ Impressora vinculada ao local com sucesso!");
            telaCadastroImpressoras(); // Limpa e recarrega a tela
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (err) {
        alert("Falha na comunicação com o servidor.");
    }
}

async function atualizarDashboardImpressoras() {
    const inicio = document.getElementById('dash-inicio').value;
    const fim = document.getElementById('dash-fim').value;
    const local = document.getElementById('dash-local').value;

    const res = await fetch(`${API_URL}/impressoras/dashboard-stats?inicio=${inicio}&fim=${fim}&local_id=${local}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const d = await res.json();

    // Atualiza Números
    document.getElementById('stat-recarga').innerText = d.total_recarga;
    document.getElementById('stat-manutencao').innerText = d.total_manutencao;
    document.getElementById('stat-atendidos').innerText = d.atendidos;
    document.getElementById('stat-pendentes').innerText = d.pendentes;

    // Destrói gráficos antigos para não sobrepor
    if (chart1) chart1.destroy();
    if (chart2) chart2.destroy();

    // Gráfico de Tipos (Recarga vs Manutenção)
    chart1 = new Chart(document.getElementById('chartTipos'), {
        type: 'bar',
        data: {
            labels: ['Recarga', 'Manutenção'],
            datasets: [{
                label: 'Quantidade',
                data: [d.total_recarga, d.total_manutencao],
                backgroundColor: ['#3b82f6', '#fbbf24']
            }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { color: 'white' } } } }
    });

    // Gráfico de Status (Pizza %)
    chart2 = new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: {
            labels: ['Atendidos', 'Pendentes'],
            datasets: [{
                data: [d.atendidos, d.pendentes],
                backgroundColor: ['#4ade80', '#fb7185']
            }]
        }
    });
}

async function atualizarnovoDashboardImpressoras() {
    const inicio = document.getElementById('dash-inicio').value;
    const fim = document.getElementById('dash-fim').value;
    const local1 = document.getElementById('dash-local').value;
    const local2 = modoComparacao ? document.getElementById('dash-local-2').value : null;

    // Busca dados do Local 1
    const res1 = await fetch(`${API_URL}/impressoras/dashboard-stats?inicio=${inicio}&fim=${fim}&local_id=${local1}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const d1 = await res1.json();

    let d2 = null;
    if (modoComparacao && local2) {
        // Busca dados do Local 2
        const res2 = await fetch(`${API_URL}/impressoras/dashboard-stats?inicio=${inicio}&fim=${fim}&local_id=${local2}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        d2 = await res2.json();
    }

    renderizarGraficosComparativos(d1, d2, local1, local2);
}

function gerarPDFDashboard() {
    const area = document.getElementById('relatorio-pdf-area');
    const local1 = document.getElementById('dash-local').options[document.getElementById('dash-local').selectedIndex].text;
    const local2 = modoComparacao ? " vs " + document.getElementById('dash-local-2').options[document.getElementById('dash-local-2').selectedIndex].text : "";

    const opt = {
        margin: 10,
        filename: `Relatorio_Manutencao_${local1}${local2}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } // Horizontal fica melhor para gráficos lado a lado
    };

    html2pdf().set(opt).from(area).save();
}

function habilitarComparacao() {
    modoComparacao = true;
    const areaFiltros = document.querySelector('.painel-vidro');
    
    // Adiciona o segundo seletor de local se ele não existir
    if (!document.getElementById('dash-local-2')) {
        const divFiltro2 = document.createElement('div');
        divFiltro2.id = 'container-local-2';
        divFiltro2.innerHTML = `
            <label style="color:#fbbf24; display:block; font-size:0.8rem;">COMPARAR COM:</label>
            <select id="dash-local-2" class="input-vidro" onchange="atualizarDashboardImpressoras()">
                <option value="">Selecione outro local...</option>
                ${Array.from(document.getElementById('dash-local').options)
                    .filter(opt => opt.value !== 'TODAS')
                    .map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('')}
            </select>
        `;
        // Insere antes do botão PDF
        areaFiltros.insertBefore(divFiltro2, document.querySelector('button[onclick="gerarPDFDashboard()"]'));
        
        // Alerta visual de que o modo mudou
        document.getElementById('dash-local').previousElementSibling.innerText = "LOCAL A";
        document.getElementById('dash-local').style.borderColor = "#3b82f6";
    }
}

function renderizarGraficosComparativos(d1, d2, id1, id2) {
    const ctxTipos = document.getElementById('chartTipos');
    const nomeLocal1 = document.getElementById('dash-local').options[document.getElementById('dash-local').selectedIndex].text;
    const nomeLocal2 = d2 ? document.getElementById('dash-local-2').options[document.getElementById('dash-local-2').selectedIndex].text : '';

    if (chart1) chart1.destroy();

    const datasets = [
        {
            label: d2 ? nomeLocal1 : 'Total',
            data: [d1.total_recarga, d1.total_manutencao],
            backgroundColor: '#3b82f6'
        }
    ];

    // Se houver comparação, adicionamos o segundo conjunto de barras
    if (d2) {
        datasets.push({
            label: nomeLocal2,
            data: [d2.total_recarga, d2.total_manutencao],
            backgroundColor: '#fbbf24'
        });
    }

    chart1 = new Chart(ctxTipos, {
        type: 'bar',
        data: {
            labels: ['Recargas de Toner', 'Manutenções'],
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, labels: { color: 'white' } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: 'white' } },
                x: { ticks: { color: 'white' } }
            }
        }
    });

    // Atualiza os cards numéricos com a soma ou apenas Local 1
    document.getElementById('stat-recarga').innerText = d2 ? (parseInt(d1.total_recarga) + parseInt(d2.total_recarga)) : d1.total_recarga;
    document.getElementById('stat-manutencao').innerText = d2 ? (parseInt(d1.total_manutencao) + parseInt(d2.total_manutencao)) : d1.total_manutencao;
}

async function telaRelatorioGeralAtivos() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div style="padding:20px; text-align:center; color:white;">🔍 Gerando inventário consolidado...</div>';

    try {
        const res = await fetch(`${API_URL}/impressoras/relatorio-geral`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const ativos = await res.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div class="painel-vidro" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="color: white; margin:0;">🖨️ INVENTÁRIO GERAL DE ATIVOS</h2>
                    <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background: #475569;">VOLTAR</button>
                </div>

                <div class="painel-vidro">
                    <table style="width:100%; border-collapse:collapse; color:white; text-align:left;">
                        <thead>
                            <tr style="border-bottom:2px solid rgba(255,255,255,0.2);">
                                <th style="padding:12px;">ID</th>
                                <th style="padding:12px;">Localidade</th>
                                <th style="padding:12px;">Modelo</th>
                                <th style="padding:12px;">Situação Atual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ativos.map(a => {
                                // Lógica de cores para o Status
                                let corStatus = '#4ade80'; // Verde (Operacional)
                                let textoStatus = '✅ OPERACIONAL';

                                if (a.status_chamado === 'recarga') {
                                    corStatus = '#fbbf24'; // Amarelo
                                    textoStatus = '💧 AGUARDANDO RECARGA';
                                } else if (a.status_chamado === 'manutencao') {
                                    corStatus = '#f87171'; // Vermelho
                                    textoStatus = '🛠️ EM MANUTENÇÃO';
                                }

                                return `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1); transition: 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                        <td style="padding:12px;">#${a.id}</td>
                                        <td style="padding:12px; font-weight:bold;">${a.local_nome}</td>
                                        <td style="padding:12px;">${a.modelo.toUpperCase()}</td>
                                        <td style="padding:12px;">
                                            <span style="background:${corStatus}; color:black; padding:4px 10px; border-radius:15px; font-size:0.75rem; font-weight:bold;">
                                                ${textoStatus}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar relatório de ativos.");
    }
}

async function buscarProdutosParaPedido(categoria) {
    const localDestino = document.getElementById('admin_local_destino').value;
    if (!localDestino) return alert("Selecione primeiro o local de destino!");

    // Busca produtos da categoria para o usuário escolher
    const res = await fetch(`${API_URL}/estoque/geral`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const produtos = await res.json();
    const filtrados = produtos.filter(p => p.tipo === categoria && p.quantidade_estoque > 0);

    // Abre um prompt simples para teste (ou você pode criar um modal bonito)
    let lista = filtrados.map((p, i) => `${i}) ${p.nome} (Disp: ${p.quantidade_estoque})`).join('\n');
    let escolha = prompt("Digite o número do produto:\n" + lista);
    
    if (escolha !== null && filtrados[escolha]) {
        let qtd = prompt(`Quantos itens de ${filtrados[escolha].nome}?`, "1");
        if (qtd > 0 && qtd <= filtrados[escolha].quantidade_estoque) {
            adicionarAoCarrinhoAdmin(filtrados[escolha], qtd);
        } else {
            alert("Quantidade inválida ou superior ao estoque!");
        }
    }
}

function adicionarAoCarrinhoAdmin(produto, qtd) {
    carrinhoAdmin.push({ produto_id: produto.id, nome: produto.nome, quantidade: parseInt(qtd) });
    const area = document.getElementById('lista-carrinho-admin');
    area.style.display = 'block';
    
    document.getElementById('itens-carrinho').innerHTML = carrinhoAdmin.map(i => 
        `<div style="color:white; padding:5px 0;">• ${i.nome} - <b>${i.quantidade} un</b></div>`
    ).join('');
}

async function telaConsultaPatrimonio() {
    const container = document.getElementById('app-content');
    
    container.innerHTML = `
        <div style="padding:20px;">
            <div class="painel-usuario-vidro" style="position:relative; width:100%; top:0; right:0; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="color:white; margin:0;">🔍 CONSULTA DE PATRIMÔNIO</h2>
                <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#64748b;">⬅ VOLTAR</button>
            </div>

            <div class="container-busca-estoque">
                <span class="icone-lupa-busca">🏷️</span>
                <input type="text" id="input-busca-serie" class="input-busca-vidro" 
                       placeholder="Bipe o Número de Série ou Plaqueta..." 
                       onkeypress="if(event.key === 'Enter') executarBuscaPatrimonio()">
            </div>

            <div id="resultado-consulta-patrimonio" style="margin-top: 30px;">
                </div>
        </div>
    `;

    // Foca automaticamente no campo para o leitor de código de barras
    setTimeout(() => document.getElementById('input-busca-serie').focus(), 500);
}

async function executarBuscaPatrimonio() {
    const serie = document.getElementById('input-busca-serie').value.trim();
    const display = document.getElementById('resultado-consulta-patrimonio');

    if (!serie) return;

    display.innerHTML = '<div class="painel-vidro">🔎 Pesquisando nos registros...</div>';

    try {
        const res = await fetch(`${API_URL}/estoque/consulta-patrimonio/${serie}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        const data = await res.json();

        if (!res.ok) {
            display.innerHTML = `<div class="painel-vidro" style="border-left: 5px solid #ef4444;">⚠️ ${data.error}</div>`;
            return;
        }

        display.innerHTML = `
            <div class="painel-vidro" style="text-align: left; animation: fadeIn 0.5s ease;">
                <h3 style="color:#fbbf24; margin-top:0;">DETALHES DO ITEM: ${data.numero_serie}</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="color: white;">
                        <p><b>📦 PRODUTO:</b><br> ${data.produto_nome}</p>
                        <p><b>🚦 STATUS ATUAL:</b><br> 
                            <span style="background:${data.status === 'DISPONIVEL' ? '#10b981' : '#3b82f6'}; color:white; padding:2px 8px; border-radius:5px; font-size:0.8rem;">
                                ${data.status}
                            </span>
                        </p>
                    </div>
                    <div style="color: white; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px;">
                        <p><b>📄 DOCUMENTO FISCAL:</b><br> NF: ${data.numero_doc} / SÉRIE: ${data.serie_doc}</p>
                        <p><b>📅 DATA DE ENTRADA:</b><br> ${data.data_entrada_formatada}</p>
                        <p><b>🔑 CHAVE NFe:</b><br> <small>${data.chave_nfe}</small></p>
                    </div>
                </div>
                <div style="margin-top:20px; font-size:0.8rem; color:#94a3b8; text-align:right;">
                    Registrado por: ${data.cadastrado_por}
                </div>
            </div>
        `;

        // Limpa o campo para a próxima consulta
        document.getElementById('input-busca-serie').value = '';
        document.getElementById('input-busca-serie').focus();

    } catch (err) {
        display.innerHTML = `<div class="painel-vidro" style="color:#ef4444;">Erro ao conectar com o servidor.</div>`;
    }
}

async function telaHistoricoMovimentacoes() {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="painel-vidro">🔍 Sincronizando logs e usuários...</div>';

    try {
        // Carrega logs e lista de usuários para o filtro
        const [resHist, resUsers] = await Promise.all([
            fetch(`${API_URL}/estoque/historico-movimentacoes`, { headers: { 'Authorization': `Bearer ${TOKEN}` } }),
            fetch(`${API_URL}/usuarios/lista`, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
        ]);

        const historico = await resHist.json();
        const usuarios = await resUsers.json();

        container.innerHTML = `
            <div style="padding:20px;">
                <div class="painel-usuario-vidro" style="position:relative; width:100%; top:0; right:0; margin-bottom:25px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:15px;">
                    <h2 style="color:white; margin:0;">📜 LOGS DE ESTOQUE</h2>
                    
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <select id="filtro-user-log" class="input-vidro" onchange="atualizarTabelaLogs()" style="min-width:180px;">
                            <option value="TODOS">TODOS OS USUÁRIOS</option>
                            ${usuarios.map(u => `<option value="${u.id}">${u.nome.toUpperCase()}</option>`).join('')}
                        </select>

                        <button onclick="exportarLogsExcel()" class="btn-sair-vidro" style="background:#059669;" title="Exportar Excel">📊 EXCEL</button>
                        <button onclick="exportarLogsPDF()" class="btn-sair-vidro" style="background:#dc2626;" title="Salvar PDF">📄 PDF</button>
                        <button onclick="compartilharLogsPDF()" class="btn-sair-vidro" style="background:#3b82f6;" title="Compartilhar">🔗 ENVIAR</button>
                        <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#64748b;">⬅ VOLTAR</button>
                    </div>
                </div>

                <div id="area-tabela-logs" class="painel-vidro" style="padding:0; overflow:hidden;">
                    ${renderizarLinhasLog(historico)}
                </div>
            </div>
        `;
    } catch (err) {
        alert("Erro ao carregar o histórico.");
    }
}

function renderizarLinhasLog(dados) {
    if (dados.length === 0) return '<div style="padding:40px; color:#cbd5e1; text-align:center;">Nenhum registro encontrado para este filtro.</div>';

    return `
        <table style="width:100%; border-collapse:collapse; color:white; text-align:left;">
            <thead style="background:rgba(255,255,255,0.1);">
                <tr>
                    <th style="padding:15px;">Data/Hora</th>
                    <th style="padding:15px;">Produto</th>
                    <th style="padding:15px; text-align:center;">Qtd</th>
                    <th style="padding:15px; text-align:center;">Operação</th>
                    <th style="padding:15px;">Responsável</th>
                </tr>
            </thead>
            <tbody>
                ${dados.map(h => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:15px; font-size:0.85rem; color:#cbd5e1;">${h.data_formatada}</td>
                        <td style="padding:15px; font-weight:bold;">${h.produto_nome}</td>
                        <td style="padding:15px; text-align:center;">${h.quantidade}</td>
                        <td style="padding:15px; text-align:center;">
                            <span style="color:${h.tipo_movimentacao === 'ENTRADA' ? '#4ade80' : '#f87171'}; font-weight:bold; font-size:0.75rem;">
                                ${h.tipo_movimentacao}
                            </span>
                        </td>
                        <td style="padding:15px;">👤 ${h.usuario_nome.toUpperCase()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function atualizarTabelaLogs() {
    const userId = document.getElementById('filtro-user-log').value;
    const area = document.getElementById('area-tabela-logs');
    area.innerHTML = '<div style="padding:20px; text-align:center; color:white;">🔄 Filtrando...</div>';

    try {
        const res = await fetch(`${API_URL}/estoque/historico-movimentacoes?usuario_id=${userId}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const dados = await res.json();
        area.innerHTML = renderizarLinhasLog(dados);
    } catch (err) {
        alert("Erro ao filtrar logs.");
    }
}

function exportarLogsExcel() {
    const tabela = document.querySelector("#area-tabela-logs table");
    if (!tabela) return alert("Nenhum dado para exportar.");

    let csv = [];
    const linhas = tabela.querySelectorAll("tr");
    
    for (let i = 0; i < linhas.length; i++) {
        const colunas = linhas[i].querySelectorAll("td, th");
        const linha = Array.from(colunas).map(col => `"${col.innerText}"`).join(",");
        csv.push(linha);
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Historico_Estoque_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarLogsPDF() {
    const elemento = document.getElementById('area-tabela-logs');
    const user = document.getElementById('filtro-user-log').options[document.getElementById('filtro-user-log').selectedIndex].text;

    const opcoes = {
        margin: 10,
        filename: `LOG_ESTOQUE_${user.replace(" ", "_")}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#004a99' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opcoes).from(elemento).save();
}

async function compartilharLogsPDF() {
    const elemento = document.getElementById('area-tabela-logs');
    const user = document.getElementById('filtro-user-log').options[document.getElementById('filtro-user-log').selectedIndex].text;

    if (!navigator.share) {
        return alert("Seu navegador não suporta compartilhamento nativo. Use a opção PDF.");
    }

    const opcoes = {
        margin: 10,
        filename: 'relatorio.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // Gera o PDF como um Blob para poder enviar
    const pdfBlob = await html2pdf().set(opcoes).from(elemento).output('blob');
    const arquivo = new File([pdfBlob], `Logs_Estoque_${user}.pdf`, { type: 'application/pdf' });

    try {
        await navigator.share({
            title: 'Relatório de Movimentação de Estoque',
            text: `Segue o log de estoque filtrado para: ${user}`,
            files: [arquivo]
        });
    } catch (err) {
        console.log("Compartilhamento cancelado ou falhou:", err);
    }
}

async function compartilharDashboardPDF() {
    const elemento = document.getElementById('relatorio-pdf-area');
    const local = document.getElementById('dash-local').options[document.getElementById('dash-local').selectedIndex].text;

    // Verifica suporte ao compartilhamento nativo
    if (!navigator.share) {
        return alert("Seu navegador não suporta compartilhamento nativo. Utilize a função PDF para salvar o arquivo.");
    }

    // Configurações do PDF para compartilhamento (Layout Paisagem para os gráficos)
    const opcoes = {
        margin: 10,
        filename: 'relatorio_manutencao.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#004a99' }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // Gera o Blob do PDF
    try {
        const pdfBlob = await html2pdf().set(opcoes).from(elemento).output('blob');
        const arquivo = new File([pdfBlob], `Dashboard_Impressoras_${local.replace(" ", "_")}.pdf`, { type: 'application/pdf' });

        await navigator.share({
            title: 'Relatório Técnico - Manutenção de Impressoras',
            text: `Segue o relatório de chamados e manutenções da unidade: ${local}`,
            files: [arquivo]
        });
        
        console.log("Compartilhamento realizado com sucesso.");
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Erro ao compartilhar:", err);
            alert("Não foi possível processar o compartilhamento.");
        }
    }
}

async function sincronizarDadosUsuario() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/auth/sincronizar-identidade`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            console.error("Sessão inválida.");
            return;
        }

        const info = await res.json();

        // Guardamos TUDO de forma organizada
        localStorage.setItem('usuario_id', info.id);
        localStorage.setItem('usuario_perfil', info.perfil);
        localStorage.setItem('usuario_local_id', info.local_id || 'NULL'); // Se for Admin, pode ser NULL
        localStorage.setItem('usuario_local_nome', info.local_nome || 'ADMINISTRAÇÃO');

        console.log("✅ Identidade Sincronizada:", info.nome, "| Perfil:", info.perfil);
    } catch (err) {
        console.error("Falha ao cercar informações do usuário:", err);
    }
}

function telaCadastroLocal() {
    const area = document.getElementById('area-formulario-cadastro');
    area.innerHTML = `
        <div class="card-login" style="max-width: 100%; text-align: left; animation: fadeIn 0.3s ease;">
            <h3 style="color: white; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                🏫 NOVO LOCAL / UNIDADE ESCOLAR
            </h3>
            
            <div style="margin-top: 20px;">
                <label style="color: #cbd5e1; font-size: 0.8rem; display: block; margin-bottom: 8px;">
                    NOME DA UNIDADE (Ex: ESCOLA MUNICIPAL EXEMPLO):
                </label>
                <input type="text" id="cad_local_nome" placeholder="Digite o nome completo..." 
                       class="input-vidro" style="width: 100%; text-transform: uppercase;">
            </div>

            <button onclick="salvarNovoLocal()" class="btn-grande btn-vidro" 
                    style="background: #10b981; margin-top: 25px; width: 100%;">
                💾 SALVAR UNIDADE NO SISTEMA
            </button>
        </div>
    `;
    // Foca automaticamente no campo de nome
    setTimeout(() => document.getElementById('cad_local_nome').focus(), 300);
}

async function salvarNovoLocal() {
    const nome = document.getElementById('cad_local_nome').value;
    const token = localStorage.getItem('token');

    if (!nome || nome.length < 3) {
        return alert("Por favor, insira um nome válido para o local.");
    }

    try {
        const res = await fetch(`${API_URL}/locais`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nome })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ " + data.message);
            document.getElementById('cad_local_nome').value = '';
            // Opcional: se houver uma lista de locais na tela, você pode disparar a função que a recarrega aqui
        } else {
            alert("⚠️ " + data.error);
        }
    } catch (e) {
        alert("Erro crítico de conexão com o servidor.");
    }
}

async function telaInventarioLocal() {
    const app = document.getElementById('app-content');
    app.innerHTML = '<div class="painel-vidro">🔍 Carregando lista de unidades...</div>';

    try {
        const resLocais = await fetch(`${API_URL}/locais/lista-simples`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const locais = await resLocais.json();

        app.innerHTML = `
            <div class="painel-vidro" style="max-width: 900px; margin: auto;">
                <h2 style="color:white; text-align:center;">📋 INVENTÁRIO POR UNIDADE</h2>
                
                <div style="display:flex; gap:15px; margin-bottom:30px; justify-content:center; align-items:flex-end;">
                    <div style="flex:1;">
                        <label style="color:white; font-size:0.8rem;">SELECIONE A ESCOLA / LOCAL:</label>
                        <select id="inv_local_id" class="input-vidro" style="width:100%;">
                            <option value="">-- SELECIONE UMA UNIDADE --</option>
                            ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                        </select>
                    </div>
                    <button onclick="gerarRelatorioInventario()" class="btn-vidro" style="background:#3b82f6; height:45px;">
                        GERAR RELATÓRIO
                    </button>
                    <button onclick="exportarInventarioPDF()" id="btn-pdf-inv" class="btn-vidro" style="background:#dc2626; height:45px; display:none;">
                        📄 EXPORTAR PDF
                    </button>
                </div>

                <div id="resultado-inventario" class="area-relatorio" style="background:white; border-radius:8px; overflow:hidden; display:none; color:#333;">
                    </div>
            </div>
        `;
    } catch (e) { alert("Erro ao carregar locais."); }
}

async function gerarRelatorioInventario() {
    const localId = document.getElementById('inv_local_id').value;
    if (!localId) return alert("Selecione um local!");

    const res = await fetch(`${API_URL}/estoque/inventario/${localId}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();

    const area = document.getElementById('resultado-inventario');
    const btnPdf = document.getElementById('btn-pdf-inv');
    
    area.style.display = 'block';
    btnPdf.style.display = 'block';

    area.innerHTML = `
        <div id="pdf-content" style="padding:30px;">
            <div style="text-align:center; border-bottom:2px solid #1e3a8a; padding-bottom:15px; margin-bottom:20px;">
                <h3 style="margin:0; color:#1e3a8a;">PREFEITURA MUNICIPAL - SEMED</h3>
                <h4 style="margin:5px 0; color:#64748b;">Relatório de Inventário de Patrimônio</h4>
                <p style="margin:0; font-weight:bold;">UNIDADE: ${data.unidade}</p>
                <p style="font-size:0.8rem;">Total de Bens Localizados: ${data.total_itens}</p>
            </div>

            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">PRODUTO</th>
                        <th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">PLAQUETA/SÉRIE</th>
                        <th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">SETOR</th>
                        <th style="padding:10px; border:1px solid #cbd5e1; text-align:center;">STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.itens.map(i => `
                        <tr>
                            <td style="padding:8px; border:1px solid #cbd5e1;">${i.produto_nome}</td>
                            <td style="padding:8px; border:1px solid #cbd5e1; font-family:monospace;">${i.numero_serie}</td>
                            <td style="padding:8px; border:1px solid #cbd5e1;">${i.setor_nome || 'GERAL'}</td>
                            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
                                <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background:#dcfce7; color:#166534;">${i.status}</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top:50px; display:flex; justify-content:space-between;">
                <div style="text-align:center; width:200px; border-top:1px solid #333; font-size:0.7rem;">Responsável pela Unidade</div>
                <div style="text-align:center; width:200px; border-top:1px solid #333; font-size:0.7rem;">Diretoria de Patrimônio</div>
            </div>
        </div>
    `;
}

function exportarInventarioPDF() {
    const element = document.getElementById('pdf-content');
    const localNome = document.getElementById('inv_local_id').options[document.getElementById('inv_local_id').selectedIndex].text;
    
    const opt = {
        margin: 10,
        filename: `Inventario_${localNome.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

function abrirModalBaixa(patrimonioId, produtoId, numeroSerie) {
    const modalHtml = `
        <div id="modal-baixa" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:1000;">
            <div class="painel-vidro" style="max-width:450px; width:90%; border:1px solid #ef4444;">
                <h3 style="color:#ef4444; margin-top:0;">⚠️ BAIXA DE PATRIMÓNIO</h3>
                <p style="color:white; font-size:0.9rem;">Você está prestes a marcar o item <strong>${numeroSerie}</strong> como <strong>INSERVÍVEL</strong>.</p>
                
                <label style="color:#cbd5e1; font-size:0.8rem;">MOTIVO DA BAIXA:</label>
                <select id="baixa_motivo" class="input-vidro" style="width:100%; margin-bottom:15px;">
                    <option value="QUEBRADO/SEM CONSERTO">QUEBRADO / SEM CONSERTO</option>
                    <option value="FURTO/ROUBO">FURTO OU ROUBO (C/ B.O.)</option>
                    <option value="LEILOADO">ENCAMINHADO PARA LEILÃO</option>
                    <option value="DESCARTE TÉCNICO">DESCARTE TÉCNICO (LIXO ELETRÓNICO)</option>
                </select>

                <label style="color:#cbd5e1; font-size:0.8rem;">OBSERVAÇÕES ADICIONAIS:</label>
                <textarea id="baixa_obs" class="input-vidro" style="width:100%; height:80px; margin-bottom:20px;" placeholder="Ex: Número do processo de baixa ou BO..."></textarea>

                <div style="display:flex; gap:10px;">
                    <button onclick="confirmarBaixa(${patrimonioId}, ${produtoId})" class="btn-vidro" style="background:#dc2626; flex:1;">CONFIRMAR BAIXA</button>
                    <button onclick="document.getElementById('modal-baixa').remove()" class="btn-vidro" style="flex:1;">CANCELAR</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function confirmarBaixa(patrimonioId, produtoId) {
    const payload = {
        patrimonio_id: patrimonioId,
        produto_id: produtoId,
        motivo_especifico: document.getElementById('baixa_motivo').value,
        observacao: document.getElementById('baixa_obs').value
    };

    try {
        const res = await fetch(`${API_URL}/estoque/baixa-patrimonio`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Património registado como INSERVÍVEL.");
            document.getElementById('modal-baixa').remove();
            buscarDadosPatrimonio(); // Recarrega a consulta
        } else {
            alert("Erro ao processar baixa.");
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
}

async function telaResumoBaixasAnual() {
    const area = document.getElementById('app-content');
    area.innerHTML = '<div class="painel-vidro">📊 Gerando consolidação de dados...</div>';

    try {
        const res = await fetch(`${API_URL}/estoque/baixas/resumo-anual`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const dados = await res.json();

        if (dados.length === 0) {
            area.innerHTML = `
                <div class="painel-vidro" style="text-align:center;">
                    <h2 style="color:white;">📉 RESUMO DE BAIXAS (INSERVÍVEIS)</h2>
                    <p style="color:#cbd5e1;">Nenhum registro de baixa encontrado no histórico.</p>
                    <button onclick="carregarDashboard()" class="btn-vidro">VOLTAR</button>
                </div>`;
            return;
        }

        area.innerHTML = `
            <div class="painel-vidro" style="max-width: 1000px; margin: auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                    <h2 style="color:white; margin:0;">📉 RESUMO DE BAIXAS (INSERVÍVEIS)</h2>
                    <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#64748b;">⬅ VOLTAR</button>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
                    ${renderizarCardsBaixas(dados)}
                </div>
            </div>
        `;
    } catch (e) {
        alert("Erro ao carregar o resumo.");
    }
}

function renderizarCardsBaixas(dados) {
    // Agrupa por ano para criar seções
    const anos = [...new Set(dados.map(d => d.ano))];
    
    return anos.map(ano => `
        <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; border-left:4px solid #ef4444;">
            <h3 style="color:#ef4444; margin-top:0;">ANO BASE: ${ano}</h3>
            <table style="width:100%; color:white; font-size:0.9rem; border-collapse:collapse;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left;">
                        <th style="padding:10px 0;">CATEGORIA</th>
                        <th style="padding:10px 0; text-align:right;">ITENS</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.filter(d => d.ano === ano).map(d => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                            <td style="padding:10px 0;">${d.categoria}</td>
                            <td style="padding:10px 0; text-align:right; font-weight:bold;">${d.total_itens}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

function formatarIntervalo(intervalo) {
    if (!intervalo) return "N/A";
    const dias = intervalo.days || 0;
    const horas = intervalo.hours || 0;
    const minutos = intervalo.minutes || 0;
    
    let texto = "";
    if (dias > 0) texto += `${dias}d `;
    texto += `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}h`;
    return texto;
}

function abrirModalConclusao(chamadoId) {
    // Removi as funções intermediárias para evitar confusão de IDs
    const modalHtml = `
        <div id="modal-conclusao" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:2000;">
            <div class="painel-vidro" style="max-width:400px; width:90%; border:1px solid #10b981;">
                <h3 style="color:#10b981; margin-top:0;">📋 DADOS DA RECARGA</h3>
                
                <div style="margin-top:15px;">
                    <label style="color:white; display:block; font-size:0.8rem; margin-bottom:5px;">CONTADOR DA IMPRESSORA:</label>
                    <input type="number" id="final_contador" placeholder="Digite o total de páginas..." class="input-vidro" style="width:100%;">
                </div>

                <div style="margin-top:15px;">
                    <label style="color:white; display:block; font-size:0.8rem; margin-bottom:5px;">RELATÓRIO TÉCNICO:</label>
                    <textarea id="final_relatorio" class="input-vidro" style="width:100%; height:60px;" placeholder="Obs. sobre o estado da máquina..."></textarea>
                </div>

                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="enviarEncerramento(${chamadoId})" class="btn-vidro" style="background:#059669; flex:1;">CONFIRMAR</button>
                    <button onclick="document.getElementById('modal-conclusao').remove()" class="btn-vidro" style="flex:1;">CANCELAR</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function enviarEncerramento(id) {
    const contador = document.getElementById('final_contador').value;
    const relatorio = document.getElementById('final_relatorio').value;
    
    // Recupera o ID que a função inicializarSessaoUsuario salvou
    const tecnicoId = localStorage.getItem('usuario_id');

    if (!contador) return alert("O número do contador é obrigatório!");
    if (!relatorio || relatorio.trim().length === 0) {
        return alert("O Relatório Técnico é obrigatório! Descreva brevemente o serviço realizado.");
    }
    try {
        const res = await fetch(`${API_URL}/impressoras/v2/finalizar-recarga/${id}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                contador: parseInt(contador), 
                relatorio: relatorio,
                usuario_id: tecnicoId ? parseInt(tecnicoId) : null
            })
        });

        if (res.ok) {
            alert("✅ Recarga registrada com sucesso!");
            const modal = document.getElementById('modal-conclusao');
            if (modal) modal.remove();
            telaListarChamadosAbertos(); 
        } else {
            const erro = await res.json();
            alert("Erro: " + erro.error);
        }
    } catch (e) {
        alert("Erro de conexão com o servidor.");
    }
}

async function telaComparativoLocais() {
    const area = document.getElementById('app-content');
    area.innerHTML = '<div class="painel-vidro">📊 Processando dados de rendimento...</div>';

    try {
        const res = await fetch(`${API_URL}/impressoras/comparativo-rendimento`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const dados = await res.json();

        area.innerHTML = `
            <div class="painel-vidro" style="max-width: 1000px; margin: auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                    <h2 style="color:white; margin:0;">⚖️ COMPARATIVO DE RENDIMENTO POR UNIDADE</h2>
                    <button onclick="carregarDashboard()" class="btn-sair-vidro">VOLTAR</button>
                </div>

                <div style="background:rgba(255,255,255,0.05); border-radius:12px; overflow:hidden;">
                    <table style="width:100%; color:white; border-collapse:collapse; text-align:left;">
                        <thead>
                            <tr style="background:rgba(255,255,255,0.1);">
                                <th style="padding:15px;">UNIDADE ESCOLAR</th>
                                <th style="padding:15px; text-align:center;">TOTAL PÁGINAS</th>
                                <th style="padding:15px; text-align:center;">QTD RECARGAS</th>
                                <th style="padding:15px; text-align:right;">MÉDIA PÁG/TONER</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dados.map((d, index) => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                    <td style="padding:15px;">
                                        <span style="color:#94a3b8; margin-right:10px;">#${index + 1}</span>
                                        <strong>${d.local_nome}</strong>
                                    </td>
                                    <td style="padding:15px; text-align:center;">${Number(d.total_paginas).toLocaleString()}</td>
                                    <td style="padding:15px; text-align:center;">${d.total_recargas}</td>
                                    <td style="padding:15px; text-align:right; font-weight:bold; color:${d.media_paginas_por_toner > 2500 ? '#4ade80' : '#fbbf24'};">
                                        ${Number(d.media_paginas_por_toner).toLocaleString()} pág.
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="color:#94a3b8; font-size:0.75rem; margin-top:15px;">* Médias baseadas na diferença entre contadores registrados no encerramento de cada recarga.</p>
            </div>
        `;
    } catch (e) {
        alert("Erro ao gerar comparativo.");
    }
}

async function telaFilaAtendimentoImpressoras() {
    const container = document.getElementById('app-content');
    
    container.innerHTML = `
        <div class="painel-vidro" style="max-width: 1200px; margin: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px;">
                <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#475569; margin:0; width:100px; font-size:0.8rem;">⬅️ VOLTAR</button>
                <h2 style="color:white; margin:0; font-size:1.3rem;">📋 FILA DE ATENDIMENTO (AGUARDANDO)</h2>
                <div style="width:100px;"></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div id="coluna-recarga">
                    <h3 style="color:#3b82f6; border-bottom:2px solid #3b82f6; padding-bottom:5px; font-size:1rem;">💧 RECARGAS</h3>
                    <div id="lista-fila-recarga" style="margin-top:15px;"></div>
                </div>
                <div id="coluna-manutencao">
                    <h3 style="color:#fbbf24; border-bottom:2px solid #fbbf24; padding-bottom:5px; font-size:1rem;">🛠️ MANUTENÇÃO</h3>
                    <div id="lista-fila-manutencao" style="margin-top:15px;"></div>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/impressoras/fila-atendimento`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const chamados = await res.json();

        const renderizarCards = (tipo) => {
            const filtrados = chamados.filter(c => c.tipo === tipo);
            if (filtrados.length === 0) return '<p style="color:#94a3b8; font-size:0.8rem;">Nenhum chamado pendente.</p>';

            return filtrados.map(c => `
                <div class="card-kpi" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; margin-bottom:12px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8; margin-bottom:8px;">
                        <span>📅 ${c.data_formatada}</span>
                        <span style="color:#fbbf24; font-weight:bold;">#${c.id}</span>
                    </div>
                    <div style="color:white; font-weight:bold; margin-bottom:5px; font-size:0.9rem;">📍 ${c.unidade_nome}</div>
                    <div style="color:#cbd5e1; font-size:0.8rem; margin-bottom:8px;">
                        🖨️ <b>Modelo:</b> ${c.impressora_modelo.toUpperCase()}<br>
                        👤 <b>Solicitante:</b> ${c.solicitado_por || 'Não identificado'}
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; font-size:0.75rem; color:#fff; border-left:3px solid ${tipo === 'recarga' ? '#3b82f6' : '#fbbf24'};">
                        <b>Motivo:</b> ${c.motivo || 'N/A'}
                    </div>
                </div>
            `).join('');
        };

        document.getElementById('lista-fila-recarga').innerHTML = renderizarCards('recarga');
        document.getElementById('lista-fila-manutencao').innerHTML = renderizarCards('manutencao');

    } catch (err) {
        console.error("Erro ao processar fila:", err);
    }
}

function calcularSLAUtil(dataInicio, dataFim) {
    let inicio = new Date(dataInicio);
    let fim = new Date(dataFim);
    let horasUteis = 0;

    // Percorre o período contando apenas horas em dias úteis
    let temp = new Date(inicio);
    while (temp < fim) {
        let diaSemana = temp.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) { // Pula Domingo(0) e Sábado(6)
            horasUteis += 1;
        }
        temp.setHours(temp.getHours() + 1);
    }

    // Define a cor baseada nos limites da Diretoria
    let cor = '#4ade80'; // Verde (Padrão)
    if (horasUteis >= 48) {
        cor = '#f87171'; // Vermelho (Crítico)
    } else if (horasUteis >= 36) {
        cor = '#fbbf24'; // Laranja/Amarelo (Atenção)
    }

    // Formatação do texto (Dias e Horas)
    let texto = horasUteis + "h";
    if (horasUteis >= 24) {
        const dias = Math.floor(horasUteis / 24);
        const restos = horasUteis % 24;
        texto = `${dias}d ${restos}h`;
    }

    return { texto, cor };
}

async function telaConsumoImpressoras() {
    const container = document.getElementById('app-content');
    
    container.innerHTML = `
        <div class="painel-vidro" style="max-width: 1300px; margin: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#475569; width:100px;">⬅️ VOLTAR</button>
                <h2 style="color:white; margin:0;">📈 RELATÓRIO DE CONSUMO E UTILIZAÇÃO</h2>
                <div style="display:flex; gap:10px;">
                    <button onclick="window.print()" class="btn-vidro" style="background:#dc2626; font-size:0.75rem;">📄 PDF</button>
                    <button onclick="compartilharConsumoZap()" class="btn-vidro" style="background:#16a34a; font-size:0.75rem;">📱 WHATSAPP</button>
                </div>
            </div>

            <div style="overflow-x:auto; background:rgba(0,0,0,0.2); border-radius:10px;">
                <table id="tabela-consumo" style="width:100%; border-collapse: collapse; color:white; font-size:0.8rem;">
                    <thead style="background:rgba(255,255,255,0.1);">
                        <tr>
                            <th style="padding:12px; text-align:left;">UNIDADE ESCOLAR</th>
                            <th style="padding:12px; text-align:left;">MODELO</th>
                            <th style="padding:12px; text-align:center;">PENÚLTIMA (A)</th>
                            <th style="padding:12px; text-align:center;">ÚLTIMA (B)</th>
                            <th style="padding:12px; text-align:center;">INTERVALO</th>
                            <th style="padding:12px; text-align:center;">CONSUMO (B-A)</th>
                            <th style="padding:12px; text-align:center;">MÉDIA MENSAL</th>
                        </tr>
                    </thead>
                    <tbody id="corpo-consumo"></tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/impressoras/relatorio-consumo`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await res.json();
        const corpo = document.getElementById('corpo-consumo');

        corpo.innerHTML = dados.map(item => {
            const d1 = new Date(item.data_penultima);
            const d2 = new Date(item.data_ultima);
            const diffDias = Math.max(1, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
            const consumo = item.ultima_leitura - item.penultima_leitura;
            const mediaMensal = Math.round((consumo / diffDias) * 30);

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:10px; font-weight:bold;">${item.unidade}</td>
                    <td style="padding:10px;">${item.modelo.toUpperCase()}</td>
                    <td style="padding:10px; text-align:center; color:#94a3b8;">${item.penultima_leitura}</td>
                    <td style="padding:10px; text-align:center; font-weight:bold;">${item.ultima_leitura}</td>
                    <td style="padding:10px; text-align:center;">${diffDias} dias</td>
                    <td style="padding:10px; text-align:center; color:#4ade80; font-weight:bold;">${consumo} pags</td>
                    <td style="padding:10px; text-align:center; background:rgba(255,255,255,0.03); color:#fbbf24;">${mediaMensal} pags/mês</td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error(err); }
}

function compartilharConsumoZap() {
    let texto = "*📊 RELATÓRIO DE CONSUMO DE IMPRESSORAS*\n\n";
    const linhas = document.querySelectorAll("#corpo-consumo tr");
    
    linhas.forEach(linha => {
        const colunas = linha.querySelectorAll("td");
        if(colunas.length > 0) {
            texto += `📍 *${colunas[0].innerText}*\n`;
            texto += `└ Consumo: ${colunas[5].innerText} em ${colunas[4].innerText}\n`;
            texto += `└ Média: ${colunas[6].innerText}\n\n`;
        }
    });

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

async function telaEstoqueMateriaisEPatrimonios() {
    const container = document.getElementById('app-content');
    
    // 1. Estrutura da Tela (Independente da tela de Uniformes)
    container.innerHTML = `
        <div class="painel-vidro" style="max-width: 1000px; margin: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <button onclick="carregarDashboard()" class="btn-sair-vidro" style="background:#475569; width:100px;">⬅️ VOLTAR</button>
                <h2 style="color:white; margin:0; font-size:1.3rem;">📦 ESTOQUE: MATERIAIS E PATRIMÔNIOS</h2>
                <div style="width:100px;"></div>
            </div>

            <div style="background:rgba(0,0,0,0.2); border-radius:10px; overflow:hidden;">
                <table style="width:100%; border-collapse: collapse; color:white; font-size:0.85rem;">
                    <thead style="background:rgba(255,255,255,0.1);">
                        <tr>
                            <th style="padding:15px; text-align:left;">DESCRIÇÃO DO ITEM</th>
                            <th style="padding:15px; text-align:center;">TIPO</th>
                            <th style="padding:15px; text-align:center;">SALDO REAL</th>
                            <th style="padding:15px; text-align:center;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody id="corpo-tabela-materiais">
                        <tr><td colspan="4" style="padding:20px; text-align:center;">Carregando dados...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/estoque/materiais-e-patrimonios`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const produtos = await res.json();
        const corpo = document.getElementById('corpo-tabela-materiais');

        corpo.innerHTML = produtos.map(p => {
            const critico = Number(p.saldo) <= Number(p.minimo);
            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px 15px; font-weight:bold;">${p.nome}</td>
                    <td style="padding:12px 15px; text-align:center; color:#94a3b8; font-size:0.75rem;">${p.tipo}</td>
                    <td style="padding:12px 15px; text-align:center;">
                        <b style="font-size:1.1rem; color:${critico ? '#f87171' : '#4ade80'};">${p.saldo}</b>
                    </td>
                    <td style="padding:12px 15px; text-align:center;">
                        ${critico ? '<span style="color:#f87171;">🔴 ABAIXO DO MÍNIMO</span>' : '<span style="color:#4ade80;">🟢 DISPONÍVEL</span>'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Erro ao carregar materiais:", err);
    }
}

// Isso garante que o onclick="funcao()" funcione sempre
window.telaVisualizarEstoque = telaVisualizarEstoque;
window.telaAbastecerEstoque = telaAbastecerEstoque;
window.telaAdminGerenciarSolicitacoes = telaAdminGerenciarSolicitacoes;

document.addEventListener('DOMContentLoaded', () => {
    inicializarFundo();
});