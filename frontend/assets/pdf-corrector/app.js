async function iniciarProcessamento() {
    const configStr = localStorage.getItem('gabaritoConfig');
    if (!configStr) {
        alert("Erro: Você precisa configurar o gabarito no Mapeador primeiro.");
        return;
    }

    const pdfFile = document.getElementById('pdfAlunos').files[0];
    if (!pdfFile) {
        alert("Por favor, selecione o PDF com as respostas dos alunos.");
        return;
    }

    const formData = new FormData();
    formData.append('pdfAlunos', pdfFile);
    formData.append('config', configStr);

    document.getElementById('progress-container').style.display = 'block';
    const bar = document.getElementById('bar');
    const percentTxt = document.getElementById('percent');

    // Usando Fetch com Stream para ler o progresso (SSE alternativo)
    const response = await fetch('/processar', {
        method: 'POST',
        body: formData
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        lines.forEach(line => {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.replace('data: ', ''));
                
                if (data.progresso) {
                    bar.style.width = data.progresso + '%';
                    percentTxt.innerText = data.progresso + '%';
                }

                if (data.finalizado) {
                    alert("Processamento concluído! O arquivo CSV foi gerado na pasta 'results'.");
                }
            }
        });
    }
}