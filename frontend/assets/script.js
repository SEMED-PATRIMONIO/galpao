const API_URL = '/api/contatos';
let arquivoSelecionado = null;
let idContatoEmEdicao = null;
window.onload = () => {
    carregarContatos();
};
// 1. CARREGAR FOTOS DA PASTA
// Gatilho de Clique Duplo no Ícone
document.getElementById('camera-logo').ondblclick = async () => {
    document.getElementById('modal-historico').style.display = 'flex';
    const res = await fetch('/api/historico');
    const dados = await res.json();
    
    const corpoTabela = document.getElementById('lista-historico');
    corpoTabela.innerHTML = '';

    dados.forEach(h => {
        const dataFormatada = new Date(h.data_hora).toLocaleString('pt-BR');
        corpoTabela.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                <td style="padding: 15px;">${dataFormatada}</td>
                <td style="padding: 15px;"><strong>${h.contato_nome}</strong></td>
                <td style="padding: 15px;">${h.contato_email}</td>
                <td style="padding: 15px; font-size: 18px;">${h.arquivo_nome}</td>
                <td style="padding: 15px;">${h.arquivo_tipo.split('/')[1].toUpperCase()}</td>
            </tr>
        `;
    });
};

document.getElementById('folder-picker').addEventListener('change', (e) => {
    const thumbnails = document.getElementById('thumbnails');
    const imageDisplay = document.getElementById('image-display');
    const actions = document.getElementById('actions');
    const emptyState = document.getElementById('empty-state');
    
    thumbnails.innerHTML = '';
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'thumb-style';
            img.onclick = () => {
                // Remove destaque de outras e adiciona nesta
                document.querySelectorAll('.thumb-style').forEach(t => t.classList.remove('thumb-active'));
                img.classList.add('thumb-active');
                
                imageDisplay.src = event.target.result;
                imageDisplay.style.display = 'block';
                actions.style.display = 'block';
                emptyState.style.display = 'none';
                arquivoSelecionado = file;
            };
            thumbnails.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

function configurarEventos() {
    // 1. Gatilho do Histórico (Clique Duplo na Câmera)
    const logo = document.getElementById('camera-logo');
    if (logo) {
        logo.ondblclick = async () => {
            document.getElementById('modal-historico').style.display = 'flex';
            const res = await fetch('/api/historico');
            const dados = await res.json();
            
            const corpoTabela = document.getElementById('lista-historico');
            corpoTabela.innerHTML = '';

            dados.forEach(h => {
                const dataFormatada = new Date(h.data_hora).toLocaleString('pt-BR');
                // Proteção caso o tipo de arquivo falhe
                const tipo = h.arquivo_tipo ? h.arquivo_tipo.split('/')[1].toUpperCase() : '---';
                
                corpoTabela.innerHTML += `
                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                        <td style="padding: 15px;">${dataFormatada}</td>
                        <td style="padding: 15px;"><strong>${h.contato_nome}</strong></td>
                        <td style="padding: 15px;">${h.contato_email}</td>
                        <td style="padding: 15px; font-size: 18px;">${h.arquivo_nome}</td>
                        <td style="padding: 15px;">${tipo}</td>
                    </tr>
                `;
            });
        };
    }

    // 2. Carregar Fotos da Pasta
    document.getElementById('folder-picker').addEventListener('change', (e) => {
        const thumbnails = document.getElementById('thumbnails');
        const imageDisplay = document.getElementById('image-display');
        const actions = document.getElementById('actions');
        const emptyState = document.getElementById('empty-state');
        
        thumbnails.innerHTML = '';
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'thumb-style';
                img.onclick = () => {
                    document.querySelectorAll('.thumb-style').forEach(t => t.classList.remove('thumb-active'));
                    img.classList.add('thumb-active');
                    
                    imageDisplay.src = event.target.result;
                    imageDisplay.style.display = 'block';
                    actions.style.display = 'block';
                    emptyState.style.display = 'none';
                    arquivoSelecionado = file;
                };
                thumbnails.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

// 2. GERENCIAMENTO DE CONTATOS (API)
async function carregarContatos() {
    const response = await fetch(API_URL);
    const contatos = await response.json();
    
    const lista = document.getElementById('contacts-list');
    const select = document.getElementById('contact-select');
    
    lista.innerHTML = '';
    select.innerHTML = '<option>Selecione o amigo...</option>';

    contatos.forEach(c => {
        // Preenche o seletor de e-mail
        select.innerHTML += `<option value="${c.email}">${c.nome}</option>`;
        
        // Preenche a lista com botões de EDITAR e APAGAR
        lista.innerHTML += `
            <div class="contact-item">
                <div style="flex-grow: 1">
                    <strong>${c.nome}</strong><br>
                    <span style="font-size: 18px; opacity: 0.7;">${c.email}</span>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="preencherEdicao(${c.id}, '${c.nome}', '${c.email}')" style="background: #90caf9; padding: 10px;">✏️</button>
                    <button onclick="deleteContact(${c.id}, '${c.nome}')" style="background: #ff8a80; padding: 10px;">🗑️</button>
                </div>
            </div>
        `;
    });
}



async function saveContact() {
    const nome = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    if (!nome || !email) return alert("Preencha Nome e E-mail! ✍️");

    const dados = { nome, email };
    const metodo = idContatoEmEdicao ? 'PUT' : 'POST';
    const url = idContatoEmEdicao ? `${API_URL}/${idContatoEmEdicao}` : API_URL;

    await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormulario();
    carregarContatos();
    alert("Salvo com sucesso! ✅");
}

function preencherEdicao(id, nome, email) {
    idContatoEmEdicao = id;
    document.getElementById('name').value = nome;
    document.getElementById('email').value = email;
    document.getElementById('btn-salvar').innerHTML = "💾 Atualizar";
}

function limparFormulario() {
    idContatoEmEdicao = null;
    document.getElementById('name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('btn-salvar').innerHTML = "💾 Salvar";
}

async function deleteContact(id, nome) {
    if (confirm(`Apagar contato de ${nome}?`)) {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        carregarContatos();
    }
}

// 3. ENVIO DE E-MAIL (UPLOAD)
function sendEmail() {
    const emailDestino = document.getElementById('contact-select').value;
    // const assunto = document.getElementById('email-subject').value;
    const assuntoFixo = "Foto enviada pela fotógrafa Thereza Kezen";
    const btn = document.querySelector("#actions button");
    const progContainer = document.getElementById('progress-container');
    const progBar = document.getElementById('progress-bar');
    const seletor = document.getElementById('contact-select');
    const nomeSelecionado = seletor.options[seletor.selectedIndex].text;

    if (!arquivoSelecionado || emailDestino.includes("Selecione")) {
        return alert("Selecione uma foto e um contato! 🖼️👤");
    }

    const formData = new FormData();
    formData.append('para', emailDestino);
    // formData.append('assunto', assunto);
    formData.append('assunto', assuntoFixo);
    formData.append('foto', arquivoSelecionado);
    formData.append('nome_contato', nomeSelecionado);

    // Preparar interface para o envio
    btn.disabled = true;
    btn.innerHTML = "⏳ Enviando...";
    progContainer.style.display = 'block';
    progBar.style.width = '0%';

    // Usando XMLHttpRequest para monitorar o progresso
    const xhr = new XMLHttpRequest();

    // Evento que acompanha o upload
    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentual = (e.loaded / e.total) * 100;
            progBar.style.width = percentual + '%';
        }
    };

    // Quando o envio termina
    xhr.onload = function() {
        btn.disabled = false;
        btn.innerHTML = "🚀 Enviar Agora";
        
        if (xhr.status === 200) {
            alert("E-mail enviado! ✉️✨");
            progContainer.style.display = 'none'; // Esconde a barra ao terminar
        } else {
            alert("Erro no envio. Verifique o servidor.");
        }
    };

    xhr.onerror = function() {
        alert("Erro de conexão.");
        btn.disabled = false;
    };

    xhr.open('POST', '/api/email/enviar', true);
    xhr.send(formData);
}

function fecharHistorico() {
    document.getElementById('modal-historico').style.display = 'none';
}

// Inicializar
window.onload = carregarContatos;