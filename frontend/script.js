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

function logout() {
    localStorage.clear();
    window.location.reload();
}

/**
 * FUNÇÃO DASHBOARD UNIFICADA
 * Centraliza o acesso de todos os perfis utilizando o sistema de cards gamificados.
 */
function carregarDashboard() {
    const perfil = localStorage.getItem('perfil') ? localStorage.getItem('perfil').toLowerCase() : null;
    const nome = localStorage.getItem('nome');
    const container = document.getElementById('app-content');
    const loginContainer = document.getElementById('login-container');

    // Proteção de Acesso
    if (!perfil) {
        if (loginContainer) loginContainer.style.display = 'block';
        if (container) container.style.display = 'none';
        return;
    }

    if (loginContainer) loginContainer.style.display = 'none';
    if (container) container.style.display = 'block';

    // 1. Montagem do Cabeçalho e Estrutura Base
    container.innerHTML = `
        <div class="header-app">
            <span class="logo-texto">📦 PATRIMÔNIO SEMED</span>
            <div class="user-info">
                <div class="user-text">Olá, ${nome} <span class="badge-perfil">${perfil.toUpperCase()}</span></div>
                <button onclick="logout()" class="btn-sair-neon">SAIR</button>
            </div>
        </div>
        
        <div id="area-alertas"></div>

        <div class="dashboard-grid" id="grid-principal">
            </div>

        <div class="ferramentas-rodape">
            <button class="btn-utilitario" onclick="telaAlterarSenha()">🔑 ALTERAR SENHA</button>
            ${perfil === 'super' ? `<button class="btn-utilitario" onclick="telaGerenciarUsuarios()">👥 USUÁRIOS</button>` : ''}
        </div>
    `;

    // 2. Definição Dinâmica de Botões por Perfil
    const grid = document.getElementById('grid-principal');
    const botoes = {
        admin: [
            { texto: 'GESTÃO DE PEDIDOS', icon: '📋', acao: () => abrirGestaoPedidosAdmin() },
            { texto: 'ENTRADA DE ESTOQUE', icon: '📥', acao: () => abrirEntradaEstoque() },
            { texto: 'TRANSFERIR PATRIMÔNIO', icon: '🔄', acao: () => abrirTransferenciaPatrimonio() },
            { texto: 'CADASTROS BÁSICOS', icon: '⚙️', acao: () => abrirModalCadastro() },
            { texto: 'INTELIGÊNCIA DE DADOS', icon: '📊', acao: () => abrirDashboardRelatorios() }
        ],
        escola: [
            { texto: 'SOLICITAR UNIFORMES', icon: '👕', acao: () => abrirSolicitacaoUniformes() },
            { texto: 'DEVOLVER UNIFORMES', icon: '🔄', acao: () => abrirDevolucaoUniformes() }

        ],
        estoque: [
            { texto: 'SEPARAÇÃO / REMESSAS', icon: '📦', acao: () => abrirFilaSeparacao() },
            { texto: 'RECEBER DEVOLUÇÕES', icon: '📥', acao: () => abrirFilaRecebimentoDevolucao() },
            { texto: 'ENTRADA DE ESTOQUE', icon: '➕', acao: () => abrirEntradaEstoque() }
        ],
        logistica: [
            { texto: 'SOLICITAR MATERIAIS', icon: '🛠️', acao: () => abrirSolicitacaoMaterial() },
            { texto: 'COLETAS PENDENTES', icon: '🚚', acao: () => abrirFilaColetas() },
            { texto: 'MOVER PATRIMÔNIO', icon: '🔄', acao: () => abrirTransferenciaPatrimonio() }
        ]
    };

    // 3. Injeção dos Botões no Grid
    const listaAcoes = botoes[perfil] || [];
    
    // Regra Global: Adicionar "VER ESTOQUE" para todos, menos para escola
    if (perfil !== 'escola') {
        listaAcoes.push({ texto: 'INVENTÁRIO CENTRAL', icon: '📊', acao: () => abrirVisualizacaoEstoque() });
    }

    listaAcoes.forEach(btn => {
        const card = document.createElement('div');
        card.className = `card-btn-gamelizado ${perfil}-theme`;
        card.innerHTML = `
            <div class="icon-container">${btn.icon}</div>
            <div class="title-container">
                <h3>${btn.texto}</h3>
            </div>
        `;
        card.onclick = btn.acao;
        grid.appendChild(card);
    });

    // 4. Inicializa os Alertas e Badges (Notificações)
    if (typeof atualizarAlertasDevolucao === 'function') {
        atualizarAlertasDevolucao();
    }
}
// No script.js, dentro da lógica de montagem do dashboard:

