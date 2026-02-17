const LOCAL_API_URL = 'https://admsemed.paiva.api.br/api';
let idSel = null, itemNomeSel = "", saldoSel = 0, alertaSel = 0;

async function carregarDados(aba) {
    const main = document.getElementById('tab-content');
    const hEstoque = document.getElementById('header-estoque');
    const hHistorico = document.getElementById('header-historico');
    const actions = document.getElementById('item-actions');
    
    hEstoque.classList.add('hidden');
    hHistorico.classList.add('hidden');
    if (actions) actions.classList.add('hidden');
    
    main.innerHTML = '<p style="padding:20px">A carregar...</p>';

    try {
        const res = await fetch(`${LOCAL_API_URL}/${aba}`);
        const dados = await res.json();
        if (aba === 'item') {
            hEstoque.classList.remove('hidden');
            if (actions) actions.classList.remove('hidden');

            // Filtra para exibir apenas registros ativos ('A')
            const ativos = dados.filter(i => i.status === 'A' || i.status === null);

            let html = '<table class="data-table"><tbody>';
            ativos.forEach(i => {
                const isBaixo = i.quantidade <= (i.alerta || 0);
                html += `<tr onclick="selecionarLinha(this, ${i.id}, '${i.item}', ${i.quantidade}, ${i.alerta})" class="${isBaixo ? 'estoque-baixo-row' : ''}">
                    <td style="width:50%"><b>${i.item}</b></td>
                    <td style="width:22%; text-align:left">${i.quantidade}</td>
                    <td style="width:22%; text-align:left">${i.alerta}</td>
                    <td style="width:6%; text-align:center">
                        <i class="fas fa-chevron-right" style="cursor:pointer; color:var(--primary)" onclick="event.stopPropagation(); abrirPanorama('${i.item}')"></i>
                    </td>
                </tr>`;
            });
            main.innerHTML = html + '</tbody></table>';
        }
        // ABA: HISTÓRICO (Com Lógica de Auditoria Azul/Vermelho)
        else if (aba === 'historico') {
            hHistorico.classList.remove('hidden');
            
            let html = '<table class="data-table"><tbody>';
            dados.forEach(h => {
                const dataFmt = new Date(h.data).toLocaleDateString('pt-BR');
                
                // LÓGICA DE CORES DE AUDITORIA
                let auditClass = '';
                let destinoTexto = h.destino;

                if (h.tipo === 'DIFERENÇA INVENTÁRIO') {
                    if (h.destino === 'AUDIT_RED') {
                        auditClass = 'audit-red';
                        destinoTexto = 'FALTA (PERDA)';
                    } else if (h.destino === 'AUDIT_BLUE') {
                        auditClass = 'audit-blue';
                        destinoTexto = 'SOBRA (ENTRADA)';
                    }
                }

                html += `<tr class="${auditClass}">
                    <td style="width:12%">${dataFmt}</td>
                    <td style="width:25%">${h.nome_item}</td>
                    <td style="width:15%; text-align:center"><span>${h.tipo}</span></td>
                    <td style="width:10%; text-align:center">${h.quant}</td>
                    <td style="width:13%; text-align:center">${h.num_nota || '-'}</td>
                    <td style="width:25%; text-align:center">${destinoTexto}</td>
                </tr>`;
            });
            main.innerHTML = html + '</tbody></table>';
        }
        else {
            let html = `<table class="data-table"><tbody>`;
            dados.forEach(d => { 
                html += `<tr><td style="padding:15px; border-bottom:1px solid #eee"><i class="fas fa-tag"></i> ${d.nome || d.categoria || d.local}</td></tr>`; 
            });
            main.innerHTML = html + '</tbody></table>';
        }
    } catch (err) { 
        main.innerHTML = `<p style="padding:20px; color:red">Erro ao carregar dados.</p>`; 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    verificarSessao();
    
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.onclick = realizarLogin;
    }

    // Filtro de busca
    const inputBusca = document.getElementById('inputBusca');
    if (inputBusca) {
        inputBusca.oninput = () => {
            const termo = inputBusca.value.toLowerCase();
            document.querySelectorAll('.data-table tbody tr').forEach(tr => {
                tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none';
            });
        };
    }
});

