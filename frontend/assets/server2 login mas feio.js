const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const puppeteer = require('puppeteer'); // Certifique-se de ter instalado: npm install puppeteer

const SECRET_KEY = "Onwcems1*Gatosap2009*2WaGaSadti*1";
const pool = new Pool({
    user: 'postgres', host: 'localhost', database: 'omeq_db',
    password: 'Gatosap2009*2', port: 5432,
});

const appCadastro = express();     // 3004
const appPainel = express();       // 3005
const appPais = express();         // 3011
const appProfissional = express(); // 3012

[appCadastro, appPainel, appPais, appProfissional].forEach(app => {
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
});

appCadastro.use(express.static('public_cadastro'));
appPainel.use(express.static('public_painel'));
appPais.use(express.static('public_pais'));
appProfissional.use(express.static('public_profissional'));

// Middleware de Autenticação
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: "Acesso negado." });
    try {
        const tokenLimpo = token.startsWith('Bearer ') ? token.slice(7) : token;
        req.usuarioLogado = jwt.verify(tokenLimpo, SECRET_KEY);
        next();
    } catch (err) { return res.status(401).json({ error: "Sessão expirada." }); }
};

// LOGIN PARA EQUIPE (Cadastro e Painel) - Corrigido para suas colunas reais
const loginEquipeGenerico = async (req, res) => {
    const { login, senha } = req.body;
    try {
        const result = await pool.query(
            "SELECT id, nome, senha_hash FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true", 
            [login]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Usuário não encontrado." });
        }

        const usuario = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({ error: "Senha incorreta." });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome }, 
            SECRET_KEY, 
            { expiresIn: '12h' }
        );

        res.json({ success: true, token, user: { nome: usuario.nome } });
    } catch (err) {
        console.error("Erro no Login:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
};

appCadastro.post('/api/login', loginEquipeGenerico);
appPainel.post('/api/login', loginEquipeGenerico);

// --- ROTAS DO CADASTRO (3004) ---
appCadastro.get('/api/alunos/listar', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, nome_completo, ra, escola FROM aee_alunos ORDER BY nome_completo ASC"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar alunos." });
    }
});

appCadastro.post('/api/v2/alunos/cadastrar', verificarToken, async (req, res) => {
    const { nome, ra, escola } = req.body;
    try {
        const novo = await pool.query(
            "INSERT INTO aee_alunos (nome_completo, ra, escola, criado_por_usuario_id) VALUES ($1, $2, $3, $4) RETURNING id",
            [nome, ra, escola, req.usuarioLogado.id]
        );
        await pool.query("INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) VALUES ($1, $2, $3, $4)",
            [req.usuarioLogado.id, 'CADASTRO ALUNO', novo.rows[0].id, `Aluno ${nome} cadastrado.`]);
        res.json({ success: true, id: novo.rows[0].id });
    } catch (err) { res.status(500).json({ error: "Erro ao cadastrar aluno." }); }
});

// --- ROTAS DO PAINEL (3005) ---
appPainel.get('/api/v2/painel/contagem-total', verificarToken, async (req, res) => {
    try {
        const alunos = await pool.query('SELECT count(*) FROM aee_alunos');
        const agendamentos = await pool.query("SELECT count(*) FROM aee_agendamentos WHERE status = 'Agendado'");
        const familias = await pool.query('SELECT count(*) FROM aee_usuarios_pais');
        const alertas = await pool.query("SELECT count(*) FROM aee_agendamentos WHERE data_hora < NOW() AND status = 'Agendado'");
        res.json({
            totalAlunos: alunos.rows[0].count,
            totalAgendamentos: agendamentos.rows[0].count,
            totalFamilias: familias.rows[0].count,
            totalAlertas: alertas.rows[0].count
        });
    } catch (err) { res.status(500).json({ error: "Erro nos totais" }); }
});

// --- ROTA DE RELATÓRIO PDF ---
appCadastro.post('/api/v2/relatorio/gerar', verificarToken, async (req, res) => {
    const { tabela } = req.body;
    const config = {
        alunos: { titulo: 'Relatório Geral de Alunos (AEE)', tabelaDB: 'aee_alunos', ordem: 'nome_completo' },
        pais: { titulo: 'Relatório de Acessos: Pais e Responsáveis', tabelaDB: 'aee_usuarios_pais', ordem: 'usuario' },
        profissionais: { titulo: 'Relatório de Profissionais de Saúde', tabelaDB: 'aee_profissionais_saude', ordem: 'nome' },
        usuarios: { titulo: 'Relatório de Usuários da Equipe', tabelaDB: 'aee_usuarios_equipe', ordem: 'nome' }
    };
    const sel = config[tabela];
    try {
        const result = await pool.query(`SELECT * FROM ${sel.tabelaDB} WHERE ativo = true ORDER BY ${sel.ordem} ASC`);
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        let htmlContent = `<html><body><h1>${sel.titulo}</h1><table border="1">
            ${result.rows.map(r => `<tr><td>${r.nome_completo || r.nome || r.usuario}</td><td>${r.ra || r.escola || '-'}</td></tr>`).join('')}
        </table></body></html>`;
        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await browser.close();
        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) { res.status(500).send("Erro ao gerar PDF"); }
});

// Portas
appCadastro.listen(3004, () => console.log("Cadastro rodando na 3004"));
appPainel.listen(3005, () => console.log("Painel rodando na 3005"));
appPais.listen(3011, () => console.log("Portal Pais rodando na 3011"));
appProfissional.listen(3012, () => console.log("Profissional rodando na 3012"));