function popularBotoesDashboard(perfil) {
    const container = document.getElementById('app-content');
    container.innerHTML = `<div class="dashboard-grid"></div>`;
    const grid = container.querySelector('.dashboard-grid');

    const botoes = {
        admin: [
            { texto: 'GESTÃO DE PEDIDOS', icon: '📋', acao: () => abrirGestaoPedidosAdmin() },
            { texto: 'ENTRADA DE ESTOQUE', icon: '📥', acao: () => abrirEntradaEstoque() },
            { texto: 'TRANSFERIR PATRIMÔNIO', icon: '🔄', acao: () => abrirTransferenciaPatrimonio() },
            { texto: 'CADASTROS BÁSICOS', icon: '⚙️', acao: () => abrirModalCadastro() },
            { texto: 'INTELIGÊNCIA DE DADOS', icon: '📊', acao: () => abrirDashboardRelatorios() }
        ],
        escola: [
            { texto: 'SOLICITAR UNIFORMES', icon: '👕', acao: () => abrirSolicitacaoUniformes() },
            { texto: 'DEVOLVER UNIFORMES', icon: '🔄', acao: () => abrirDevolucaoUniformes() }
        ],
        estoque: [
            { texto: 'SEPARAÇÃO / REMESSAS', icon: '📦', acao: () => abrirFilaSeparacao() },
            { texto: 'RECEBER DEVOLUÇÕES', icon: '📥', acao: () => abrirFilaRecebimentoDevolucao() },
            { texto: 'ENTRADA DE ESTOQUE', icon: '➕', acao: () => abrirEntradaEstoque() }
        ],
        logistica: [
            { texto: 'SOLICITAR MATERIAIS', icon: '🛠️', acao: () => abrirSolicitacaoMaterial() },
            { texto: 'COLETAS PENDENTES', icon: '🚚', acao: () => abrirFilaColetas() },
            { texto: 'MOVER PATRIMÔNIO', icon: '🔄', acao: () => abrirTransferenciaPatrimonio() }
        ]
    };

    botoes[perfil]?.forEach(btn => {
        const card = document.createElement('div');
        card.className = 'card-btn-gamelizado';
        card.innerHTML = `<span>${btn.icon}</span><h3>${btn.texto}</h3>`;
        card.onclick = btn.acao;
        grid.appendChild(card);
    });
}

async function abrirSolicitacaoUniformes() {
    const res = await fetch(`${API_URL}/pedidos/uniformes/grades`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const listaProdutos = await res.json();

    // Separamos os produtos: Tênis vs Outros
    const tenis = listaProdutos.filter(p => p.nome.includes('TENIS'));
    const vestuario = listaProdutos.filter(p => !p.nome.includes('TENIS'));

    let html = `
        <div class="modal-uniformes-container">
            <h2 class="titulo-gamelizado">SOLICITAÇÃO DE MISSÃO: UNIFORMES</h2>
            
            ${renderizarBlocoGrade("VESTUÁRIO E ACESSÓRIOS", vestuario)}
            
            ${renderizarBlocoGrade("CALÇADOS (TÊNIS)", tenis)}

            <div class="footer-modal">
                <button class="btn-confirmar-missao" onclick="enviarSolicitacaoGeral()">ENVIAR SOLICITAÇÃO</button>
            </div>
        </div>
    `;

    abrirModalGamelizado(html);
}

function renderizarBlocoGrade(titulo, produtos) {
    if (produtos.length === 0) return '';

    // Pegamos todos os tamanhos únicos desta categoria para o cabeçalho
    const todosTamanhos = [...new Set(produtos.flatMap(p => p.tamanhos))];

    return `
        <div class="bloco-grade">
            <h3 class="subtitulo-grade">${titulo}</h3>
            <div class="tabela-wrapper">
                <table class="tabela-uniformes-horizontal">
                    <thead>
                        <tr>
                            <th class="col-produto">PRODUTO</th>
                            ${todosTamanhos.map(t => `<th>${t}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr>
                                <td class="nome-item">${p.nome}</td>
                                ${todosTamanhos.map(t => {
                                    const possuiTamanho = p.tamanhos.includes(t);
                                    return `<td>
                                        <input type="number" 
                                            class="input-quantidade-grade" 
                                            data-id="${p.id}" 
                                            data-tamanho="${t}"
                                            ${!possuiTamanho ? 'disabled style="background: #222;"' : 'placeholder="0"'}
                                            min="0">
                                    </td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

}

async function enviarSolicitacaoGeral() {
    const inputs = document.querySelectorAll('.input-quantidade-grade');
    const itensParaEnviar = [];

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itensParaEnviar.push({
                produto_id: input.dataset.id,
                tamanho: input.dataset.tamanho,
                quantidade: qtd
            });
        }
    });

    if (itensParaEnviar.length === 0) {
        return alert("POR FAVOR, INSIRA A QUANTIDADE DE PELO MENOS UM ITEM.");
    }

    if (!confirm(`CONFIRMAR ENVIO DE SOLICITAÇÃO COM ${itensParaEnviar.length} VARIAÇÕES DE TAMANHO?`)) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/escola`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ itens: itensParaEnviar })
        });

        if (res.ok) {
            alert("SOLICITAÇÃO ENVIADA COM SUCESSO! AGUARDANDO AUTORIZAÇÃO DA ADMINISTRAÇÃO.");
            fecharModalGamelizado(); // Fecha o modal da grade
            carregarDashboard(); // Atualiza a tela principal
        } else {
            const erro = await res.json();
            throw new Error(erro.error);
        }
    } catch (err) {
        alert("FALHA NA MISSÃO: " + err.message);
    }
}

