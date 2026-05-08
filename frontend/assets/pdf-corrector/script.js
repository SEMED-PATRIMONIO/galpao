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
        <input type="text" placeholder="Nome (Ex: Matemática)" class="bl-nome">
        <input type="number" placeholder="Qtd" class="bl-qtd">
    `;
    container.appendChild(div);
}

async function processarGeracao() {
    const btn = event.target;
    btn.disabled = true;
    btn.innerText = "GERANDO...";

    const titulo = document.getElementById('tit-prova').value;
    const blocos = [];
    document.querySelectorAll('.bloco-item').forEach(el => {
        blocos.push({
            nome: el.querySelector('.bl-nome').value,
            questoes: parseInt(el.querySelector('.bl-qtd').value)
        });
    });

    try {
        const res = await fetch('/gerar-gabarito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo, blocos, sequencia: {} })
        });
        const data = await res.json();
        if (data.sucesso) {
            window.location.href = data.url;
        }
    } catch (e) {
        alert("Erro ao gerar PDF");
    } finally {
        btn.disabled = false;
        btn.innerText = "GERAR E SALVAR";
    }
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