async function realizarLogin() {
    const usuarioInput = document.getElementById('login-usuario').value;
    const senhaInput = document.getElementById('login-senha').value;

    if (!usuarioInput || !senhaInput) {
        alert("Preencha todos os campos!");
        return;
    }

    try {
        const res = await fetch(`${LOCAL_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('session', JSON.stringify(data));
            window.location.reload();
        } else {
            const errorData = await res.json();
            alert("Erro no login: " + (errorData.error || "Usuário ou senha incorretos"));
        }
    } catch (err) {
        console.error("Erro na requisição de login:", err);
        alert("Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 3001.");
    }
}

function verificarSessao() {
    const s = JSON.parse(localStorage.getItem('session'));
    if (s) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = s.usuario;
        carregarDados('item');
    }
}

function selecionarLinha(el, id, nome, saldo, alerta) {
    document.querySelectorAll('.data-table tr').forEach(tr => tr.classList.remove('selected'));
    el.classList.add('selected');
    idSel = id;
    itemNomeSel = nome;
    saldoSel = saldo;
    alertaSel = alerta;
    document.getElementById('item-actions').classList.remove('hidden');
}

function togglePrintMenu() {
    document.getElementById('print-menu').classList.toggle('hidden');
}

async function prepararMovimentacaoSelecionada(tipo) {
    if (!idSel) return alert("Selecione um item primeiro!");
    const modal = document.getElementById('modalEstoque');
    const corpo = document.getElementById('corpoModal');
    document.getElementById('modalTitulo').innerText = `${tipo}: ${itemNomeSel}`;

    let htmlExtra = "";
    if (tipo === 'ENTRADA') {
        htmlExtra = `<input type="text" id="mov-nf" placeholder="Nº da Nota Fiscal">`;
    } else {
        // CORREÇÃO 4: Busca locais para a caixa de listagem (dropdown)
        try {
            const resLocais = await fetch(`${LOCAL_API_URL}/local`);
            const locais = await resLocais.json();
            const options = locais.map(l => `<option value="${l.nome}">${l.nome}</option>`).join('');
            
            htmlExtra = `
                <label style="font-size:0.8rem; color:#666">Destino:</label>
                <select id="mov-destino-sel">
                    <option value="">-- Selecione o Local --</option>
                    ${options}
                </select>`;
        } catch (e) {
            htmlExtra = `<input type="text" id="mov-destino" placeholder="Destino (Erro ao carregar lista)">`;
        }
    }

    corpo.innerHTML = `<input type="number" id="mov-qtd" placeholder="Quantidade"> ${htmlExtra}`;
    
    document.getElementById('btnConfirmarGeral').onclick = async () => {
        const q = document.getElementById('mov-qtd').value;
        const nf = document.getElementById('mov-nf')?.value || null;
        // Pega o valor do select ou do input manual caso falhe
        const destino = document.getElementById('mov-destino-sel')?.value || document.getElementById('mov-destino')?.value || 'ESTOQUE';
        const s = JSON.parse(localStorage.getItem('session'));

        if (!q) return alert("Informe a quantidade!");

        const res = await fetch(`${LOCAL_API_URL}/movimentacao`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ item_id: idSel, tipo, quantidade: q, responsavel: s.usuario, destino_nome: destino, num_nota: nf })
        });

        if (res.ok) { fecharModal(); carregarDados('item'); }
    };
    modal.classList.remove('hidden');
}

async function executarMovimentacao(tipo) {
    const q = document.getElementById('mov-qtd').value;
    const dest = document.getElementById('mov-destino-manual')?.value || 'ESTOQUE';
    const s = JSON.parse(localStorage.getItem('session'));
    if (!q) return alert("Informe a quantidade");

    await fetch(`${LOCAL_API_URL}/movimentacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: idSel, tipo, quantidade: q, responsavel: s.usuario, destino_nome: dest, num_nota: document.getElementById('mov-nf')?.value })
    });
    fecharModal(); carregarDados('item');
}

async function prepararEdicao(campo) {
    const modal = document.getElementById('modalEstoque');
    const corpo = document.getElementById('corpoModal');
    const valorAtual = campo === 'SALDO' ? saldoSel : alertaSel;
    document.getElementById('modalTitulo').innerText = campo === 'SALDO' ? 'Acerto de Saldo' : 'Alerta Mínimo';
    corpo.innerHTML = `<p>${itemNomeSel}</p><input type="number" id="novo-valor-edit" value="${valorAtual}">`;
    document.getElementById('btnConfirmarGeral').onclick = async () => {
        const novoV = document.getElementById('novo-valor-edit').value;
        const user = JSON.parse(localStorage.getItem('session'));
        const rota = campo === 'SALDO' ? 'atualizar-saldo' : 'atualizar-alerta';
        await fetch(`${LOCAL_API_URL}/item/${rota}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idSel, valor: novoV, responsavel: user.usuario })
        });
        fecharModal(); carregarDados('item');
    };
    modal.classList.remove('hidden');
}

async function executarEdicaoRapida(campo) {
    const novoValor = document.getElementById('novo-valor-edit').value;
    const rota = campo === 'SALDO' ? 'atualizar-saldo' : 'atualizar-alerta';

    const res = await fetch(`${LOCAL_API_URL}/item/${rota}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id: idSel, valor: novoValor })
    });

    if (res.ok) {
        fecharModal();
        carregarDados('item');
    }
}

