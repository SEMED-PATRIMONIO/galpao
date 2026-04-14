// /var/www/aee-cadastro/backend/server_gestor.js
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'omeq_secret_key_2026';

// ✅ Middleware de verificação de token JWT
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
};

// 1. LOGIN DA GESTÃO ✅ coluna 'login' correta + bcrypt
app.post('/api/gestor/login', async (req, res) => {
  const login = req.body.login ? req.body.login.trim() : '';
  const senha = req.body.senha ? String(req.body.senha).trim() : '';

  if (!login || !senha) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true',
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas ou conta inativa.' });
    }

    const usuario = result.rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash.trim());

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Credenciais inválidas ou conta inativa.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, nivel: 'gestor' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: usuario.id, nome: usuario.nome, login: usuario.login }
    });
  } catch (err) {
    console.error('[GESTOR] Erro no login:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// 2. DASHBOARD - ESTATÍSTICAS GERAIS ✅ protegido por token
app.get('/api/diretoria/stats', verificarToken, async (req, res) => {
  try {
    const [totalAlunos, totalProfissionais, atendimentosMes, faltasMes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM aee_alunos WHERE ativo = true'),
      pool.query('SELECT COUNT(*) FROM aee_profissionais_saude WHERE ativo = true'),
      pool.query(
        "SELECT COUNT(*) FROM aee_atendimentos WHERE status = 'Concluído' AND data_hora >= date_trunc('month', now())"
      ),
      pool.query(
        "SELECT COUNT(*) FROM aee_auditoria WHERE acao = 'FALTA_ATENDIMENTO' AND data_hora >= date_trunc('month', now())"
      )
    ]);

    res.json({
      alunos: totalAlunos.rows[0].count,
      profissionais: totalProfissionais.rows[0].count,
      atendimentos: atendimentosMes.rows[0].count,
      faltas: faltasMes.rows[0].count
    });
  } catch (err) {
    console.error('[GESTOR] Erro ao buscar stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Inicialização na porta 3005
const PORT = 3005;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  📊 Portal do Gestor Online
  📡 Porta: ${PORT}
  `);
});