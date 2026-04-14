const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'omeq_secret_key_2026';

// 1. LOGIN PARA EQUIPE TÉCNICA
// ✅ Corrigido: busca pela coluna 'login' (não 'usuario')
// ✅ Corrigido: usa bcrypt.compare para senhas hasheadas
router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true',
      [usuario]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(senha, user.senha_hash);

    if (!match) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const token = jwt.sign(
      { id: user.id, role: 'equipe' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    delete user.senha_hash;
    res.json({ token, user });
  } catch (err) {
    console.error('[AUTH] Erro no login equipe:', err.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// 2. LOGIN PARA PAIS / RESPONSÁVEIS
router.post('/login-pais', async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM aee_usuarios_pais WHERE usuario = $1 AND ativo = true',
      [usuario]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Responsável não encontrado ou inativo.' });
    }

    const user = result.rows[0];

    // aee_usuarios_pais pode ter senha_hash ou senha_pin
    // tenta bcrypt primeiro, se falhar tenta comparação direta do pin
    let match = false;
    if (user.senha_hash) {
      match = await bcrypt.compare(senha, user.senha_hash);
    } else {
      match = (senha === user.senha_pin);
    }

    if (!match) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const token = jwt.sign(
      { id: user.id, role: 'pai', aluno_id: user.aluno_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.senha_hash;
    delete user.senha_pin;
    res.json({ token, user });
  } catch (err) {
    console.error('[AUTH] Erro no login pais:', err.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;