// No script.js
async function abrirGestaoPedidosAdmin() {
    const res = await fetch(`${API_URL}/pedidos/pendentes-autorizacao`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const pedidos = await res.json();

    let html = `<div class="lista-admin-pedidos">`;
    pedidos.forEach(p => {
        html += `
            <div class="card-pedido-pendente" onclick="visualizarDetalheParaAutorizar(${p.id})">
                <div class="info">
                    <strong>${p.escola_nome}</strong>
                    <span>SOLICITADO EM: ${new Date(p.data_criacao).toLocaleString()}</span>
                </div>
                <div class="status-badge">AGUARDANDO</div>
            </div>
        `;
    });
    html += `</div>`;

    abrirModalGamelizado("CENTRAL DE AUTORIZAÇÕES", html);
}

async function visualizarDetalheParaAutorizar(idPedido) {
    const res = await fetch(`${API_URL}/pedidos/detalhes/${idPedido}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const dados = await res.json(); // Retorna { escola, data, itens: [...] }

    // Separar itens por categoria para manter a organização das grades
    const tenis = dados.itens.filter(p => p.nome.includes('TENIS'));
    const vestuario = dados.itens.filter(p => !p.nome.includes('TENIS'));

    let html = `
        <div class="modal-admin-gestao">
            <h2 class="titulo-gamelizado">REVISÃO DE MISSÃO: #${idPedido}</h2>
            <p class="info-escola">ORIGEM: <strong>${dados.escola}</strong></p>
            
            ${renderizarGradeEdicao("VESTUÁRIO", vestuario)}
            ${renderizarGradeEdicao("CALÇADOS", tenis)}

            <div class="painel-comando-admin">
                <button class="btn-acao-gamelizado btn-aprovar" onclick="processarAutorizacao(${idPedido}, 'AUTORIZAR')">
                    AUTORIZAR & BAIXAR ESTOQUE
                </button>
                <button class="btn-acao-gamelizado btn-recusar" onclick="processarAutorizacao(${idPedido}, 'RECUSAR')">
                    ABORTAR MISSÃO
                </button>
            </div>
        </div>
    `;

    abrirModalGamelizado(html);
}

function renderizarGradeEdicao(titulo, itens) {
    if (itens.length === 0) return '';
    const tamanhos = [...new Set(itens.map(i => i.tamanho))];

    // Agrupar itens por produto para a linha horizontal
    const produtosAgrupados = itens.reduce((acc, it) => {
        if (!acc[it.produto_id]) acc[it.produto_id] = { nome: it.nome, id: it.produto_id, grades: {} };
        acc[it.produto_id].grades[it.tamanho] = { qtd: it.quantidade_solicitada, id_item: it.id };
        return acc;
    }, {});

    return `
        <div class="bloco-grade-edicao">
            <h3 class="neon-text-small">${titulo}</h3>
            <div class="tabela-wrapper">
                <table class="tabela-gestao-admin">
                    <thead>
                        <tr>
                            <th class="sticky-col">PRODUTO</th>
                            ${tamanhos.map(t => `<th>${t}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.values(produtosAgrupados).map(p => `
                            <tr>
                                <td class="sticky-col">${p.nome}</td>
                                ${tamanhos.map(t => {
                                    const info = p.grades[t];
                                    return `<td>
                                        <input type="number" 
                                            class="input-edicao-admin" 
                                            data-id-item="${info ? info.id_item : ''}"
                                            value="${info ? info.qtd : 0}"
                                            ${!info ? 'disabled' : ''}>
                                    </td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function processarAutorizacao(idPedido, acao) {
    const confirmacao = confirm(`DESEJA ${acao} ESTA SOLICITAÇÃO?`);
    if (!confirmacao) return;

    let payload = { idPedido, acao, itensEditados: [] };

    if (acao === 'AUTORIZAR') {
        const inputs = document.querySelectorAll('.input-edicao-admin:not(:disabled)');
        inputs.forEach(input => {
            payload.itensEditados.push({
                id_item: input.dataset.idItem,
                quantidade: parseInt(input.value)
            });
        });
    }

    try {
        const res = await fetch(`${API_URL}/pedidos/admin/autorizar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(acao === 'AUTORIZAR' ? "ESTOQUE ATUALIZADO E PEDIDO ENVIADO AO ESTOQUE!" : "SOLICITAÇÃO RECUSADA.");
            fecharModalGamelizado();
            abrirGestaoPedidosAdmin(); // Recarrega a lista
        }
    } catch (err) {
        alert("ERRO NO PROCESSAMENTO: " + err.message);
    }
}

async function abrirEntradaEstoque() {
    const res = await fetch(`${API_URL}/catalogo/produtos`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const produtos = await res.json();

    let html = `
        <div class="modal-entrada">
            <h2 class="neon-text">ABASTECER ESTOQUE CENTRAL</h2>
            <select id="select-produto-entrada" onchange="renderizarCamposEntrada(this.value)" class="input-gamelizado">
                <option value="">SELECIONE O PRODUTO...</option>
                ${produtos.map(p => `<option value='${JSON.stringify(p)}'>${p.nome} (${p.tipo})</option>`).join('')}
            </select>
            <div id="campos-dinamicos-entrada"></div>
            <button class="btn-acao-gamelizado" onclick="salvarEntradaEstoque()">EFETUAR ENTRADA</button>
        </div>
    `;
    abrirModalGamelizado(html);
}

function renderizarCamposEntrada(produtoJson) {
    const produto = JSON.parse(produtoJson);
    const container = document.getElementById('campos-dinamicos-entrada');
    container.innerHTML = ""; // Limpa anterior

    if (produto.tipo === 'PATRIMONIO') {
        container.innerHTML = `
            <div class="alerta-gamelizado">MODO PATRIMÔNIO: INSIRA UM NÚMERO DE SÉRIE POR LINHA</div>
            <textarea id="input-series-lote" class="textarea-gamelizado" 
                placeholder="EXEMPLO:\nABC-123\nABC-124\nABC-125" rows="10"></textarea>
        `;
    } else if (produto.tipo === 'UNIFORMES') {
        // Grade horizontal de uniformes (conforme regra anterior)
        container.innerHTML = `<div id="grade-entrada-uniforme"></div>`;
        gerarGradeEntradaUniforme(produto.id); 
    } else {
        // Material comum
        container.innerHTML = `
            <input type="number" id="qtd-simples" class="input-gamelizado" placeholder="QUANTIDADE TOTAL">
        `;
    }
}

async function salvarEntradaEstoque() {
    const prodData = JSON.parse(document.getElementById('select-produto-entrada').value);
    let payload = { produto_id: prodData.id };

    if (prodData.tipo === 'PATRIMONIO') {
        const texto = document.getElementById('input-series-lote').value;
        payload.series = texto.split('\n').filter(s => s.trim() !== "");
        if (payload.series.length === 0) return alert("INSIRA PELO MENOS UM NÚMERO DE SÉRIE");
        
        await fetch(`${API_URL}/api/cadastros/patrimonio/massa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });
    }
    // ... lógica para uniformes e material
    alert("ENTRADA CONCLUÍDA!");
    fecharModalGamelizado();
}

async function abrirVisualizacaoEstoque() {
    try {
        // Busca a lista geral de produtos e seus saldos totais
        const res = await fetch(`${API_URL}/estoque/central`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (!res.ok) throw new Error("Erro ao buscar dados do estoque.");
        const estoque = await res.json();

        let html = `
            <div class="header-tarefa">
                <button onclick="carregarDashboard()" class="btn-voltar">⬅ VOLTAR AO DASHBOARD</button>
                <h2 class="neon-text">INVENTÁRIO DO ESTOQUE CENTRAL</h2>
            </div>
            
            <div class="tabela-wrapper-vertical">
                <table class="tabela-detalhes">
                    <thead>
                        <tr>
                            <th>PRODUTO</th>
                            <th>TIPO</th>
                            <th>SALDO TOTAL</th>
                            <th>ESTADO</th>
                            <th>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${estoque.map(item => {
                            // Lógica de Alerta de Estoque Baixo
                            const isBaixo = (item.tipo === 'MATERIAL' && item.alerta_baixo) || 
                                          (item.tipo === 'UNIFORMES' && item.quantidade_estoque < 20);
                            
                            return `
                            <tr class="${isBaixo ? 'estoque-critico' : ''}">
                                <td>${item.nome}</td>
                                <td class="tipo-tag ${item.tipo.toLowerCase()}">${item.tipo}</td>
                                <td style="font-weight:bold; font-size: 1.1em;">${item.quantidade_estoque}</td>
                                <td>${isBaixo ? '⚠️ REPOR' : '✅ OK'}</td>
                                <td>
                                    ${item.tipo === 'UNIFORMES' ? 
                                        `<button class="btn-tabela-neon" onclick="verGradeEstoqueDetalhada(${item.id}, '${item.nome}')">VER GRADE</button>` : 
                                      item.tipo === 'PATRIMONIO' ? 
                                        `<button class="btn-tabela-neon" onclick="verSeriesPatrimonio(${item.id}, '${item.nome}')">VER SÉRIES</button>` : 
                                        '---'}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('app-content').innerHTML = html;
        window.scrollTo(0, 0); // Garante que a tela comece no topo

    } catch (err) {
        alert("FALHA NA BUSCA DE INVENTÁRIO: " + err.message);
    }
}

// --- FUNÇÕES DE DETALHAMENTO ---

// 1. Visualizar Grade de Uniformes
async function verGradeEstoqueDetalhada(produto_id, nome) {
    const res = await fetch(`${API_URL}/estoque/grade-uniformes`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    const grade = data[nome]; // O backend agrupa pelo nome do produto

    if (!grade) return alert("Grade não encontrada para este uniforme.");

    let html = `<div class="detalhe-popup"><h3>GRADE: ${nome}</h3><div class="grid-grade">`;
    for (const [tamanho, qtd] of Object.entries(grade)) {
        html += `<div class="grade-box"><span>${tamanho}</span><strong>${qtd}</strong></div>`;
    }
    html += `</div></div>`;
    
    // Usando seu sistema de modal/alerta gamificado
    abrirModalGamelizado("DETALHE DE TAMANHOS", html);
}

// 2. Visualizar Números de Série de Patrimônio
async function verSeriesPatrimonio(produto_id, nome) {
    const res = await fetch(`${API_URL}/api/cadastros/patrimonio/listar/${produto_id}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const series = await res.json();

    let html = `
        <div class="detalhe-popup">
            <h3>SÉRIES EM ESTOQUE: ${nome}</h3>
            <div class="lista-series-scroll">
                <ul>
                    ${series.map(s => `<li><i class="fas fa-barcode"></i> ${s.numero_serie} <small>(${s.status})</small></li>`).join('')}
                </ul>
            </div>
        </div>`;
    
    abrirModalGamelizado("LISTA DE PATRIMÔNIOS", html);
}

async function abrirFilaSeparacao() {
    const res = await fetch(`${API_URL}/pedidos/para-separar`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const pedidos = await res.json();

    if (pedidos.length === 0) {
        return alert("NENHUM PEDIDO AGUARDANDO SEPARAÇÃO NO MOMENTO.");
    }

    let html = `
        <div class="modal-estoque-separacao">
            <h2 class="neon-text">FILA DE SEPARAÇÃO (ESTOQUE)</h2>
            <div class="grid-pedidos-separar">
                ${pedidos.map(p => `
                    <div class="card-separacao" onclick="prepararRemessa(${p.id})">
                        <div class="card-header">PEDIDO #${p.id}</div>
                        <div class="card-body">
                            <p><strong>DESTINO:</strong> ${p.escola_nome}</p>
                            <p><strong>ITENS:</strong> ${p.total_itens}</p>
                        </div>
                        <div class="card-footer">CLIQUE PARA SEPARAR</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    abrirModalGamelizado(html);
}

async function prepararRemessa(idPedido) {
    const res = await fetch(`${API_URL}/pedidos/detalhes/${idPedido}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const dados = await res.json();

    let html = `
        <div class="modal-remessa">
            <h2 class="neon-text">PREPARAR REMESSA: #${idPedido}</h2>
            <div class="info-remessa-superior">
                <label>VOLUMES (CAIXAS):</label>
                <input type="number" id="volumes-remessa" class="input-gamelizado" value="1" min="1">
            </div>
            
            <table class="tabela-separacao">
                <thead>
                    <tr>
                        <th>PRODUTO</th>
                        <th>TAMANHO</th>
                        <th>AUTORIZADO</th>
                        <th>JÁ ENVIADO</th>
                        <th>NESTA REMESSA</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.itens.map(it => {
                        const falta = it.quantidade_solicitada - it.quantidade_enviada;
                        return `
                        <tr>
                            <td>${it.nome}</td>
                            <td>${it.tamanho || '-'}</td>
                            <td>${it.quantidade_solicitada}</td>
                            <td>${it.quantidade_enviada}</td>
                            <td>
                                <input type="number" 
                                    class="input-qtd-remessa" 
                                    data-id-item="${it.id}" 
                                    max="${falta}" 
                                    value="${falta}" 
                                    min="0">
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            
            <button class="btn-acao-gamelizado" onclick="confirmarSaidaRemessa(${idPedido})">
                LIBERAR PARA COLETA (LOGÍSTICA)
            </button>
        </div>
    `;
    abrirModalGamelizado(html);
}

async function prepararRemessa(idPedido) {
    const res = await fetch(`${API_URL}/pedidos/detalhes/${idPedido}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const dados = await res.json();

    let html = `
        <div class="modal-remessa">
            <h2 class="neon-text">PREPARAR REMESSA: #${idPedido}</h2>
            <div class="info-remessa-superior">
                <label>VOLUMES (CAIXAS):</label>
                <input type="number" id="volumes-remessa" class="input-gamelizado" value="1" min="1">
            </div>
            
            <table class="tabela-separacao">
                <thead>
                    <tr>
                        <th>PRODUTO</th>
                        <th>TAMANHO</th>
                        <th>AUTORIZADO</th>
                        <th>JÁ ENVIADO</th>
                        <th>NESTA REMESSA</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.itens.map(it => {
                        const falta = it.quantidade_solicitada - it.quantidade_enviada;
                        return `
                        <tr>
                            <td>${it.nome}</td>
                            <td>${it.tamanho || '-'}</td>
                            <td>${it.quantidade_solicitada}</td>
                            <td>${it.quantidade_enviada}</td>
                            <td>
                                <input type="number" 
                                    class="input-qtd-remessa" 
                                    data-id-item="${it.id}" 
                                    max="${falta}" 
                                    value="${falta}" 
                                    min="0">
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            
            <button class="btn-acao-gamelizado" onclick="confirmarSaidaRemessa(${idPedido})">
                LIBERAR PARA COLETA (LOGÍSTICA)
            </button>
        </div>
    `;
    abrirModalGamelizado(html);
}

async function abrirFilaColetas() {
    const res = await fetch(`${API_URL}/pedidos/logistica/liberados`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const coletas = await res.json();

    let html = `
        <div class="modal-logistica">
            <h2 class="neon-text">MISSÕES DE TRANSPORTE DISPONÍVEIS</h2>
            <div class="lista-coletas">
                ${coletas.map(c => `
                    <div class="card-logistica">
                        <p><strong>PEDIDO:</strong> #${c.id}</p>
                        <p><strong>DESTINO:</strong> ${c.escola_nome}</p>
                        <p><strong>VOLUMES:</strong> ${c.volumes}</p>
                        <button class="btn-acao-gamelizado" onclick="iniciarTransporte(${c.id})">
                            INICIAR COLETA 🚚
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    abrirModalGamelizado(html);
}

async function confirmarRecebimento(idPedido) {
    if (!confirm("CONFIRMA QUE TODOS OS VOLUMES CHEGARAM À UNIDADE?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/escola/receber/${idPedido}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.statusFinal === 'ENTREGUE') {
                alert("MISSÃO CONCLUÍDA! PEDIDO FINALIZADO.");
            } else {
                alert("REMESSA PARCIAL RECEBIDA. O RESTANTE VOLTOU PARA A FILA DE SEPARAÇÃO.");
            }
            carregarDashboard();
        }
    } catch (err) {
        alert("ERRO AO CONFIRMAR RECEBIMENTO: " + err.message);
    }
}

async function abrirTransferenciaPatrimonio() {
    const resLocais = await fetch(`${API_URL}/catalogo/locais`); // Rota que você já tem para listar escolas
    const locais = await resLocais.json();

    let html = `
        <div class="modal-transferencia">
            <h2 class="neon-text">TRANSFERÊNCIA DE PATRIMÔNIO</h2>
            
            <div class="busca-patrimonio">
                <input type="text" id="busca-serie" placeholder="DIGITE O NÚMERO DE SÉRIE OU PLAQUETA" class="input-gamelizado">
                <button onclick="buscarDadosPatrimonio()" class="btn-pequeno">BUSCAR</button>
            </div>

            <div id="resultado-busca-patrimonio" style="margin-top:20px; display:none;">
                <div class="card-info-patrimonio">
                    <p><strong>ITEM:</strong> <span id="info-nome-prod"></span></p>
                    <p><strong>LOCAL ATUAL:</strong> <span id="info-local-atual"></span></p>
                </div>

                <label>DESTINO DA TRANSFERÊNCIA:</label>
                <select id="select-destino-patrimonio" class="input-gamelizado">
                    <option value="">SELECIONE O DESTINO...</option>
                    ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                </select>

                <button class="btn-acao-gamelizado" id="btn-confirmar-transf">CONFIRMAR MOVIMENTAÇÃO</button>
            </div>
        </div>
    `;
    abrirModalGamelizado(html);
}

let patrimonioSelecionadoId = null;

async function buscarDadosPatrimonio() {
    const serie = document.getElementById('busca-serie').value;
    if (!serie) return;

    const res = await fetch(`${API_URL}/api/cadastros/patrimonio/buscar?serie=${serie}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (res.ok) {
        const p = await res.json();
        patrimonioSelecionadoId = p.id;
        document.getElementById('info-nome-prod').innerText = p.produto_nome;
        document.getElementById('info-local-atual').innerText = p.local_nome;
        document.getElementById('resultado-busca-patrimonio').style.display = 'block';
        
        document.getElementById('btn-confirmar-transf').onclick = () => executarTransferencia();
    } else {
        alert("PATRIMÔNIO NÃO LOCALIZADO NO SISTEMA.");
    }
}

async function executarTransferencia() {
    const destinoId = document.getElementById('select-destino-patrimonio').value;
    if (!destinoId) return alert("SELECIONE O LOCAL DE DESTINO.");

    const res = await fetch(`${API_URL}/api/cadastros/patrimonio/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ 
            patrimonio_id: patrimonioSelecionadoId, 
            local_destino_id: destinoId 
        })
    });

    if (res.ok) {
        alert("MOVIMENTAÇÃO REGISTRADA NO SISTEMA!");
        fecharModalGamelizado();
    }
}

async function abrirSolicitacaoMaterial() {
    const res = await fetch(`${API_URL}/catalogo/produtos`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const produtos = await res.json();
    const materiais = produtos.filter(p => p.tipo === 'MATERIAL');

    let html = `
        <div class="modal-solicitacao-material">
            <h2 class="neon-text">REQUISIÇÃO DE MATERIAIS</h2>
            <div class="lista-materiais-vertical">
                ${materiais.map(m => `
                    <div class="item-material-card">
                        <div class="info">
                            <span class="nome">${m.nome}</span>
                            <span class="estoque-disponivel">Disponível: ${m.quantidade_estoque}</span>
                        </div>
                        <div class="controlo-qtd">
                            <input type="number" 
                                class="input-material-qtd" 
                                data-id="${m.id}" 
                                placeholder="0" 
                                min="0">
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="btn-acao-gamelizado" onclick="enviarSolicitacaoMaterial()">
                ENVIAR PARA APROVAÇÃO ADMIN 🛡️
            </button>
        </div>
    `;
    abrirModalGamelizado(html);
}

async function enviarSolicitacaoMaterial() {
    const inputs = document.querySelectorAll('.input-material-qtd');
    const itens = [];

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: input.dataset.id,
                quantidade: qtd
            });
        }
    });

    if (itens.length === 0) return alert("INSIRA A QUANTIDADE DE PELO MENOS UM ITEM.");

    try {
        const res = await fetch(`${API_URL}/pedidos/logistica`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ itens })
        });

        if (res.ok) {
            alert("SOLICITAÇÃO DE MATERIAL ENVIADA COM SUCESSO!");
            fecharModalGamelizado();
            carregarDashboard();
        }
    } catch (err) {
        alert("ERRO AO ENVIAR SOLICITAÇÃO: " + err.message);
    }
}

async function abrirDevolucaoUniformes() {
    // Reutilizamos a rota de grades que criamos anteriormente
    const res = await fetch(`${API_URL}/pedidos/uniformes/grades`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const listaProdutos = await res.json();

    const tenis = listaProdutos.filter(p => p.nome.includes('TENIS'));
    const vestuario = listaProdutos.filter(p => !p.nome.includes('TENIS'));

    let html = `
        <div class="modal-uniformes-container">
            <h2 class="neon-text">SOLICITAR DEVOLUÇÃO AO CENTRAL</h2>
            <div class="alerta-gamelizado">INFORME OS ITENS QUE ESTÃO SAINDO DA ESCOLA</div>
            
            ${renderizarBlocoGrade("VESTUÁRIO", vestuario, "input-devolucao")}
            ${renderizarBlocoGrade("CALÇADOS", tenis, "input-devolucao")}

            <div class="footer-modal">
                <button class="btn-confirmar-missao" onclick="enviarDevolucaoGeral()">SOLICITAR COLETA DE DEVOLUÇÃO</button>
            </div>
        </div>
    `;
    abrirModalGamelizado(html);
}

async function enviarDevolucaoGeral() {
    const inputs = document.querySelectorAll('.input-devolucao');
    const itens = [];

    inputs.forEach(input => {
        const qtd = parseInt(input.value);
        if (qtd > 0) {
            itens.push({
                produto_id: input.dataset.id,
                tamanho: input.dataset.tamanho,
                quantidade: qtd
            });
        }
    });

    if (itens.length === 0) return alert("INSIRA A QUANTIDADE DOS ITENS PARA DEVOLVER.");

    const res = await fetch(`${API_URL}/pedidos/devolucao/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ itens })
    });

    if (res.ok) {
        alert("SOLICITAÇÃO DE DEVOLUÇÃO REGISTRADA! AGUARDANDO AUTORIZAÇÃO DO ADMIN.");
        fecharModalGamelizado();
    }
}

// No script.js
async function conferirRecebimentoDevolucao(idPedido) {
    if (!confirm("CONFIRMA O RECEBIMENTO FÍSICO DESTES ITENS NO ESTOQUE CENTRAL?")) return;

    const res = await fetch(`${API_URL}/pedidos/devolucao/receber/${idPedido}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (res.ok) {
        alert("ESTOQUE CENTRAL ATUALIZADO COM OS ITENS DEVOLVIDOS!");
        carregarDashboard();
    }
}

async function atualizarAlertasDevolucao() {
    const res = await fetch(`${API_URL}/pedidos/alertas/devolucoes`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const alertas = await res.json();

    // 1. Alerta para o ADMIN (Pendentes de Autorização)
    const pendentesAdmin = alertas.find(a => a.status === 'DEVOLUCAO_PENDENTE')?.total || 0;
    exibirBadgeNoBotao('GESTÃO DE PEDIDOS', pendentesAdmin);

    // 2. Alerta para a LOGÍSTICA (Aguardando Coleta na Escola)
    const prontosColeta = alertas.find(a => a.status === 'DEVOLUCAO_AUTORIZADA')?.total || 0;
    exibirBadgeNoBotao('COLETAS PENDENTES', prontosColeta);

    // 3. Alerta para o ESTOQUE (Carga em Trânsito para o Central)
    const emTransito = alertas.find(a => a.status === 'DEVOLUCAO_EM_TRANSITO')?.total || 0;
    exibirBadgeNoBotao('SEPARAÇÃO / REMESSAS', emTransito);
}

function exibirBadgeNoBotao(textoBotao, valor) {
    const botoes = document.querySelectorAll('.card-btn-gamelizado');
    botoes.forEach(btn => {
        // Verifica se o texto do botão contém a funcionalidade alvo
        if (btn.innerText.toUpperCase().includes(textoBotao.toUpperCase())) {
            let badge = btn.querySelector('.badge-alerta');
            
            if (valor > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'badge-alerta';
                    btn.appendChild(badge);
                }
                badge.innerText = valor;
            } else if (badge) {
                badge.remove(); // Remove se o contador chegar a zero
            }
        }
    });
}

async function abrirDashboardRelatorios() {
    const res = await fetch(`${API_URL}/pedidos/relatorios/estatisticas`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const dados = await res.json();

    let html = `
        <div class="dashboard-relatorios">
            <h2 class="neon-text">DATA CENTER: ESTATÍSTICAS DA MISSÃO</h2>
            
            <div class="resumo-cards">
                <div class="mini-card">
                    <span class="label">UNIFORMES (MÊS)</span>
                    <span class="valor-neon">${dados.totalUniformes}</span>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-container">
                    <h3>RANKING DE DEMANDA (ESCOLAS)</h3>
                    <canvas id="chartRanking"></canvas>
                </div>
                <div class="chart-container">
                    <h3>STOCK CRÍTICO (ALERTA)</h3>
                    <canvas id="chartEstoque"></canvas>
                </div>
            </div>
        </div>
    `;

    abrirModalGamelizado(html);

    // Inicializar Gráficos após o modal abrir
    setTimeout(() => {
        renderizarGraficos(dados);
    }, 100);
}

function renderizarGraficos(dados) {
    // Gráfico de Ranking (Barras)
    new Chart(document.getElementById('chartRanking'), {
        type: 'bar',
        data: {
            labels: dados.ranking.map(r => r.nome),
            datasets: [{
                label: 'Total de Pedidos',
                data: dados.ranking.map(r => r.total),
                backgroundColor: '#00f2ff'
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });

    // Gráfico de Stock Crítico (Pizza/Doughnut)
    new Chart(document.getElementById('chartEstoque'), {
        type: 'doughnut',
        data: {
            labels: dados.criticos.map(c => c.nome),
            datasets: [{
                data: dados.criticos.map(c => c.quantidade_estoque),
                backgroundColor: ['#ff0055', '#ffaa00', '#ff00ff', '#00ff88']
            }]
        }
    });
}