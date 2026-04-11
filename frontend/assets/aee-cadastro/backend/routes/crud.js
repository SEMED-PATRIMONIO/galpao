// /var/www/aee-cadastro/backend/routes/crud.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

// Listar registros (Apenas os Ativos)
router.get('/:table', async (req, res) => {
  const { table } = req.params;
  try {
    // Verificamos se a tabela tem a coluna 'ativo' ou 'status'
    // Conforme o schema: aee_usuarios_equipe [cite: 98], aee_profissionais_saude [cite: 85], aee_usuarios_pais [cite: 114] possuem 'ativo'.
    let query = `SELECT * FROM ${table}`;
    
    if (['aee_usuarios_equipe', 'aee_profissionais_saude', 'aee_usuarios_pais'].includes(table)) {
      query += ' WHERE ativo = true';
    } else if (table === 'aee_agendamentos' || table === 'aee_atendimentos') {
      query += " WHERE status != 'Inativo'"; // Exemplo baseado no campo status [cite: 13, 43]
    }
    
    query += ' ORDER BY id DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados: ' + err.message });
  }
});

// Inativar Registro (Soft Delete)
router.patch('/:table/:id/inativar', async (req, res) => {
  const { table, id } = req.params;
  try {
    let query = '';
    // Lógica para tabelas que usam booleano 'ativo'
    if (['aee_usuarios_equipe', 'aee_profissionais_saude', 'aee_usuarios_pais'].includes(table)) {
      query = `UPDATE ${table} SET ativo = false WHERE id = $1`;
    } else {
      // Para tabelas que usam texto no status [cite: 13, 43]
      query = `UPDATE ${table} SET status = 'Inativo' WHERE id = $1`;
    }
    
    await pool.query(query, [id]);
    res.json({ message: 'Registro inativado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar' });
  }
});

router.post('/:table', async (req, res) => {
  const { table } = req.params;
  const data = req.body;

  // Criptografa senha se a tabela exigir
  if (data.senha_hash) {
    data.senha_hash = await bcrypt.hash(data.senha_hash, 10);
  }

  // Se for aluno, garante que os campos JSONB não sejam nulos [cite: 28, 30]
  if (table === 'aee_alunos') {
    data.especialidades = data.especialidades || {};
    data.carga_horaria = data.carga_horaria || {};
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;