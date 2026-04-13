// /var/www/aee-cadastro/backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// Esta chave é usada para gerar o Token. Ela está aqui, então o server.js não precisa dela.
const JWT_SECRET = 'Onwcems1*Gatosap2009*2WaGaSadti*1';

router.post('/login', async (req, res) => {
  // Limpeza total de espaços no login e senha
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

    // A VACINA: .trim() no hash que vem do banco de dados
    const hashDoBanco = user.senha_hash ? user.senha_hash.trim() : '';
    
    // Comparação robusta
    const validPassword = await bcrypt.compare(senha, hashDoBanco);
    
    if (!validPassword) {
      console.log(`Tentativa de login falhou para: ${login}`); // Log para debug no pm2 logs
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Só aqui o JWT_SECRET é usado
    const token = jwt.sign(
      { id: user.id, nome: user.nome, login: user.login },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { id: user.id, nome: user.nome, login: user.login } 
    });

  } catch (err) {
    console.error("Erro no servidor (Login):", err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

module.exports = router;