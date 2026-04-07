const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Para uploads de fotos

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'omeq_db',
    password: 'Gatosap2009*2', // Sua senha padrão
    port: 5432,
});

// Configuração de Upload de Evidências
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- DEFINIÇÃO DOS 3 APLICATIVOS ---
const appCadastro = express(); // Porta 3004
const appPainel = express();   // Porta 3005
const appPais = express();     // Porta 3011

[appCadastro, appPainel, appPais].forEach(app => {
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static('uploads'));
});

// Servir os arquivos estáticos de cada pasta
appCadastro.use(express.static('public_cadastro'));
appPainel.use(express.static('public_painel'));
appPais.use(express.static('public_pais'));

// --- ROTAS DO SISTEMA (Resumo das funcionalidades) ---

// 1. Cadastro de Aluno
appCadastro.post('/api/alunos', async (req, res) => {
    const { nome, ra, escola, especialidades, carga } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO aee_alunos (nome_completo, ra, escola, especialidades, carga_horaria) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [nome, ra, escola, JSON.stringify(especialidades), JSON.stringify(carga)]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Registro de Atendimento com Upload
appPainel.post('/api/atendimento', upload.single('foto'), async (req, res) => {
    const { aluno_id, especialidade, data_hora, status, evolucao } = req.body;
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        await pool.query(
            'INSERT INTO aee_atendimentos (aluno_id, especialidade, data_hora, status, evolucao, evidencia_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [aluno_id, especialidade, data_hora, status, evolucao, foto_url]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Login dos Pais (LGPD)
appPais.post('/api/login', async (req, res) => {
    const { usuario, pin } = req.body;
    try {
        const result = await pool.query(
            'SELECT a.*, u.usuario FROM aee_alunos a JOIN aee_usuarios_pais u ON a.id = u.aluno_id WHERE u.usuario = $1 AND u.senha_pin = $2',
            [usuario, pin]
        );
        if (result.rows.length > 0) res.json({ success: true, aluno: result.rows[0] });
        else res.status(401).json({ success: false, message: "Usuário ou PIN incorretos." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

appPainel.get('/api/listagem-alunos', async (req, res) => {
    const result = await pool.query('SELECT id, nome_completo, ra FROM aee_alunos ORDER BY nome_completo');
    res.json(result.rows);
});

// Rota para Gerar/Criar Acesso do Pai
appPainel.post('/api/gerar-acesso', async (req, res) => {
    const { aluno_id, usuario } = req.body;
    
    // Gerar PIN de 5 dígitos (apenas números)
    const pinAleatorio = Math.floor(10000 + Math.random() * 90000).toString();

    try {
        await pool.query(
            `INSERT INTO aee_usuarios_pais (aluno_id, usuario, senha_pin, ativo) 
             VALUES ($1, $2, $3, true)
             ON CONFLICT (aluno_id) DO UPDATE SET usuario = $2, senha_pin = $3, ativo = true`,
            [aluno_id, usuario, pinAleatorio]
        );
        res.json({ success: true, pin: pinAleatorio });
    } catch (err) {
        res.status(500).json({ error: "Usuário já existe ou erro no banco." });
    }
});

// Rota para Inativar/Reativar Acesso
appPainel.patch('/api/toggle-acesso/:id', async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    try {
        await pool.query('UPDATE aee_usuarios_pais SET ativo = $1 WHERE id = $2', [ativo, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listagem de Alunos com Status de Acesso
appPainel.get('/api/lista-gestao-acesso', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id as aluno_id, a.nome_completo, a.ra, u.id as acesso_id, u.usuario, u.ativo, u.senha_pin
            FROM aee_alunos a 
            LEFT JOIN aee_usuarios_pais u ON a.id = u.aluno_id 
            ORDER BY a.nome_completo
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login do Pai com verificação de primeiro acesso
appPais.post('/api/login-pais', async (req, res) => {
    const { usuario, pin } = req.body;
    try {
        const result = await pool.query(
            'SELECT u.*, a.nome_completo FROM aee_usuarios_pais u JOIN aee_alunos a ON u.aluno_id = a.id WHERE u.usuario = $1 AND u.senha_pin = $2 AND u.ativo = true',
            [usuario, pin]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: "Acesso negado." });
        }
    } catch (err) { res.status(500).send(err.message); }
});

// Troca de Senha (PIN)
appPais.post('/api/alterar-pin', async (req, res) => {
    const { usuario_id, novo_pin } = req.body;
    try {
        await pool.query(
            'UPDATE aee_usuarios_pais SET senha_pin = $1, primeiro_acesso = false WHERE id = $2',
            [novo_pin, usuario_id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Busca Dados do Filho (LGPD: Somente o vinculado ao usuário)
appPais.get('/api/meu-filho/:aluno_id', async (req, res) => {
    const { aluno_id } = req.params;
    try {
        const aluno = await pool.query('SELECT * FROM aee_alunos WHERE id = $1', [aluno_id]);
        const historico = await pool.query('SELECT * FROM aee_atendimentos WHERE aluno_id = $1 ORDER BY data_hora DESC', [aluno_id]);
        res.json({ aluno: aluno.rows[0], historico: historico.rows });
    } catch (err) { res.status(500).send(err.message); }
});

// --- INICIALIZAÇÃO DOS SERVIDORES ---
appCadastro.listen(3004, () => console.log('✅ Cadastro AEE: Porta 3004'));
appPainel.listen(3005, () => console.log('✅ Painel Gestão AEE: Porta 3005'));
appPais.listen(3011, () => console.log('✅ Portal dos Pais: Porta 3011'));