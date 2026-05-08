
function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + id).classList.add('active');
    event.currentTarget.classList.add('active');
    if(id === 'dash') carregarListaProvas();
}

async function carregarListaProvas() {
    const res = await fetch('/gabaritos');
    const list = await res.json();
    const select = document.getElementById('select-prova');
    select.innerHTML = '<option value="">Escolha uma prova...</option>' + list.map(g => `<option value="${g.id}">${g.titulo}</option>`).join('');
}

async function carregarDadosDash() {
    const id = document.getElementById('select-prova').value;
    if(!id) return;
    const res = await fetch('/estatisticas/' + id);
    const dados = await res.json();
    
    document.getElementById('total-alunos').innerText = dados.length;
    let soma = 0;
    const tbody = document.getElementById('lista-alunos');
    tbody.innerHTML = dados.map(r => {
        soma += (r.acertos/r.total)*100;
        return `<tr><td>${r.aluno}</td><td>${r.acertos}</td><td>${r.em_branco}</td><td>${((r.acertos/r.total)*100).toFixed(1)}%</td></tr>`;
    }).join('');
    document.getElementById('media-turma').innerText = dados.length ? (soma/dados.length).toFixed(1) + '%' : '-';
}

function baixarRelatorioPDF() {
    const id = document.getElementById('select-prova').value;
    if(!id) return alert("Selecione uma prova");
    window.open('/relatorio-pdf/' + id, '_blank');
}

// Reuse other logic from previous scripts...
function addBloco() { const d = document.createElement('div'); d.className='bloco-item'; d.innerHTML='<input type="text" class="bl-nome"><input type="number" class="bl-qtd">'; document.getElementById('blocos-container').appendChild(d); }
async function processarGeracao() { /* fetch /gerar-gabarito */ }
