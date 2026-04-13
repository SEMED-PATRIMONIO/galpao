// /var/www/aee-cadastro/backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// Chave secreta para assinatura do Token (deve ser a mesma em todos os servidores que validam o token)
const JWT_SECRET = 'Onwcems1*Gatosap2009*2WaGaSadti*1'; 

router.post('/login', async (req, res) => {
  // 1. Tratamento de entrada: remove espaços acidentais do formulário
  const login = req.body.login ? req.body.login.trim() : '';
  const senha = req.body.senha ? String(req.body.senha).trim() : '';

  try {
    // 2. Procura o utilizador pelo login
    const userQuery = await pool.query(
      'SELECT * FROM aee_usuarios_equipe WHERE login = $1', 
      [login]
    );

    if (userQuery.rows.length === 0) {
      console.log(`[LOGIN] Tentativa falhou: Utilizador "${login}" não encontrado.`);
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = userQuery.rows[0];

    // 3. Verifica se o utilizador está ativo (valor 't' no PostgreSQL)
    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    // 4. A CORREÇÃO CRÍTICA: .trim() no hash vindo do PostgreSQL
    // Isso remove espaços extras se a coluna for do tipo CHAR
    const hashDoBanco = user.senha_hash ? user.senha_hash.trim() : '';
    
    // Debug para o PM2 Logs (ajuda a confirmar o que o código está a ler)
    console.log(`[DEBUG LOGIN] Usuário encontrado: ${user.login}`);
    console.log(`[DEBUG LOGIN] Hash no banco: "${hashDoBanco}"`);

    const validPassword = await bcrypt.compare(senha, hashDoBanco);
    
    if (!validPassword) {
      console.log(`[DEBUG LOGIN] A comparação do bcrypt FALHOU para a senha digitada.`);
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // 5. Gera o Token (JWT) com os dados necessários
    const token = jwt.sign(
      { 
        id: user.id, 
        nome: user.nome, 
        especialidade_id: user.especialidade_id 
      },
      JWT_SECRET,
      { expiresIn: '8h' } // Tempo de sessão
    );

    // 6. Retorna o sucesso e os dados do utilizador
    console.log(`[LOGIN] Sucesso: ${user.nome} (ID: ${user.id}) acedeu ao sistema.`);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        nome: user.nome 
      } 
    });

  } catch (err) {
    console.error("Erro crítico no processo de login:", err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

module.exports = router;