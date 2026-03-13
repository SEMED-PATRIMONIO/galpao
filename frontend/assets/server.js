const express = require('express');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const cors = require('cors');

// 1. Configuração do Postgres
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'omeq_db',
    password: 'Gatosap2009*2',
    port: 5432,
});

// Criamos dois APPs independentes
const appQuiz = express();
const appDash = express();

// Middleware para ambos
appQuiz.use(cors());
appQuiz.use(express.json());
appDash.use(cors());
appDash.use(express.json());

// --- CONFIGURAÇÃO PORTA 3020 (OMEQ QUIZ) ---

// Serve o Quiz na raiz da porta 3020
appQuiz.use(express.static('public_quiz'));

appQuiz.get('/buscar', async (req, res) => {
    const { escola, turma } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM inscricoes_omeq WHERE escola = $1 AND turma = $2',
            [escola, turma]
        );
        res.json(result.rows.length > 0 ? { encontrado: true, dados: result.rows[0] } : { encontrado: false });
    } catch (err) {
        res.status(500).json({ error: "Erro na busca." });
    }
});

appQuiz.post('/salvar', async (req, res) => {
    const { escola, ano, email, turma, turno, alunos } = req.body;
    const ipReal = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        await pool.query(
            `INSERT INTO inscricoes_omeq (escola, ano, email, turma, turno, alunos, ip_endereco, data_hora_envio)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (escola, turma) 
             DO UPDATE SET ano = $2, email = $3, turno = $5, alunos = $6, ip_endereco = $7, data_hora_envio = NOW()`,
            [escola, ano, email, turma, turno, JSON.stringify(alunos), ipReal]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("ERRO AO SALVAR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- CONFIGURAÇÃO PORTA 3021 (DASHBOARD) ---

// Serve o Dashboard na raiz da porta 3021 (não precisa mais de /admin no URL)
appDash.use(express.static('public_dash'));

appDash.get('/dados', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_omeq ORDER BY data_hora_envio DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar dados." });
    }
});

appDash.get('/gerar-pdf-geral', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_omeq ORDER BY escola, turma');
        let htmlContent = `<html><head><style>
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Times New Roman', serif; }
            .ficha { page-break-after: always; padding: 20px; border: 1px solid #eee; position: relative; min-height: 270mm; }
            .header { text-align: center; border-bottom: 2px solid #004587; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #333; padding: 6px; }
            th { background: #f0f0f0; }
        </style></head><body>`;

        rows.forEach(r => {
            const lista = typeof r.alunos === 'string' ? JSON.parse(r.alunos) : r.alunos;
            htmlContent += `
                <div class="ficha">
                    <div class="header">
                        <h1>OMEQ - OLIMPÍADA DE MATEMÁTICA</h1>
                        <p>Ficha Oficial de Inscrição</p>
                    </div>
                    <p><b>Escola:</b> ${r.escola} | <b>Turma:</b> ${r.turma}</p>
                    <table>
                        <thead><tr><th>Nº</th><th>Nome do Aluno</th></tr></thead>
                        <tbody>${lista.map((n, i) => n ? `<tr><td align="center">${i+1}</td><td>${n}</td></tr>` : '').join('')}</tbody>
                    </table>
                </div>`;
        });

        htmlContent += `</body></html>`;
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) {
        res.status(500).send("Erro ao gerar PDF.");
    }
});

// Inicialização dos dois servidores
appQuiz.listen(3020, () => { console.log(`🚀 Form OMEQ rodando na porta 3020`); });
appDash.listen(3021, () => { console.log(`📊 Dashboard rodando na porta 3021`); });