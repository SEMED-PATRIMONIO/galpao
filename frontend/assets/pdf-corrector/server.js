const express = require('express');
const multer = require('multer');
const pdf2img = require('pdf-img-convert');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

// Configuração do CSV
const csvWriter = (filePath) => createObjectCsvWriter({
    path: filePath,
    header: [
        {id: 'data', title: 'DATA_HORA'},
        {id: 'escola', title: 'ESCOLA'},
        {id: 'aluno', title: 'ALUNO'},
        {id: 'turma', title: 'TURMA'},
        {id: 'questoes', title: 'TOTAL_QUESTOES'},
        {id: 'acertos', title: 'ACERTOS'},
        {id: 'branco', title: 'EM_BRANCO'},
        {id: 'invalidas', title: 'INVALIDADAS'}
    ],
    append: true
});

app.post('/processar', upload.single('pdfAlunos'), async (req, res) => {
    const config = JSON.parse(req.body.config); // Coordenadas do frontend
    const pdfPath = req.file.path;
    
    // Server-Sent Events para Barra de Progresso
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        const outputImages = await pdf2img.convert(pdfPath, { width: 1240, height: 1754 }); // A4 150DPI
        const totalPaginas = outputImages.length;
        const csvPath = path.join(__dirname, 'results', `resultado_${Date.now()}.csv`);
        const writer = csvWriter(csvPath);

        for (let i = 0; i < totalPaginas; i++) {
            const pageImg = outputImages[i];
            
            // 1. OCR dos campos de texto
            const escola = await extrairTexto(pageImg, config.areaEscola);
            const aluno = await extrairTexto(pageImg, config.areaAluno);
            const turma = await extrairTexto(pageImg, config.areaTurma);

            // 2. Lógica OMR (Questões)
            let resultados = { acertos: 0, branco: 0, invalidas: 0, total: config.questoes.length };

            for (const q of config.questoes) {
                let marcadas = [];
                for (const opt of q.opcoes) {
                    const preenchido = await checkFill(pageImg, opt.x, opt.y, opt.w, opt.h);
                    if (preenchido) marcadas.push(opt.valor);
                }

                if (marcadas.length === 0) resultados.branco++;
                else if (marcadas.length > 1) resultados.invalidas++;
                else {
                    if (marcadas[0] === q.correta) resultados.acertos++;
                }
            }

            // 3. Salvar no CSV
            await writer.writeRecords([{
                data: new Date().toLocaleString(),
                escola, aluno, turma,
                questoes: resultados.total,
                acertos: resultados.acertos,
                branco: resultados.branco,
                invalidas: resultados.invalidas
            }]);

            // Enviar progresso
            res.write(`data: ${JSON.stringify({ progresso: Math.round(((i + 1) / totalPaginas) * 100) })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ finalizado: true, link: csvPath })}\n\n`);
        res.end();
    } catch (err) {
        console.error(err);
        res.end();
    }
});

async function checkFill(buffer, x, y, w, h) {
    const { data, info } = await sharp(buffer)
        .extract({ left: x, top: y, width: w, height: h })
        .threshold(128) // Transforma em P&B puro
        .toBuffer({ resolveWithObject: true });

    let darkPixels = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i] === 0) darkPixels++; // 0 é preto após threshold
    }
    const percent = (darkPixels / (info.width * info.height)) * 100;
    return percent >= 90;
}

async function extrairTexto(buffer, area) {
    const crop = await sharp(buffer).extract({ left: area.x, top: area.y, width: area.w, height: area.h }).toBuffer();
    const { data: { text } } = await Tesseract.recognize(crop, 'por');
    return text.trim();
}

app.listen(3037, () => console.log('Servidor rodando na porta 3037'));