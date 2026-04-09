const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

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

// Login Unificado para Equipe (Cadastro e Painel)
const loginEquipe = async (req, res) => {
    const { login, senha } = req.body;
    try {
        // LOWER(login) para ignorar maiúsculas/minúsculas no nome de usuário
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_equipe WHERE LOWER(login) = LOWER($1) AND ativo = true', 
            [login]
        );

        if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado." });

        const usuario = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) return res.status(401).json({ error: "Senha incorreta." });

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, tipo: 'equipe' }, 
            SECRET_KEY, { expiresIn: '8h' }
        );
        res.json({ success: true, token, user: { nome: usuario.nome } });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
};

appCadastro.post('/api/login', loginEquipe);
appPainel.post('/api/login', loginEquipe);

// --- Outras rotas do appCadastro ---
appCadastro.post('/api/alunos/cadastrar', verificarToken, async (req, res) => {
    const { nome, ra, escola } = req.body;
    const usuario_id = req.usuarioLogado.id; // Corrigido de req.user para req.usuarioLogado
    try {
        const novo = await pool.query(
            `INSERT INTO aee_alunos (nome_completo, ra, escola, criado_por_usuario_id) VALUES ($1, $2, $3, $4) RETURNING id`, 
            [nome, ra, escola, usuario_id]
        );
        res.json({ success: true, id: novo.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inicialização dos Servidores
appCadastro.listen(3004, () => console.log("Cadastro rodando na 3004"));
appPainel.listen(3005, () => console.log("Painel rodando na 3005"));
appPais.listen(3011, () => console.log("Portal Pais rodando na 3011"));
appProfissional.listen(3012, () => console.log("Profissional rodando na 3012"));
