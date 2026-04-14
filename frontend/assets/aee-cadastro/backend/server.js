const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/crud');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'omeq_secret_key_2026';

app.use(cors());
app.use(express.json());

// Rotas Modulares
app.use('/api/auth', authRoutes);
app.use('/api/crud', crudRoutes);
app.use('/api/data', crudRoutes);

// ✅ NOVA ROTA: Verificar se o token ainda é válido
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

// Rota de alteração de senha
app.patch('/api/usuarios/update-password/:id', async (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;

  if (!senha) {
    return res.status(400).json({ error: 'A nova senha deve ser fornecida.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);

    const query = `
      UPDATE aee_usuarios_equipe 
      SET senha_hash = $1 
      WHERE id = $2 
      RETURNING id
    `;

    const result = await pool.query(query, [hash, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    res.json({ message: 'Senha atualizada com sucesso! 🛡️' });
  } catch (err) {
    console.error('Erro ao atualizar senha:', err.message);
    res.status(500).json({ error: 'Erro interno ao processar a senha.' });
  }
});

const PORT = 3004;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Servidor Principal AEE Online
  📡 Porta: ${PORT}
  🔗 URL: https://aeecadastro.paiva.api.br
  `);
});