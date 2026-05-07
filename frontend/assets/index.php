<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OMR Vision Pro - Master</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
    <style>
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); }
        #canvas-container { position: relative; display: inline-block; cursor: crosshair; }
        .selection-box { position: absolute; border: 2px dashed; pointer-events: none; display: none; z-index: 10; }
        #box-name { border-color: #3b82f6; background: rgba(59, 130, 246, 0.2); }
        #box-grid { border-color: #ec4899; background: rgba(236, 72, 153, 0.2); }
        .progress-fill { transition: width 0.3s ease-in-out; }
    </style>
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen font-sans pb-20">

    <div class="container mx-auto max-w-5xl pt-10 px-4">
        
        <header class="text-center mb-10 animate__animated animate__fadeIn">
            <h1 class="text-5xl font-black tracking-tighter text-white">VISION<span class="text-blue-500">SCAN</span></h1>
            <p class="text-slate-500 mt-2 uppercase tracking-widest text-xs">Sistema de Correção Gamificado v2.0</p>
        </header>

        <!-- PASSO 1: UPLOAD DO GABARITO MESTRE -->
        <div id="step-1" class="glass p-10 rounded-3xl text-center animate__animated animate__fadeInUp">
            <div class="inline-block p-4 rounded-full bg-blue-600/20 mb-4">
                <svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h2 class="text-3xl font-bold text-white mb-2">Gabarito Modelo</h2>
            <p class="text-slate-400 mb-8">Suba o PDF original para calibrarmos os sensores de leitura.</p>
            
            <input type="file" id="file-gabarito" class="hidden" onchange="uploadGabarito()">
            <label for="file-gabarito" class="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl cursor-pointer font-black text-lg transition-all inline-block shadow-xl shadow-blue-900/20">
                SELECIONAR PDF MESTRE
            </label>
        </div>

        <!-- PASSO 2: MAPEAMENTO VISUAL (CANVAS) -->
        <div id="step-2" class="hidden glass p-6 rounded-3xl animate__animated animate__fadeIn">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-white">Calibração de Área</h2>
                    <p class="text-slate-400 text-sm">Arraste o mouse para criar as zonas de detecção.</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="setMode('name')" id="btn-mode-name" class="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold ring-2 ring-blue-400">1. ÁREA DO NOME</button>
                    <button onclick="setMode('grid')" id="btn-mode-grid" class="bg-slate-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-pink-600 transition-colors">2. GRADE DE RESPOSTAS</button>
                </div>
            </div>

            <div class="relative overflow-auto max-h-[500px] border-4 border-slate-800 rounded-2xl bg-black shadow-inner">
                <div id="canvas-container">
                    <img id="preview-img" class="max-w-none select-none">
                    <div id="box-name" class="selection-box"></div>
                    <div id="box-grid" class="selection-box"></div>
                </div>
            </div>

            <button onclick="confirmarMapeamento()" class="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 py-4 rounded-2xl font-black text-xl uppercase tracking-tighter hover:scale-[1.02] transition-transform">
                PRÓXIMO PASSO: PROCESSAR PROVAS ➔
            </button>
        </div>

        <!-- PASSO 3: PROCESSAMENTO E PROGRESSO -->
        <div id="step-3" class="hidden glass p-8 rounded-3xl animate__animated animate__fadeIn">
            <h2 class="text-2xl font-bold text-white mb-6">Processamento em Massa</h2>
            <div class="mb-8">
                <label class="block text-slate-400 mb-2 font-bold uppercase text-xs">Arquivo de Provas (Multi-páginas)</label>
                <input type="file" id="file-provas" class="block w-full text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-pink-600 file:text-white cursor-pointer">
            </div>

            <!-- Barra de Progresso -->
            <div id="progress-container" class="hidden mb-10">
                <div class="flex justify-between mb-2">
                    <span id="status-text" class="text-blue-400 font-bold">Iniciando motor OMR...</span>
                    <span id="percent-text" class="font-mono">0%</span>
                </div>
                <div class="w-full bg-slate-800 h-6 rounded-full p-1 shadow-inner">
                    <div id="progress-bar" class="progress-fill bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-full rounded-full w-0"></div>
                </div>
            </div>

            <button id="btn-executar" onclick="processarTudo()" class="w-full bg-white text-black py-5 rounded-2xl font-black text-2xl shadow-2xl hover:bg-blue-50 transition-colors">
                CORRIGIR AGORA ⚡
            </button>

            <button id="btn-resultados" disabled onclick="verResultados()" class="w-full mt-4 bg-slate-800 text-slate-500 py-5 rounded-2xl font-black text-2xl cursor-not-allowed">
                EXIBIR RESULTADOS
            </button>
        </div>

        <!-- ÁREA DE TABELA FINAL -->
        <div id="area-resultados" class="hidden mt-10 animate__animated animate__zoomIn">
            <div class="flex justify-between items-end mb-4">
                <h3 class="text-3xl font-black">Relatório de Desempenho</h3>
                <button onclick="window.print()" class="text-xs bg-slate-800 px-3 py-1 rounded">GERAR PDF/IMPRIMIR</button>
            </div>
            <div class="glass rounded-3xl overflow-hidden shadow-2xl">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/10 text-blue-400 uppercase text-xs tracking-widest">
                            <th class="p-5">Estudante</th>
                            <th class="p-5 text-center">Acertos</th>
                            <th class="p-5 text-center">Brancos</th>
                            <th class="p-5 text-center">Inválidas</th>
                        </tr>
                    </thead>
                    <tbody id="tabela-corpo">
                        <!-- JS Populará aqui -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let mode = 'name';
        let coords = { name: {}, grid: {} };
        let isDrawing = false;
        let startX, startY;
        let finalData = [];

        // 1. Gera o preview do Gabarito para mapeamento
        async function uploadGabarito() {
            const file = document.getElementById('file-gabarito').files[0];
            if(!file) return;
            
            const formData = new FormData();
            formData.append('action', 'preview');
            formData.append('file', file);

            const res = await fetch('process.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.image) {
                const img = document.getElementById('preview-img');
                img.src = data.image;
                img.onload = () => {
                    document.getElementById('step-1').classList.add('hidden');
                    document.getElementById('step-2').classList.remove('hidden');
                    initCanvas();
                };
            }
        }

        // 2. Lógica de desenho no Canvas
        function initCanvas() {
            const container = document.getElementById('canvas-container');
            const img = document.getElementById('preview-img');

            container.onmousedown = (e) => {
                isDrawing = true;
                startX = e.offsetX;
                startY = e.offsetY;
                const box = document.getElementById(`box-${mode}`);
                box.style.display = 'block';
            };

            container.onmousemove = (e) => {
                if (!isDrawing) return;
                const box = document.getElementById(`box-${mode}`);
                const curX = e.offsetX;
                const curY = e.offsetY;
                
                box.style.left = Math.min(curX, startX) + 'px';
                box.style.top = Math.min(curY, startY) + 'px';
                box.style.width = Math.abs(curX - startX) + 'px';
                box.style.height = Math.abs(curY - startY) + 'px';
            };

            container.onmouseup = () => {
                isDrawing = false;
                const box = document.getElementById(`box-${mode}`);
                coords[mode] = {
                    x: parseInt(box.style.left),
                    y: parseInt(box.style.top),
                    w: parseInt(box.style.width),
                    h: parseInt(box.style.height),
                    imgW: img.clientWidth,
                    imgH: img.clientHeight
                };
            };
        }

        function setMode(m) {
            mode = m;
            document.getElementById('btn-mode-name').classList.toggle('ring-2', m === 'name');
            document.getElementById('btn-mode-grid').classList.toggle('ring-2', m === 'grid');
        }

        function confirmarMapeamento() {
            if (!coords.name.w || !coords.grid.w) return alert("Por favor, selecione as duas áreas!");
            document.getElementById('step-2').classList.add('hidden');
            document.getElementById('step-3').classList.remove('hidden');
        }

        // 3. Processamento via Stream (PHP envia pedaços de JSON)
        async function processarTudo() {
            const provas = document.getElementById('file-provas').files[0];
            const gabarito = document.getElementById('file-gabarito').files[0];
            if (!provas) return alert("Selecione o arquivo de provas!");

            const formData = new FormData();
            formData.append('action', 'process');
            formData.append('gabarito', gabarito);
            formData.append('provas', provas);
            formData.append('coords', JSON.stringify(coords));

            document.getElementById('btn-executar').classList.add('hidden');
            document.getElementById('progress-container').classList.remove('hidden');

            const response = await fetch('process.php', { method: 'POST', body: formData });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
                
                const lines = decoder.decode(value).split("\n");
                lines.forEach(line => {
                    if(!line.trim()) return;
                    try {
                        const data = JSON.parse(line);
                        const pct = Math.round((data.atual / data.total) * 100);
                        document.getElementById('progress-bar').style.width = pct + '%';
                        document.getElementById('percent-text').innerText = pct + '%';
                        document.getElementById('status-text').innerText = `Lendo: ${data.aluno}`;

                        if (data.concluido) {
                            finalData = data.resultados;
                            ativarResultados();
                        }
                    } catch(e) {}
                });
            }
        }

        function ativarResultados() {
            const btn = document.getElementById('btn-resultados');
            btn.disabled = false;
            btn.classList.replace('bg-slate-800', 'bg-green-600');
            btn.classList.replace('text-slate-500', 'text-white');
            btn.classList.remove('cursor-not-allowed');
            document.getElementById('status-text').innerText = "Processamento finalizado!";
        }

        function verResultados() {
            document.getElementById('area-resultados').classList.remove('hidden');
            const corpo = document.getElementById('tabela-corpo');
            corpo.innerHTML = finalData.map(r => `
                <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-5 font-bold text-slate-100">${r.aluno}</td>
                    <td class="p-5 text-center text-green-400 font-black text-xl">${r.acertos}</td>
                    <td class="p-5 text-center text-slate-500">${r.brancos}</td>
                    <td class="p-5 text-center text-red-500">${r.rasuras}</td>
                </tr>
            `).join('');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    </script>
</body>
</html>