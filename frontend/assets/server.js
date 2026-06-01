const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const pool = require('./config/database.js');
const session = require('express-session');
const crypto = require('crypto');

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
      
      // Validação normal para outros usuários
      const hashDigitado = crypto.createHash('sha256').update(senha).digest('hex');
      if (hashDigitado === usuario.senha_hash) {
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

app.post('/usuarios/alterar-senha', requererAutenticacao, async (req, res) => {
  const { novaSenha } = req.body;
  try {
    if (!novaSenha || novaSenha.trim() === '') return res.status(400).send("Senha inválida.");
    const hash = crypto.createHash('sha256').update(novaSenha).digest('hex');
    await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.session.usuarioId]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao alterar senha.");
  }
});

// --- PAINEL PRINCIPAL DINÂMICO ---
app.get('/', requererAutenticacao, async (req, res) => {
  try {
    // 1. Filtros coletados dinamicamente das tabelas reais do banco de dados
    const anosValidos = await pool.query('SELECT DISTINCT ano_exercicio FROM processos WHERE ativo = true ORDER BY ano_exercicio DESC');
    const escolas = await pool.query('SELECT id, nome FROM escolas WHERE ativo = true ORDER BY nome');
    const departamentos = await pool.query('SELECT id, nome FROM departamentos WHERE ativo = true ORDER BY nome');

    let sql = `
      SELECT p.*, e.nome as nome_escola, d.nome as nome_departamento, n.nome as nome_natureza 
      FROM processos p
      LEFT JOIN escolas e ON p.escola_id = e.id
      LEFT JOIN departamentos d ON p.departamento_id = d.id
      LEFT JOIN naturezas n ON p.natureza_id = n.id
      WHERE p.ativo = true
    `;
    let parametros = [];
    let contador = 1;

    if (req.query.ano) {
      sql += ` AND p.ano_exercicio = $${contador}`;
      parametros.push(parseInt(req.query.ano));
      contador++;
    }
    if (req.query.status) {
      sql += ` AND p.status = $${contador}`;
      parametros.push(req.query.status);
      contador++;
    }
    if (req.query.escola_id) {
      sql += ` AND p.escola_id = $${contador}`;
      parametros.push(req.query.escola_id);
      contador++;
    }
    if (req.query.busca) {
      sql += ` AND (p.requerente ILIKE $${contador} OR p.protocolo ILIKE $${contador} OR p.numero_processo ILIKE $${contador})`;
      parametros.push(`%${req.query.busca}%`);
      contador++;
    }

    sql += ' ORDER BY p.data_registro DESC';
    const processosResult = await pool.query(sql, parametros);
    
    res.render('dashboard', { 
      demandas: processosResult.rows, 
      anos: anonymous = anosValidos.rows.map(r => r.ano_exercicio),
      escolas: escolas.rows, 
      departamentos: departamentos.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao processar o painel dinâmico.");
  }
});

// --- SUB-ROTAS CRUD: PROCESSOS COM AUDITORIA AUTOMÁTICA ---
app.get('/processos', requererAutenticacao, async (req, res) => {
  try {
    const list = await pool.query(`
      SELECT p.*, e.nome as escola, d.nome as depto, n.nome as natureza 
      FROM processos p 
      LEFT JOIN escolas e ON p.escola_id = e.id 
      LEFT JOIN departamentos d ON p.departamento_id = d.id 
      LEFT JOIN naturezas n ON p.natureza_id = n.id 
      ORDER BY p.data_registro DESC`);
    
    const escolas = await pool.query('SELECT id, nome FROM escolas WHERE ativo = true ORDER BY nome');
    const deptos = await pool.query('SELECT id, nome FROM departamentos WHERE ativo = true ORDER BY nome');
    const naturezas = await pool.query('SELECT id, nome FROM naturezas WHERE ativo = true ORDER BY nome');
    
    res.render('processos', { lista: list.rows, escolas: escolas.rows, departamentos: deptos.rows, naturezas: naturezas.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar processos.");
  }
});

app.post('/processos', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  const p = req.body;
  try {
    const sql = `INSERT INTO processos (numero_processo, protocolo, data_registro, ano_exercicio, status, requerente, cpf, envolvimento, escola_id, departamento_id, natureza_id, descricao_resumida) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
    await pool.query(sql, [p.numero_processo, p.protocolo, p.data_registro, parseInt(p.ano_exercicio), p.status, p.requerente, p.cpf, p.envolvimento, p.escola_id || null, p.departamento_id || null, p.natureza_id || null, p.descricao_resumida]);
    res.redirect('/processos');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao salvar processo.");
  }
});

app.post('/processos/:id/alterar-local', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { novo_departamento_id } = req.body;
  try {
    const antigo = await pool.query('SELECT departamento_id FROM processos WHERE id = $1', [id]);
    const antigoDeptoId = antigo.rows[0]?.departamento_id;

    if (antigoDeptoId != novo_departamento_id) {
      await pool.query('UPDATE processos SET departamento_id = $1 WHERE id = $2', [novo_departamento_id, id]);
      
      // Salva o log de auditoria automaticamente
      await pool.query(`INSERT INTO movimentacoes (processo_id, usuario_id, campo_alterado, valor_antigo, valor_novo) 
                        VALUES ($1, $2, $3, $4, $5)`, [id, req.session.usuarioId, 'departamento_id', String(antigoDeptoId), String(novo_departamento_id)]);
    }
    res.redirect('/processos');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao registrar movimentação.");
  }
});

// --- ROTA DE AUDITORIA (MOVIMENTAÇÕES) ---
app.get('/movimentacoes', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, p.numero_processo, u.nome as nome_usuario, d1.nome as depto_antigo, d2.nome as depto_novo
      FROM movimentacoes m
      JOIN processos p ON m.processo_id = p.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN departamentos d1 ON m.valor_antigo = CAST(d1.id AS TEXT)
      LEFT JOIN departamentos d2 ON m.valor_novo = CAST(d2.id AS TEXT)
      ORDER BY m.data_alteracao DESC
    `);
    res.render('movimentacoes', { logs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar auditoria.");
  }
});

// --- CRUD: DEPARTAMENTOS ---
app.get('/departamentos', requererAutenticacao, async (req, res) => {
  const result = await pool.query('SELECT * FROM departamentos ORDER BY nome');
  res.render('departamentos', { lista: result.rows });
});
app.post('/departamentos', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  await pool.query('INSERT INTO departamentos (nome, sigla) VALUES ($1, $2)', [req.body.nome, req.body.sigla]);
  res.redirect('/departamentos');
});

// --- CRUD: ESCOLAS ---
app.get('/escolas', requererAutenticacao, async (req, res) => {
  const result = await pool.query('SELECT * FROM escolas ORDER BY nome');
  res.render('escolas', { lista: result.rows });
});
app.post('/escolas', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  await pool.query('INSERT INTO escolas (nome) VALUES ($1)', [req.body.nome]);
  res.redirect('/escolas');
});

// --- CRUD: NATUREZAS (TIPOS) ---
app.get('/naturezas', requererAutenticacao, async (req, res) => {
  const result = await pool.query('SELECT * FROM naturezas ORDER BY nome');
  res.render('naturezas', { lista: result.rows });
});
app.post('/naturezas', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  await pool.query('INSERT INTO naturezas (nome) VALUES ($1)', [req.body.nome]);
  res.redirect('/naturezas');
});

// --- CRUD: USUÁRIOS (Apenas Admin) ---
app.get('/usuarios', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const lista = await pool.query('SELECT id, nome, username, perfil, ativo FROM usuarios ORDER BY nome');
  res.render('usuarios', { listaUsuarios: lista.rows, msg: null });
});

