<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VISION SCAN - SEMED</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
    <style>
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); }
        #canvas-container { position: relative; display: inline-block; cursor: crosshair; background: #1e293b; border-radius: 8px; overflow: hidden; }
        .selection-box { position: absolute; border: 2px dashed; pointer-events: none; display: none; z-index: 10; }
        #box-name { border-color: #3b82f6; background: rgba(59, 130, 246, 0.2); }
        #box-grid { border-color: #ec4899; background: rgba(236, 72, 153, 0.2); }
        .progress-fill { transition: width 0.3s ease-in-out; }
        canvas { max-width: 100%; height: auto; }
    </style>
</head>
<body class="bg-slate-950 text-slate-300 min-h-screen font-sans">

    <header class="border-b border-white/5 p-6 mb-8">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-xl shadow-lg shadow-blue-500/20">V</div>
                <h1 class="text-xl font-bold tracking-tight text-white">VISION <span class="text-blue-500">SCAN</span></h1>
            </div>
            <div class="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-white/5">SEMED - QUEIMADOS/RJ</div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 pb-20">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div class="lg:col-span-4 space-y-6">
                <div class="glass rounded-2xl p-6 space-y-6">
                    <h2 class="text-white font-semibold flex items-center gap-2">
                        <span class="w-2 h-6 bg-blue-500 rounded-full"></span> 
                        Configuração
                    </h2>

                    <div class="space-y-3">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Gabarito Mestre (PDF)</label>
                        <div class="relative group">
                            <input type="file" id="file-gabarito" accept=".pdf" class="hidden" onchange="carregarPreview(this)">
                            <label for="file-gabarito" class="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer group">
                                <span class="text-sm group-hover:text-blue-400">Selecionar Gabarito</span>
                            </label>
                        </div>
                    </div>

                    <div class="space-y-4 pt-4 border-t border-white/5">
                        <p class="text-xs text-slate-500 italic">Selecione o tipo de área e arraste no mapa ao lado:</p>
                        <div class="flex gap-2">
                            <button onclick="setMode('name')" id="btn-name" class="flex-1 py-2 rounded-lg text-xs font-bold border border-blue-500/50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all">NOME ALUNO</button>
                            <button onclick="setMode('grid')" id="btn-grid" class="flex-1 py-2 rounded-lg text-xs font-bold border border-pink-500/50 text-pink-500 hover:bg-pink-500 hover:text-white transition-all">GRADE RESPOSTAS</button>
                        </div>
                    </div>

                    <div class="space-y-3 pt-4 border-t border-white/5">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Cartões Resposta (PDF)</label>
                        <input type="file" id="file-provas" accept=".pdf" class="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700">
                    </div>

                    <div class="pt-6">
                        <button id="btn-executar" onclick="processarTudo()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 transition-all animate__animated">
                            CORRIGIR AGORA
                        </button>
                        
                        <button id="btn-resultados" onclick="verResultados()" disabled class="hidden w-full bg-slate-800 text-slate-500 font-bold py-4 rounded-xl mt-4 cursor-not-allowed transition-all">
                            VER RESULTADOS
                        </button>
                    </div>

                    <div id="progress-container" class="hidden space-y-3">
                        <div class="flex justify-between text-xs font-bold">
                            <span id="status-text" class="text-blue-400">Iniciando...</span>
                            <span id="percent-text">0%</span>
                        </div>
                        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div id="progress-bar" class="bg-blue-500 h-full w-0 progress-fill shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-8">
                <div class="glass rounded-2xl p-4 min-h-[600px] flex items-center justify-center relative overflow-hidden">
                    <div id="loading-preview" class="hidden absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                    
                    <div id="canvas-container">
                        <canvas id="preview-canvas"></canvas>
                        <div id="box-name" class="selection-box"></div>
                        <div id="box-grid" class="selection-box"></div>
                    </div>

                    <div id="empty-state" class="text-center space-y-4">
                        <div class="w-20 h-20 bg-slate-900 rounded-3xl mx-auto flex items-center justify-center border border-white/5">
                            <svg class="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <p class="text-slate-500 text-sm">Carregue um gabarito para iniciar o mapeamento</p>
                    </div>
                </div>
            </div>
        </div>

        <div id="area-resultados" class="hidden mt-12 animate__animated animate__fadeInUp">
            <div class="glass rounded-3xl overflow-hidden shadow-2xl border-white/10">
                <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 class="text-2xl font-bold text-white">Relatório de Correção</h3>
                    <button onclick="window.print()" class="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-xs font-bold transition-all border border-white/10">EXPORTAR PDF</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-slate-500 text-xs uppercase tracking-widest bg-slate-900/50">
                                <th class="p-6">Nome do Aluno</th>
                                <th class="p-6 text-center">Acertos</th>
                                <th class="p-6 text-center">Brancos</th>
                                <th class="p-6 text-center">Rasuras</th>
                            </tr>
                        </thead>
                        <tbody id="tabela-corpo"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>

    <script>
        let coords = {
            name: { x:0, y:0, w:0, h:0, imgW:0, imgH:0 },
            grid: { x:0, y:0, w:0, h:0, imgW:0, imgH:0 }
        };
        let currentMode = null;
        let isDrawing = false;
        let startX, startY;
        let finalData = [];

        const canvas = document.getElementById('preview-canvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('canvas-container');

        // Modo de Seleção
        function setMode(mode) {
            currentMode = mode;
            document.getElementById('btn-name').classList.remove('bg-blue-600', 'text-white');
            document.getElementById('btn-grid').classList.remove('bg-pink-600', 'text-white');
            
            if(mode === 'name') document.getElementById('btn-name').classList.add('bg-blue-600', 'text-white');
            if(mode === 'grid') document.getElementById('btn-grid').classList.add('bg-pink-600', 'text-white');
        }

        // Preview do Gabarito via PHP/Imagick
        async function carregarPreview(input) {
            if(!input.files[0]) return;
            
            document.getElementById('loading-preview').classList.remove('hidden');
            document.getElementById('empty-state').classList.add('hidden');

            const fd = new FormData();
            fd.append('action', 'preview');
            fd.append('file', input.files[0]);

            try {
                const res = await fetch('process.php', { method: 'POST', body: fd });
                const data = await res.json();
                
                if(data.error) throw new Exception(data.error);

                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    document.getElementById('loading-preview').classList.add('hidden');
                    container.style.display = 'inline-block';
                };
                img.src = data.image + '?t=' + Date.now();
            } catch(e) {
                alert("Erro ao carregar preview: " + e.message);
                document.getElementById('loading-preview').classList.add('hidden');
            }
        }

        // Lógica de Desenho (Mouse)
        container.onmousedown = (e) => {
            if(!currentMode) return;
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        };

        container.onmousemove = (e) => {
            if(!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const box = document.getElementById(`box-${currentMode}`);
            box.style.display = 'block';
            box.style.left = Math.min(startX, currentX) + 'px';
            box.style.top = Math.min(startY, currentY) + 'px';
            box.style.width = Math.abs(currentX - startX) + 'px';
            box.style.height = Math.abs(currentY - startY) + 'px';
        };

        container.onmouseup = (e) => {
            if(!isDrawing) return;
            isDrawing = false;
            const rect = canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            // Salva coordenadas relativas à imagem original
            coords[currentMode] = {
                x: Math.min(startX, endX),
                y: Math.min(startY, endY),
                w: Math.abs(endX - startX),
                h: Math.abs(endY - startY),
                imgW: canvas.width,
                imgH: canvas.height
            };
        };

        // Função de Processamento Principal
        async function processarTudo() {
            const provas = document.getElementById('file-provas').files[0];
            const gabarito = document.getElementById('file-gabarito').files[0];
            
            if (!provas || !gabarito) return alert("Selecione os dois arquivos (Gabarito e Provas)!");
            if (!coords.grid.w || !coords.name.w) return alert("Mapeie as áreas de Nome e Grade no canvas primeiro!");

            const formData = new FormData();
            // IMPORTANTE: Adiciona action explicitamente antes de tudo
            formData.append('action', 'process');
            formData.append('gabarito', gabarito);
            formData.append('provas', provas);
            formData.append('coords', JSON.stringify(coords));

            // Feedback Visual
            document.getElementById('btn-executar').classList.add('hidden');
            document.getElementById('progress-container').classList.remove('hidden');
            document.getElementById('area-resultados').classList.add('hidden');

            try {
                // Usamos './process.php' para evitar redirecionamentos indesejados do servidor
                const response = await fetch('./process.php', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const txt = await response.text();
                    throw new Error("Erro Crítico no Servidor: " + txt);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while(true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split("\n");
                    
                    lines.forEach(line => {
                        if(!line.trim()) return;
                        try {
                            const data = JSON.parse(line);
                            
                            if (data.error) {
                                alert("Erro no PHP: " + data.error);
                                location.reload();
                                return;
                            }

                            const pct = Math.round((data.atual / data.total) * 100);
                            document.getElementById('progress-bar').style.width = pct + '%';
                            document.getElementById('percent-text').innerText = pct + '%';
                            document.getElementById('status-text').innerText = `Processando: ${data.aluno}`;

                            if (data.concluido) {
                                finalData = data.resultados;
                                concluirInterface();
                            }
                        } catch(e) {
                            // Ignora chunks incompletos de JSON no stream
                        }
                    });
                }
            } catch (err) {
                alert(err.message);
                document.getElementById('btn-executar').classList.remove('hidden');
                document.getElementById('progress-container').classList.add('hidden');
            }
        }

        function concluirInterface() {
            document.getElementById('status-text').innerText = "Concluído com Sucesso!";
            document.getElementById('status-text').classList.replace('text-blue-400', 'text-green-400');
            document.getElementById('btn-resultados').classList.remove('hidden');
            document.getElementById('btn-resultados').disabled = false;
            document.getElementById('btn-resultados').classList.replace('bg-slate-800', 'bg-green-600');
            document.getElementById('btn-resultados').classList.replace('text-slate-500', 'text-white');
            document.getElementById('btn-resultados').classList.remove('cursor-not-allowed');
        }

        function verResultados() {
            document.getElementById('area-resultados').classList.remove('hidden');
            const corpo = document.getElementById('tabela-corpo');
            corpo.innerHTML = finalData.map(r => `
                <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-6 font-bold text-slate-100">${r.aluno}</td>
                    <td class="p-6 text-center text-green-400 font-black text-xl">${r.acertos}</td>
                    <td class="p-6 text-center text-slate-400">${r.brancos}</td>
                    <td class="p-6 text-center text-red-500">${r.rasuras}</td>
                </tr>
            `).join('');
            
            setTimeout(() => {
                window.scrollTo({ 
                    top: document.getElementById('area-resultados').offsetTop - 50, 
                    behavior: 'smooth' 
                });
            }, 100);
        }
    </script>
</body>
</html>