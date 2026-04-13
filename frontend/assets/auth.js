// /var/www/aee-cadastro/backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = 'Onwcems1*Gatosap2009*2WaGaSadti*1';

router.post('/login', async (req, res) => {
  // O .trim() garante que espaços acidentais não quebrem o login
  const login = req.body.login ? req.body.login.trim() : '';
  const senha = req.body.senha ? String(req.body.senha).trim() : '';

  try {
    const userQuery = await pool.query(
      'SELECT * FROM aee_usuarios_equipe WHERE login = $1', 
      [login]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = userQuery.rows[0];

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo.' });
    }

    // COMPARAÇÃO COM TRIM: Resolve o erro de senha incorreta 401
    const validPassword = await bcrypt.compare(senha, user.senha_hash.trim());
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, login: user.login },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, nome: user.nome, login: user.login } });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

module.exports = router;