app.post('/usuarios', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const { nome, username, senha, perfil } = req.body;
  try {
    const senhaHash = crypto.createHash('sha256').update(senha).digest('hex');
    await pool.query('INSERT INTO usuarios (nome, username, senha_hash, perfil) VALUES ($1, $2, $3, $4)', [nome, username, senhaHash, perfil]);
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerenciar usuário.");
  }
});

// ==========================================
// 🛠️ ROTAS EXCLUSIVAS DE EDIÇÃO / STATUS (PROCESSOS)
// ==========================================

// Salvar Edição Completa do Processo (Apenas Operador e Admin)
app.post('/processos/:id/editar', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  const { id } = req.params;
  const p = req.body;
  try {
    // Buscar o estado antigo para auditoria
    const antigoResult = await pool.query('SELECT * FROM processos WHERE id = $1', [id]);
    const antigo = antigoResult.rows[0];

    if (!antigo) return res.status(404).send("Processo não encontrado.");

    // Atualiza o registro
    const sqlUpdate = `
      UPDATE processos SET 
        numero_processo = $1, protocolo = $2, data_registro = $3, ano_exercicio = $4, 
        status = $5, requerente = $6, cpf = $7, envolvimento = $8, 
        escola_id = $9, departamento_id = $10, natureza_id = $11, descricao_resumida = $12
      WHERE id = $13
    `;
    await pool.query(sqlUpdate, [
      p.numero_processo, p.protocolo, p.data_registro, parseInt(p.ano_exercicio),
      p.status, p.requerente, p.cpf, p.envolvimento,
      p.escola_id || null, p.departamento_id || null, p.natureza_id || null, p.descricao_resumida,
      id
    ]);

    // Mapeia alterações para a tabela de movimentações (Auditoria Automática)
    const camposLog = ['numero_processo', 'protocolo', 'status', 'departamento_id', 'escola_id'];
    for (const campo of camposLog) {
      if (String(antigo[campo]) !== String(p[campo])) {
        await pool.query(
          `INSERT INTO movimentacoes (processo_id, usuario_id, campo_alterado, valor_antigo, valor_novo) 
           VALUES ($1, $2, $3, $4, $5)`,
          [id, req.session.usuarioId, campo, String(antigo[campo]), String(p[campo])]
        );
      }
    }

    res.redirect('/processos');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao editar o processo.");
  }
});

