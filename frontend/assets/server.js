const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const pool = require('./config/database.js');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- MIDDLEWARES DE SEGURANÇA E PERMISSÃO ---

const requererAutenticacao = (req, res, next) => {
  if (req.session && req.session.usuarioId) return next();
  res.redirect('/login');
};

const verificarPermissao = (perfisPermitidos) => {
  return (req, res, next) => {
    if (perfisPermitidos.includes(req.session.usuarioPerfil)) return next();
    res.status(403).send("Acesso Negado: Seu perfil não tem permissão para esta ação.");
  };
};

app.use((req, res, next) => {
  res.locals.usuario = req.session.usuarioNome || null;
  res.locals.perfil = req.session.usuarioPerfil || null;
  next();
});

// --- AUTENTICAÇÃO ---

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
  const { username, senha } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1 AND ativo = true', [username]);
    if (result.rows.length > 0) {
      const usuario = result.rows[0];
      const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
      if (senhaValida) {
        req.session.usuarioId = usuario.id;
        req.session.usuarioNome = usuario.nome;
        req.session.usuarioPerfil = usuario.perfil;
        return res.redirect('/');
      }
    }
    res.render('login', { erro: 'Usuário ou senha incorretos.' });
  } catch (err) {
    console.error(err);
    res.render('login', { erro: 'Erro interno no servidor.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --- DASHBOARD (Leitor, Operador e Admin podem ver) ---
app.get('/', requererAutenticacao, async (req, res) => {
  try {
    const escolas = await pool.query('SELECT id, nome FROM escolas WHERE ativo = true ORDER BY nome');
    const departamentos = await pool.query('SELECT id, nome, sigla FROM departamentos WHERE ativo = true ORDER BY sigla');

    let sql = `
      SELECT d.*, e.nome as nome_escola, n.nome as nome_natureza 
      FROM demandas d
      LEFT JOIN escolas e ON d.escola_id = e.id
      LEFT JOIN naturezas n ON d.natureza_id = n.id
      WHERE d.ativo = true
    `;
    let parametros = [];
    let contador = 1;

    if (req.query.ano) {
      sql += ` AND EXTRACT(YEAR FROM d.data_registro) = $${contador}`;
      parametros.push(req.query.ano);
      contador++;
    }
    if (req.query.status) {
      sql += ` AND d.status = $${contador}`;
      parametros.push(req.query.status);
      contador++;
    }
    if (req.query.escola_id) {
      sql += ` AND d.escola_id = $${contador}`;
      parametros.push(req.query.escola_id);
      contador++;
    }
    if (req.query.busca) {
      sql += ` AND (d.requerente ILIKE $${contador} OR d.protocolo ILIKE $${contador})`;
      parametros.push(`%${req.query.busca}%`);
      contador++;
    }

    sql += ' ORDER BY d.data_registro DESC';
    const demandasResult = await pool.query(sql, parametros);
    
    res.render('dashboard', { demandas: demandasResult.rows, escolas: escolas.rows, departamentos: departamentos.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar dados.");
  }
});

// --- INSERÇÃO E EDIÇÃO DE CASOS (Apenas Operador e Admin) ---
app.get('/nova-demanda', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  const escolas = await pool.query('SELECT id, nome FROM escolas WHERE ativo = true ORDER BY nome');
  const naturezas = await pool.query('SELECT id, nome FROM naturezas WHERE ativo = true ORDER BY nome');
  res.render('nova-demanda', { escolas: escolas.rows, naturezas: naturezas.rows });
});

app.post('/nova-demanda', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  const d = req.body;
  const sql = `INSERT INTO demandas (protocolo, data_registro, prazo_final, status, requerente, cpf, envolvimento, escola_id, natureza_id, descricao_resumida) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
  await pool.query(sql, [d.protocolo, d.data_registro, d.prazo_final || null, d.status, d.requerente, d.cpf, d.envolvimento, d.escola_id || null, d.natureza_id || null, d.descricao_resumida]);
  res.redirect('/');
});

// --- REMOÇÃO/INATIVAÇÃO (Apenas Admin pode inativar/reativar) ---
app.post('/demandas/:id/inativar', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  await pool.query('UPDATE demandas SET ativo = false WHERE id = $1', [req.params.id]);
  res.redirect('/');
});

// --- CRUD DE USUÁRIOS (Apenas Admin) ---
app.get('/usuarios', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const lista = await pool.query('SELECT id, nome, username, perfil, ativo FROM usuarios ORDER BY nome');
  res.render('usuarios', { listaUsuarios: lista.rows, msg: null });
});

app.post('/usuarios', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const { nome, username, senha, perfil } = req.body;
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    await pool.query('INSERT INTO usuarios (nome, username, senha_hash, perfil) VALUES ($1, $2, $3, $4)', [nome, username, senhaHash, perfil]);
    const lista = await pool.query('SELECT id, nome, username, perfil, ativo FROM usuarios ORDER BY nome');
    res.render('usuarios', { listaUsuarios: lista.rows, msg: "Usuário cadastrado com sucesso!" });
  } catch (err) {
    res.status(500).send("Erro ao cadastrar usuário. Certifique-se de que o username é único.");
  }
});

app.post('/usuarios/:id/status', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const { id } = req.params;
  const { atual } = req.body;
  const novoStatus = atual === 'true' ? false : true;
  await pool.query('UPDATE usuarios SET ativo = $1 WHERE id = $2', [novoStatus, id]);
  res.redirect('/usuarios');
});

const PORT = process.env.PORT || 3035;
app.listen(PORT, () => console.log(`Ouvidoria rodando na porta ${PORT}`));