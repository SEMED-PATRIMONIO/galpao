let canvas = document.getElementById('pdfCanvas');
let ctx = canvas.getContext('2d');
let rects = { areaEscola: null, areaAluno: null, areaTurma: null, questoes: [] };
let isDrawing = false;
let startX, startY;
let currentMode = '';

function setMode(mode) {
    currentMode = mode;
    alert("Modo selecionado: " + mode + ". Agora clique e arraste no PDF.");
}

canvas.addEventListener('mousedown', e => {
    if (!currentMode) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
});

canvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    // Lógica para mostrar o retângulo enquanto arrasta (opcional: redesenha o PDF)
});

canvas.addEventListener('mouseup', e => {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    let endX = e.clientX - rect.left;
    let endY = e.clientY - rect.top;

    let coords = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        w: Math.abs(startX - endX),
        h: Math.abs(startY - endY)
    };

    if (currentMode === 'questoes') {
        // Para questões, abrimos um prompt para saber o número e a resposta correta
        let qNum = prompt("Número da questão:");
        let qCorreta = prompt("Letra da resposta correta (A, B, C, D ou E):").toUpperCase();
        
        // No mundo real, você marcaria cada círculo. 
        // Para simplificar, vamos assumir que este retângulo engloba todas as opções daquela questão.
        rects.questoes.push({ num: qNum, correta: qCorreta, ...coords });
    } else {
        rects[currentMode] = coords;
    }

    drawAll();
});

function drawAll() {
    // Aqui você adicionaria a lógica para desenhar retângulos coloridos 
    // sobre o canvas para dar feedback visual ao usuário.
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    if(rects.areaEscola) ctx.strokeRect(rects.areaEscola.x, rects.areaEscola.y, rects.areaEscola.w, rects.areaEscola.h);
    ctx.strokeStyle = "blue";
    if(rects.areaAluno) ctx.strokeRect(rects.areaAluno.x, rects.areaAluno.y, rects.areaAluno.w, rects.areaAluno.h);
}

function saveConfig() {
    if (!rects.areaEscola || !rects.areaAluno) {
        return alert("Por favor, marque pelo menos Escola e Aluno.");
    }
    localStorage.setItem('gabaritoConfig', JSON.stringify(rects));
    alert("Configuração salva com sucesso!");
    window.location.href = 'index.html';
}