// FUNÇÃO PARA ABRIR O MODAL DE ATUALIZAR SALDO
function abrirModalAcerto() {
    if (!idSel) return alert("Selecione um item primeiro!");
    const { corpo, btn } = prepararModal("ATUALIZAR SALDO (AUDITORIA)", "modal-header-danger");
    btn.innerText = "GRAVAR NOVO SALDO";

    corpo.innerHTML = `
        <div style="background:#fefce8; padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.9rem; color:#854d0e;">
            Saldo atual de <b>${itemNomeSel}</b>: <b>${saldoSel}</b>.
        </div>
        <input type="number" id="n-saldo-input" placeholder="Nova quantidade física..." style="width:100%; padding:10px;">
    `;

    btn.onclick = async () => {
        const novaQtd = document.getElementById('n-saldo-input').value;
        if (novaQtd === "") return alert("Informe a quantidade.");

        const res = await fetch(`${LOCAL_API_URL}/item/${idSel}/ajuste-estoque`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novaQuantidade: parseInt(novaQtd) })
        });

        if (res.ok) {
            fecharModal();
            carregarDados('item');
        }
    };
}

// FUNÇÃO PARA ABRIR O MODAL DE CADASTRO
async function abrirModalNovo() {
    const { corpo, btn } = prepararModal("CADASTRAR NOVO PRODUTO", "modal-header-success");

    try {
        const res = await fetch(`${LOCAL_API_URL}/categoria`);
        const categorias = await res.json();
        
        console.log("Categorias recebidas:", categorias); // Para conferência no F12

        corpo.innerHTML = `
            <div class="form-group">
                <label>NOME DO PRODUTO:</label>
                <input type="text" id="n-item" style="width:100%; margin-bottom:15px; padding:8px; border:1px solid #ccc; border-radius:5px;">
                
                <label>CATEGORIA:</label>
                <select id="n-cat" style="width:100%; margin-bottom:15px; padding:10px; border:1px solid #ccc; border-radius:5px;">
                    <option value="">-- Selecione a Categoria --</option>
                    ${categorias.map(c => `<option value="${c.id}">${c.categoria}</option>`).join('')}
                </select>

                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label>ESTOQUE INICIAL:</label>
                        <input type="number" id="n-qtd" value="0" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div style="flex:1;">
                        <label>ALERTA MÍNIMO:</label>
                        <input type="number" id="n-ale" value="5" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>
            </div>
        `;

        btn.onclick = salvarNovoItem;
    } catch (err) {
        console.error("Erro ao carregar categorias:", err);
        alert("Erro ao buscar categorias.");
    }
}

// FUNÇÃO PARA ENVIAR O CADASTRO AO BACKEND
async function salvarNovoItem() {
    const item = document.getElementById('n-item').value;
    const categoria_id = document.getElementById('n-cat').value;
    const quantidade = document.getElementById('n-qtd').value;
    const alerta = document.getElementById('n-ale').value;

    if (!item || !categoria_id) return alert("Preencha Nome e Categoria!");

    const res = await fetch(`${LOCAL_API_URL}/item`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ item, categoria_id, quantidade, alerta })
    });

    if (res.ok) {
        alert("Produto cadastrado!");
        fecharModal();
        carregarDados('item');
    }
}

// FUNÇÃO AUXILIAR PARA PREPARAR O MODAL (Crucial para o botão NOVO funcionar)
// --- Função prepararModal (Insira no escopo global) ---
function prepararModal(tituloTexto, headerClass = '') {
    const modal = document.getElementById('modalEstoque');
    const titulo = document.getElementById('modalTitulo');
    const corpo = document.getElementById('corpoModal');
    const btnConfirmar = document.getElementById('btnConfirmarGeral');

    titulo.className = ''; 
    if (headerClass) titulo.classList.add(headerClass);
    
    titulo.innerText = tituloTexto;
    corpo.innerHTML = ''; 
    btnConfirmar.innerText = "Confirmar";
    
    modal.classList.remove('hidden');
    return { corpo, btn: btnConfirmar };
}