// Inativar / Arquivar Processo (Apenas Admin)
app.post('/processos/:id/inativar', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  try {
    await pool.query('UPDATE processos SET ativo = false WHERE id = $1', [req.params.id]);
    res.redirect('/processos');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao inativar processo.");
  }
});

// Reativar Processo (Apenas Admin)
app.post('/processos/:id/reativar', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  try {
    await pool.query('UPDATE processos SET ativo = true WHERE id = $1', [req.params.id]);
    res.redirect('/processos');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao reativar processo.");
  }
});


// ==========================================
// 🛠️ ROTAS EXCLUSIVAS DE STATUS (DEPARTAMENTOS)
// ==========================================

app.post('/departamentos/:id/editar', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  const { nome, sigla } = req.body;
  await pool.query('UPDATE departamentos SET nome = $1, sigla = $2 WHERE id = $3', [nome, sigla, req.params.id]);
  res.redirect('/departamentos');
});

app.post('/departamentos/:id/status', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const { ativo } = req.body; 
  const novoStatus = ativo === 'true' ? false : true;
  await pool.query('UPDATE departamentos SET ativo = $1 WHERE id = $2', [novoStatus, req.params.id]);
  res.redirect('/departamentos');
});


// ==========================================
// 🛠️ ROTAS EXCLUSIVAS DE STATUS (ESCOLAS)
// ==========================================

app.post('/escolas/:id/editar', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  await pool.query('UPDATE escolas SET nome = $1 WHERE id = $2', [req.body.nome, req.params.id]);
  res.redirect('/escolas');
});

app.post('/escolas/:id/status', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const { ativo } = req.body;
  const novoStatus = ativo === 'true' ? false : true;
  await pool.query('UPDATE escolas SET ativo = $1 WHERE id = $2', [novoStatus, req.params.id]);
  res.redirect('/escolas');
});


// ==========================================
// 🛠️ ROTAS EXCLUSIVAS DE STATUS (NATUREZAS / TIPOS)
// ==========================================

app.post('/naturezas/:id/editar', requererAutenticacao, verificarPermissao(['operador', 'admin']), async (req, res) => {
  await pool.query('UPDATE naturezas SET nome = $1 WHERE id = $2', [req.body.nome, req.params.id]);
  res.redirect('/naturezas');
});

app.post('/naturezas/:id/status', requererAutenticacao, verificarPermissao(['admin']), async (req, res) => {
  const { ativo } = req.body;
  const novoStatus = ativo === 'true' ? false : true;
  await pool.query('UPDATE naturezas SET ativo = $1 WHERE id = $2', [novoStatus, req.params.id]);
  res.redirect('/naturezas');
});

const PORT = process.env.PORT || 3035;
app.listen(PORT, () => console.log(`Ouvidoria rodando na porta ${PORT}`));