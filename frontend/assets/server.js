const express = require('express');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

// 1. Configuração do Postgres (Sem senha conforme solicitado)
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'omeq_db',
    port: 5432,
});

const app = express();
app.use(cors());
app.use(express.json());

// Servir os arquivos estáticos
app.use(express.static('public_quiz')); // Quiz na raiz
app.use('/admin', express.static('public_dash')); // Dashboard em /admin

// 2. ROTA: Buscar registro existente (Escola + Turma)
// Essencial para o preenchimento automático ao editar
app.get('/buscar', async (req, res) => {
    const { escola, turma } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM inscricoes_omeq WHERE escola = $1 AND turma = $2',
            [escola, turma]
        );
        if (result.rows.length > 0) {
            res.json({ encontrado: true, dados: result.rows[0] });
        } else {
            res.json({ encontrado: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro na busca do banco de dados." });
    }
});

// 3. ROTA: Salvar/Atualizar Inscrição com Auditoria de IP
app.post('/salvar', async (req, res) => { // Corrigido de appQuiz para app
    const { escola, ano, email, turma, turno, alunos } = req.body;

    // CAPTURA DO IP AUTOMÁTICA
    const ipReal = req.headers['cf-connecting-ip'] || 
                   req.headers['x-forwarded-for'] || 
                   req.socket.remoteAddress;

    try {
        await pool.query(
            `INSERT INTO inscricoes_omeq (escola, ano, email, turma, turno, alunos, ip_endereco, data_hora_envio)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (escola, turma) -- CORRIGIDO: Deve ser 'turma' para bater com o banco
             DO UPDATE SET 
                ano = $2, 
                email = $3, 
                turno = $5, 
                alunos = $6, 
                ip_endereco = $7, 
                data_hora_envio = NOW()`,
            [escola, ano, email, turma, turno, JSON.stringify(alunos), ipReal]
        );
        res.json({ success: true });
    } catch (err) {
        // Isso vai mostrar o erro exato no terminal onde o Node está rodando
        console.error("ERRO NO POSTGRES:", err.message); 
        res.status(500).json({ error: err.message });
    }
});

// 4. ROTA: Dados para o Dashboard
app.get('/dados', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_omeq ORDER BY data_hora_envio DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar dados." });
    }
});

// 5. ROTA: Gerar PDF Geral (A4 Retrato - Todas as Fichas)
app.get('/gerar-pdf-geral', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inscricoes_omeq ORDER BY escola, turma');
        
        let htmlContent = `
            <html>
            <head>
                <style>
                    @page { size: A4; margin: 10mm; }
                    body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; }
                    .ficha { page-break-after: always; padding: 20px; border: 1px solid #eee; position: relative; min-height: 270mm; }
                    .header { text-align: center; border-bottom: 2px solid #004587; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { font-size: 16pt; margin: 5px 0; text-transform: uppercase; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 11pt; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #333; padding: 6px; text-align: left; font-size: 10pt; }
                    th { background: #f0f0f0; text-align: center; }
                    .footer { position: absolute; bottom: 10px; width: 100%; font-size: 8pt; color: #777; text-align: right; }
                </style>
            </head>
            <body>`;

        rows.forEach(r => {
            const lista = typeof r.alunos === 'string' ? JSON.parse(r.alunos) : r.alunos;
            htmlContent += `
                <div class="ficha">
                    <div class="header">
                        <h1>OLIMPÍADA DE MATEMÁTICA ESTUDANTIL DE QUEIMADOS</h1>
                        <p>Ficha Oficial de Inscrição de Turma</p>
                    </div>
                    <div class="info-grid">
                        <p><b>Escola:</b> ${r.escola}</p>
                        <p><b>Turma:</b> ${r.turma}</p>
                        <p><b>Ano:</b> ${r.ano}</p>
                        <p><b>Turno:</b> ${r.turno}</p>
                        <p><b>E-mail:</b> ${r.email}</p>
                        <p><b>Auditado em:</b> ${new Date(r.data_hora_envio).toLocaleString('pt-BR')}</p>
                    </div>
                    <table>
                        <thead><tr><th width="30">Nº</th><th>Nome Completo do Aluno</th></tr></thead>
                        <tbody>
                            ${lista.map((n, i) => n ? `<tr><td align="center">${i+1}</td><td>${n}</td></tr>` : '').join('')}
                        </tbody>
                    </table>
                    <div class="footer">Protocolo: ${r.id} | IP: ${r.ip_endereco} | OMEQ 2026</div>
                </div>`;
        });

        htmlContent += `</body></html>`;

        const browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao gerar PDF.");
    }
});

// Inicialização (Gerencia as portas conforme Nginx Proxy)
const PORT = 3020;
app.listen(PORT, () => {
    console.log(`Servidor OMEQ rodando na porta ${PORT}`);
});