function fecharModal() {
    document.getElementById('modalEstoque').classList.add('hidden');
}
function logout() {
    localStorage.clear();
    window.location.reload();
}

function mudarTab(e, t) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    carregarDados(t);
}

async function gerarRelatorio(t) {
    const dados = await fetch(`${LOCAL_API_URL}/relatorio/${t}`).then(r=>r.json());
    const win = window.open('', '', 'width=800,height=600');
    win.document.write(`<html><style>table{width:100%;border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #ccc;padding:8px;text-align:left}</style>
    <body><h2>RELATÓRIO DE ESTOQUE - ${t.toUpperCase()}</h2>
    <table><tr><th>Item</th><th>Saldo</th><th>Alerta</th></tr>
    ${dados.map(d=>`<tr><td>${d.item}</td><td>${d.quantidade}</td><td>${d.alerta_quantidade}</td></tr>`).join('')}
    </table></body></html>`);
    win.print();
}

async function realizarCadastro(aba) {
    const nome = document.getElementById('novo-nome').value;
    let tabela = aba === 'Estoque' ? 'item' : (aba === 'Locais' ? 'local' : 'categoria');
    let payload = { nome };
    if (tabela === 'item') {
        payload.categoria_id = document.getElementById('novo-cat').value;
        payload.local_id = document.getElementById('novo-local').value;
        payload.quantidade = document.getElementById('novo-qtd').value;
    }
    const res = await fetch(`${LOCAL_API_URL}/cadastrar/${tabela}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    if (res.ok) { fecharModal(); carregarDados(tabela); } else alert((await res.json()).error);
}

function abrirModalSenha() {
    const modal = document.getElementById('modalEstoque');
    const corpo = document.getElementById('corpoModal');
    document.getElementById('modalTitulo').innerText = "Alterar Minha Senha";
    corpo.innerHTML = `<input type="password" id="nova-senha" placeholder="Nova Senha">`;
    document.getElementById('btnConfirmarGeral').onclick = async () => {
        const user = JSON.parse(localStorage.getItem('session'));
        const nova = document.getElementById('nova-senha').value;
        if(!nova) return alert("Digite a nova senha!");
        
        const res = await fetch(`${LOCAL_API_URL}/usuarios/alterar-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: user.id, novaSenha: nova })
        });
        
        if(res.ok) { fecharModal(); alert("Senha alterada com sucesso!"); }
    };
    modal.classList.remove('hidden');
}

async function abrirPanorama(nome) {
    const modal = document.getElementById('modalEstoque');
    const corpo = document.getElementById('corpoModal');
    document.getElementById('modalTitulo').innerText = `Panorama 12 Meses: ${nome}`;
    
    corpo.innerHTML = '<p>Carregando panorama...</p>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${LOCAL_API_URL}/item/giro/${nome}`);
        const dados = await res.json();

        if (dados.length === 0) {
            corpo.innerHTML = '<p>Nenhuma movimentação encontrada nos últimos 12 meses.</p>';
            return;
        }

        let html = `
            <div class="panorama-grid">
                <div class="panorama-box">
                    <table class="panorama-table">
                        <thead><tr><th>Mês</th><th class="text-in">Entradas</th><th class="text-out">Saídas</th></tr></thead>
                        <tbody>`;
        
        dados.forEach(d => {
            html += `<tr>
                <td>${d.mes}</td>
                <td class="text-in">${d.entradas}</td>
                <td class="text-out">${d.saidas}</td>
            </tr>`;
        });

        html += `</tbody></table></div></div>`;
        corpo.innerHTML = html;
        
        // Focar no botão confirmar para permitir fechar com Enter/Esc se desejar
        document.getElementById('btnConfirmarGeral').innerText = "Fechar";
        document.getElementById('btnConfirmarGeral').onclick = fecharModal;

    } catch (err) {
        corpo.innerHTML = '<p style="color:red">Erro ao carregar panorama.</p>';
    }
}

