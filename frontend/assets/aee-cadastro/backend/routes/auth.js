// /var/www/aee-cadastro/backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = 'Onwcems1*Gatosap2009*2WaGaSadti*1'; // Use uma variável de ambiente

router.post('/login', async (req, res) => {
  const { login, senha } = req.body;

  try {
    const userQuery = await pool.query(
      'SELECT * FROM aee_usuarios_equipe WHERE login = $1', 
      [login]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = userQuery.rows[0];

    // Regra: Somente usuários ativos acessam
    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    const validPassword = await bcrypt.compare(senha, user.senha_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, especialidade_id: user.especialidade_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { nome: user.nome, id: user.id } });
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;