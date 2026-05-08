let configuracaoTemporaria = {};

function abrirConfiguracaoGabarito() {
    const titulo = document.getElementById('tit-prova').value;
    const blocos = [];
    let htmlGabarito = "";
    let qTotal = 1;

    document.querySelectorAll('.bloco-item').forEach(el => {
        const nome = el.querySelector('.bl-nome').value;
        const qtd = parseInt(el.querySelector('.bl-qtd').value);
        const alt = parseInt(el.querySelector('.bl-alt').value);
        
        blocos.push({ nome, questoes: qtd, alternativas: alt });

        htmlGabarito += `<h4>${nome}</h4><div class="grid-gabarito">`;
        for(let i=1; i<=qtd; i++) {
            htmlGabarito += `
                <div class="q-row">
                    <span>${qTotal})</span>
                    <select class="resp-correta" data-q="${qTotal}">
                        ${Array.from({length: alt}, (_, i) => String.fromCharCode(65 + i))
                          .map(letra => `<option value="${letra}">${letra}</option>`).join('')}
                    </select>
                </div>`;
            qTotal++;
        }
        htmlGabarito += `</div>`;
    });

    configuracaoTemporaria = { titulo, blocos };
    document.getElementById('lista-questoes-gabarito').innerHTML = htmlGabarito;
    document.getElementById('modal-gabarito').style.display = 'block';
}

async function processarGeracaoFinal() {
    const respostasCorretas = {};
    document.querySelectorAll('.resp-correta').forEach(sel => {
        respostasCorretas[sel.dataset.q] = sel.value;
    });

    const btn = event.target;
    btn.innerText = "GERANDO PDF E SALVANDO...";
    btn.disabled = true;

    try {
        const response = await fetch('/gerar-gabarito', {
            method: 'POST', // GARANTE QUE É POST
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo: configuracaoTemporaria.titulo,
                blocos: configuracaoTemporaria.blocos,
                sequencia: respostasCorretas
            })
        });

        const data = await response.json();
        if (data.sucesso) {
            window.location.href = data.url; // Baixa o PDF
        } else {
            alert("Erro: " + data.erro);
        }
    } catch (e) {
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.disabled = false;
        btn.innerText = "FINALIZAR E GERAR PDF";
    }
}

function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + id).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(id === 'relatorios') carregarRelatorios();
}

function addBloco() {
    const container = document.getElementById('blocos-container');
    const div = document.createElement('div');
    div.className = 'bloco-item';
    div.innerHTML = `
        <input type="text" placeholder="Matéria" class="bl-nome">
        <input type="number" placeholder="Qtd" class="bl-qtd">
        <select class="bl-alt">
            <option value="4">4 Alternativas (A-D)</option>
            <option value="5">5 Alternativas (A-E)</option>
        </select>
    `;
    container.appendChild(div);
}

// Lógica de Importação
document.getElementById('file-provas')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const status = document.getElementById('status-import');
    status.innerHTML = `<p><i class="fa-solid fa-spinner fa-spin"></i> Processando arquivo... Isso pode levar um minuto.</p>`;

    const formData = new FormData();
    formData.append('provas', file);

    try {
        const res = await fetch('/importar', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.sucesso) {
            status.innerHTML = `<h3><i class="fa-solid fa-circle-check" style="color:green"></i> Sucesso!</h3>`;
            const lista = document.createElement('ul');
            data.dados.forEach(r => {
                lista.innerHTML += `<li><strong>${r.aluno}</strong>: ${r.acertos}/${r.total} acertos</li>`;
            });
            status.appendChild(lista);
        }
    } catch (e) {
        status.innerHTML = `<p style="color:red">Erro no processamento.</p>`;
    }
});

async function carregarRelatorios() {
    const container = document.getElementById('lista-relatorios');
    const res = await fetch('/relatorios-dados');
    const dados = await res.json();
    
    if(dados.length === 0) {
        container.innerHTML = "<p>Nenhum dado encontrado.</p>";
        return;
    }

    let html = `<table class="rel-table"><tr><th>Data</th><th>Aluno</th><th>Turma</th><th>Acertos</th></tr>`;
    dados.forEach(r => {
        html += `<tr><td>${new Date(r.data_importacao).toLocaleDateString()}</td><td>${r.aluno}</td><td>${r.turma}</td><td>${r.acertos}/${r.total}</td></tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}