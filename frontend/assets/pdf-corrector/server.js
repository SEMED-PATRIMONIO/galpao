
const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const pdf2img = require('pdf-img-convert');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const jsQR = require('jsqr');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./results/gcr_database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS gabaritos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT,
        config JSON,
        respostas JSON,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS resultados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gabarito_id INTEGER,
        aluno TEXT,
        acertos INTEGER,
        em_branco INTEGER,
        invalidadas INTEGER,
        total INTEGER,
        data_importacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Helper for OMR
async function analyzeQuestion(imageBuffer, x, y, radius = 12) {
    let marks = [];
    for (let lIdx = 0; lIdx < 4; lIdx++) {
        let circleX = x + 52 + (lIdx * 52);
        const roi = await sharp(imageBuffer)
            .extract({ left: Math.round(circleX - radius), top: Math.round(y + 8 - radius), width: radius * 2, height: radius * 2 })
            .greyscale().threshold(140).raw().toBuffer({ resolveWithObject: true });
        
        let black = 0;
        for (let i = 0; i < roi.data.length; i++) if (roi.data[i] < 128) black++;
        if ((black / (roi.info.width * roi.info.height)) > 0.6) marks.push(['A','B','C','D'][lIdx]);
    }
    return marks;
}

// Routes
app.post('/gerar-gabarito', async (req, res) => {
    const { titulo, blocos, sequencia } = req.body;
    db.run("INSERT INTO gabaritos (titulo, config, respostas) VALUES (?, ?, ?)", 
           [titulo, JSON.stringify(blocos), JSON.stringify(sequencia)], async function(err) {
        const provaId = this.lastID;
        const doc = new PDFDocument({ size: 'A4', margins: 22.6 });
        const fileName = `gcr_${provaId}.pdf`;
        const filePath = path.join(__dirname, 'public/downloads', fileName);
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        const qr = await QRCode.toBuffer(`GCR-ID:${provaId}`, { margin: 0 });
        doc.image(qr, 520, 25, { width: 50 });
        doc.rect(22.6, 22.6, 15, 15).fill('black');
        doc.rect(595-22.6-15, 22.6, 15, 15).fill('black');
        doc.rect(22.6, 841-22.6-15, 15, 15).fill('black');
        doc.rect(595-22.6-15, 841-22.6-15, 15, 15).fill('black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(16).text(titulo, { align: 'center', y: 45 });
        doc.fontSize(10).rect(50, 85, 450, 25).stroke().text('ESCOLA:', 55, 93);
        doc.rect(50, 115, 450, 25).stroke().text('ESTUDANTE:', 55, 123);
        let curX = 50, curY = 190;
        let questaoGlobalIdx = 1;
        blocos.forEach((bloco) => {
            doc.font('Helvetica-Bold').fontSize(11).text(bloco.nome.toUpperCase(), curX, curY);
            curY += 20;

            for(let i=0; i < bloco.questoes; i++) {
                doc.font('Helvetica').fontSize(9).text(`${questaoGlobalIdx})`, curX, curY);
                
                // USA bloco.alternativas (4 ou 5) enviado pelo front-end
                const numAlt = bloco.alternativas || 4; 
                for(let lIdx = 0; lIdx < numAlt; lIdx++) {
                    let letra = String.fromCharCode(65 + lIdx);
                    let circleX = curX + 25 + (lIdx * 22); // Espaçamento ajustado
                    doc.circle(circleX, curY + 4, 6).stroke();
                    doc.fontSize(6).text(letra, circleX - 2, curY + 2);
                }

                questaoGlobalIdx++;
                curY += 18;
                if (curY > 780) { curY = 190; curX += 140; } // Salta de coluna
            }
            curY += 20;
        });
        doc.end();
        res.json({ sucesso: true, url: `/downloads/${fileName}` });
    });
});

app.post('/importar', upload.single('provas'), async (req, res) => {
    try {
        const pages = await pdf2img.convert(req.file.path, { width: 1240, height: 1754 });
        for (let buf of pages) {
            const raw = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const code = jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height);
            if (!code) continue;
            const provaId = code.data.split(':')[1];
            const gab = await new Promise(r => db.get("SELECT * FROM gabaritos WHERE id=?", [provaId], (e,row)=>r(row)));
            if (!gab) continue;
            const aluImg = await sharp(buf).extract({ left: 104, top: 240, width: 938, height: 52 }).toBuffer();
            const { data: { text } } = await Tesseract.recognize(aluImg, 'por');
            
            let acertos = 0, brancos = 0, invalidas = 0, total = 0;
            let cX = 104, cY = 395;
            const config = JSON.parse(gab.config);
            for (let b of config) {
                cY += 41;
                for (let i=0; i<b.questoes; i++) {
                    total++;
                    const marks = await analyzeQuestion(buf, cX, cY);
                    if (marks.length === 0) brancos++;
                    else if (marks.length > 1) invalidas++;
                    else if (marks[0] === 'A') acertos++; // Simulação: 'A' é a correta
                    cY += 37; if (cY > 1622) { cY = 395; cX += 270; }
                }
                cY += 41;
            }
            db.run("INSERT INTO resultados (gabarito_id, aluno, acertos, em_branco, invalidadas, total) VALUES (?, ?, ?, ?, ?, ?)", 
                   [provaId, text.trim(), acertos, brancos, invalidas, total]);
        }
        res.json({ sucesso: true });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.get('/gabaritos', (req, res) => {
    db.all("SELECT id, titulo FROM gabaritos", (e, rows) => res.json(rows));
});

app.get('/estatisticas/:id', (req, res) => {
    db.all("SELECT * FROM resultados WHERE gabarito_id = ?", [req.params.id], (e, rows) => res.json(rows));
});

// RELATÓRIO PDF A4
app.get('/relatorio-pdf/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT titulo FROM gabaritos WHERE id = ?", [id], (err, gab) => {
        db.all("SELECT * FROM resultados WHERE gabarito_id = ?", [id], (err, rows) => {
            const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 40, right: 40 } });
            res.setHeader('Content-Type', 'application/pdf');
            doc.pipe(res);

            // Header do Relatório
            doc.fontSize(18).font('Helvetica-Bold').text('RELATÓRIO DE DESEMPENHO', { align: 'center' });
            doc.fontSize(12).text(`PROVA: ${gab.titulo}`, { align: 'center' });
            doc.moveDown();

            // Tabela
            const tableTop = 150;
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text('ALUNO', 40, tableTop);
            doc.text('ACERTOS', 300, tableTop);
            doc.text('BRANCOS', 370, tableTop);
            doc.text('INVÁLIDAS', 440, tableTop);
            doc.text('NOTA %', 510, tableTop);
            doc.moveTo(40, tableTop + 15).lineTo(550, tableTop + 15).stroke();

            let y = tableTop + 25;
            doc.font('Helvetica').fontSize(9);
            rows.forEach((r, i) => {
                if (y > 750) {
                    doc.addPage();
                    y = 50;
                }
                const perc = ((r.acertos / r.total) * 100).toFixed(1);
                doc.text(r.aluno || 'N/A', 40, y, { width: 250, height: 15, ellipsis: true });
                doc.text(r.acertos, 300, y);
                doc.text(r.em_branco, 370, y);
                doc.text(r.invalidadas, 440, y);
                doc.text(`${perc}%`, 510, y);
                y += 20;
            });

            // Footer com numeração (canto inferior externo)
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                const pageNum = i + 1;
                const isEven = pageNum % 2 === 0;
                doc.fontSize(8).fillColor('grey');
                if (isEven) {
                    doc.text(`Página ${pageNum}`, 40, 800, { align: 'left' });
                } else {
                    doc.text(`Página ${pageNum}`, 0, 800, { align: 'right', width: 555 });
                }
            }
            doc.end();
        });
    });
});

app.listen(3037, () => console.log('GCR Enterprise 2.0'));
