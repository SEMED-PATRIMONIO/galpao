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

// --- ESTILO CSS COMPARTILHADO PARA OS PDFs ---
const cssPdf = `
    @page { size: A4; margin: 0mm; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; color: #000; }
    .ficha { page-break-after: always; padding: 10mm; position: relative; height: 297mm; box-sizing: border-box; background: white; }
    
    /* Cabeçalho no topo absoluto */
    .header-logos { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        margin-bottom: 5px;
        height: 45px;
    }
    .logo-esq { width: 100px; text-align: left; }
    .logo-cen { flex-grow: 1; text-align: center; }
    .spacer-dir { width: 100px; }
    
    .logo-esq img { height: 32px; width: auto; }
    .logo-cen img { height: 38px; width: auto; }
    
    .titulo-ficha { 
        text-align: center; 
        border-top: 1.5px solid #004587; 
        border-bottom: 1.5px solid #004587;
        padding: 4px 0;
        margin-bottom: 12px;
    }
    .titulo-ficha h1 { font-size: 11pt; margin: 0; text-transform: uppercase; font-weight: bold; }
    .titulo-ficha p { font-size: 9.5pt; margin: 0; font-weight: bold; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px; font-size: 8.5pt; }
    .info-grid p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    th, td { border: 1px solid #333; padding: 4px; text-align: left; font-size: 8.5pt; height: 18px; }
    th { background: #f2f2f2; text-align: center; font-weight: bold; }
    .footer { position: absolute; bottom: 10mm; right: 10mm; font-size: 7pt; color: #666; text-align: right; }
`;

// --- CONFIGURAÇÃO PORTA 3023 (OLITEMQ QUIZ) ---
appQuiz.use(express.static('public_quiz'));

appQuiz.get('/buscar', async (req, res) => {
    const { escola, turma } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM inscricoes_olitemq WHERE escola = $1 AND turma = $2',
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
            `INSERT INTO inscricoes_olitemq (escola, ano, email, turma, turno, alunos, ip_endereco, data_hora_envio)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (escola, turma) 
             DO UPDATE SET ano = $2, email = $3, turno = $5, alunos = $6, ip_endereco = $7, data_hora_envio = NOW()`,
            [escola, ano, email, turma, turno, JSON.stringify(alunos), ipReal]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CONFIGURAÇÃO PORTA 3024 (OLITEMQ DASHBOARD) ---
appDash.use(express.static('public_dash'));

appDash.get('/dados', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_olitemq ORDER BY data_hora_envio DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar dados." });
    }
});

appDash.get('/gerar-pdf-individual/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_olitemq WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).send("Não encontrado");
        const r = rows[0];
        const lista = typeof r.alunos === 'string' ? JSON.parse(r.alunos) : r.alunos;
        
        const html = `<html><head><style>${cssPdf}</style></head><body>
            <div class="ficha">
                <div class="header-logos">
                    <div class="logo-esq"><img src="http://localhost:3024/logobrasao.png"></div>
                    <div class="logo-cen"><img src="http://localhost:3024/olitemq.png"></div>
                    <div class="spacer-dir"></div>
                </div>
                <div class="titulo-ficha">
                    <h1>OLIMPÍADA DE LITERATURA DAS ESCOLAS MUNICIPAIS DE QUEIMADOS</h1>
                    <p>Ficha Oficial de Inscrição de Turma</p>
                </div>
                <div class="info-grid">
                    <p><b>Escola:</b> ${r.escola}</p><p><b>Turma:</b> ${r.turma}</p>
                    <p><b>Ano:</b> ${r.ano}</p><p><b>Turno:</b> ${r.turno}</p>
                    <p><b>E-mail:</b> ${r.email}</p><p><b>Auditado em:</b> ${new Date(r.data_hora_envio).toLocaleString('pt-BR')}</p>
                </div>
                <table>
                    <thead><tr><th width="25">Nº</th><th width="230">Nome Completo do Aluno</th><th>Assinatura</th></tr></thead>
                    <tbody>${Array.from({length: 15}).map((_, i) => `<tr><td align="center">${i+1}</td><td>${lista[i] || ''}</td><td></td></tr>`).join('')}</tbody>
                </table>
                <div class="footer">Protocolo: ${r.id} | IP: ${r.ip_endereco} | OMEQ 2026</div>
            </div></body></html>`;

        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html);
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        res.contentType("application/pdf").send(pdf);
    } catch (err) { res.status(500).send(err.message); }
});

appDash.get('/gerar-pdf-geral', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_olitemq ORDER BY escola, turma');
        let htmlPages = rows.map(r => {
            const lista = typeof r.alunos === 'string' ? JSON.parse(r.alunos) : r.alunos;
            return `
            <div class="ficha">
                <div class="header-logos">
                    <div class="logo-esq"><img src="http://localhost:3024/logobrasao.png" style="height:22px;"></div>
                    <div class="logo-cen"><img src="http://localhost:3024/olitemq.png" style="height:25px;"></div>
                    <div class="spacer-dir"></div>
                </div>
                <div class="titulo-ficha">
                    <h1>OLIMPÍADA DE LITERATURA DAS ESCOLAS MUNICIPAIS DE QUEIMADOS</h1>
                    <p>Ficha Oficial de Inscrição de Turma</p>
                </div>
                <div class="info-grid">
                    <p><b>Escola:</b> ${r.escola}</p><p><b>Turma:</b> ${r.turma}</p>
                    <p><b>Ano:</b> ${r.ano}</p><p><b>Turno:</b> ${r.turno}</p>
                </div>
                <table>
                    <thead><tr><th width="25">Nº</th><th width="230">Nome Completo do Aluno</th><th>Assinatura</th></tr></thead>
                    <tbody>${Array.from({length: 15}).map((_, i) => `<tr><td align="center">${i+1}</td><td>${lista[i] || ''}</td><td></td></tr>`).join('')}</tbody>
                </table>
                <div class="footer">Protocolo: ${r.id} | IP: ${r.ip_endereco}</div>
            </div>`;
        }).join('');

        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(`<html><head><style>${cssPdf}</style></head><body>${htmlPages}</body></html>`);
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        res.contentType("application/pdf").send(pdf);
    } catch (err) { res.status(500).send(err.message); }
});

appQuiz.listen(3023, () => { console.log(`🚀 Form OLITEMQ rodando na porta 3023`); });
appDash.listen(3024, () => { console.log(`📊 Dashboard rodando na porta 3024`); });