// Função para acionar o panorama do item que você clicou na lista
async function abrirPanoramaSelecionado() {
    if (!idSel) {
        alert("Por favor, selecione um item na lista primeiro!");
        return;
    }

    const modal = document.getElementById('modalEstoque');
    const corpo = document.getElementById('corpoModal');
    document.getElementById('modalTitulo').innerText = `Panorama (Últimos 12 Meses): ${itemNomeSel}`;
    
    corpo.innerHTML = '<p style="padding:20px; text-align:center">Buscando histórico mensal...</p>';
    modal.classList.remove('hidden');

    try {
        // O encodeURIComponent protege o nome caso tenha espaços ou caracteres especiais
        const res = await fetch(`${LOCAL_API_URL}/item/giro/${encodeURIComponent(itemNomeSel)}`);
        const dados = await res.json();

        if (!dados || dados.length === 0) {
            corpo.innerHTML = `<p style="padding:20px; text-align:center">Nenhuma movimentação encontrada para "${itemNomeSel}" nos últimos 12 meses.</p>`;
            return;
        }

        let html = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="panorama-table" style="width:100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
                        <tr>
                            <th style="padding:10px; border-bottom:2px solid #cbd5e1;">Mês/Ano</th>
                            <th style="padding:10px; border-bottom:2px solid #cbd5e1; color:#16a34a;">Entradas</th>
                            <th style="padding:10px; border-bottom:2px solid #cbd5e1; color:#dc2626;">Saídas</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        dados.forEach(d => {
            html += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:10px; text-align:center;">${d.mes}</td>
                    <td style="padding:10px; text-align:center; font-weight:bold; color:#16a34a;">${d.entradas || 0}</td>
                    <td style="padding:10px; text-align:center; font-weight:bold; color:#dc2626;">${d.saidas || 0}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        corpo.innerHTML = html;
        
        const btnConfirmar = document.getElementById('btnConfirmarGeral');
        btnConfirmar.innerText = "FECHAR";
        btnConfirmar.onclick = fecharModal;

    } catch (err) {
        corpo.innerHTML = '<p style="padding:20px; color:red; text-align:center">Erro ao carregar panorama mensal.</p>';
    }
}

// Função vinculada ao botão 'DELETAR' (Lixeira)
async function inativarRegistro() {
    if (!idSel) return;

    try {
        const res = await fetch(`${LOCAL_API_URL}/item/${idSel}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'I', 
                quantidade: 0 
            })
        });

        if (res.ok) {
            idSel = null;
            carregarDados('item');
        }
    } catch (err) {
        console.error("Erro ao inativar:", err);
    }
}

// Função vinculada ao botão 'TRAZER DE VOLTA'
async function abrirModalReativar() {
    const modal = document.getElementById('modalEstoque');
    const corpo = document.getElementById('corpoModal');
    const titulo = document.getElementById('modalTitulo');
    const btnGeral = document.getElementById('btnConfirmarGeral');

    titulo.innerText = "TRAZER DE VOLTA";
    btnGeral.classList.add('hidden'); 

    // Interface Vitrificada
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.background = "rgba(255, 255, 255, 0.4)";
    modalContent.style.backdropFilter = "blur(15px)";
    modalContent.style.webkitBackdropFilter = "blur(15px)";
    modalContent.style.border = "1px solid rgba(255, 255, 255, 0.2)";

    corpo.innerHTML = '<p style="text-align:center">Carregando itens inativos...</p>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${LOCAL_API_URL}/item`);
        const dados = await res.json();
        
        const inativos = dados
            .filter(i => i.status === 'I')
            .sort((a, b) => a.item.localeCompare(b.item));

        if (inativos.length === 0) {
            corpo.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum item encontrado.</p>';
        } else {
            let options = inativos.map(i => `<option value="${i.id}">${i.item}</option>`).join('');
            
            corpo.innerHTML = `
                <div style="padding:15px;">
                    <select id="select-reativar" style="width:100%; padding:12px; border-radius:8px; margin-bottom:20px; border:1px solid #ccc;">
                        ${options}
                    </select>
                    <div style="display:flex; gap:10px;">
                        <button onclick="fecharModalReativacao()" style="flex:1; background:#6b7280; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:bold;">
                            <i class="fas fa-times-circle"></i> CANCELAR
                        </button>
                        <button onclick="confirmarReativacao()" style="flex:1; background:#10b981; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:bold;">
                            <i class="fas fa-check-circle"></i> CONFIRMAR
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        corpo.innerHTML = "Erro ao carregar dados.";
    }
}

function fecharModalReativacao() {
    const modal = document.getElementById('modalEstoque');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.background = ""; 
    modalContent.style.backdropFilter = "";
    document.getElementById('btnConfirmarGeral').classList.remove('hidden');
    fecharModal();
}

async function confirmarReativacao() {
    const id = document.getElementById('select-reativar').value;
    if (!id) return;

    try {
        const res = await fetch(`${LOCAL_API_URL}/item/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'A' })
        });

        if (res.ok) {
            fecharModalReativacao();
            carregarDados('item');
        }
    } catch (err) {
        console.error("Erro ao reativar:", err);
    }
}
