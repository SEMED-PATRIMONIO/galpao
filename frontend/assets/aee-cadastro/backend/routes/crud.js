// /var/www/aee-cadastro/backend/routes/crud.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

// Função auxiliar: Garante que as tabelas tenham o prefixo 'aee_' correto
const getTableName = (param) => param.startsWith('aee_') ? param : `aee_${param}`;

// Lista de tabelas que utilizam o campo booleano 'ativo' para Soft Delete
const tabelasComAtivo = [
  'aee_alunos', 
  'aee_escolas', 
  'aee_especialidades', 
  'aee_usuarios_equipe', 
  'aee_profissionais_saude', 
  'aee_usuarios_pais'
];

// ==========================================
// ROTAS ESPECÍFICAS
// ==========================================

// Listar Escolas Ativas
router.get('/escolas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM aee_escolas WHERE ativo = true ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar escolas: ' + err.message });
  }
});

// Listar Especialidades Ativas
router.get('/especialidades', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM aee_especialidades WHERE ativo = true ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar especialidades: ' + err.message });
  }
});

// Listar Registros Inativos (Para a Lixeira)
router.get('/:table/inativos', async (req, res) => {
  const tabela = getTableName(req.params.table);
  try {
    let query = '';
    if (tabelasComAtivo.includes(tabela)) {
      query = `SELECT * FROM ${tabela} WHERE ativo = false ORDER BY id DESC`;
    } else {
      query = `SELECT * FROM ${tabela} WHERE status = 'Inativo' ORDER BY id DESC`;
    }
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar inativos.' });
  }
});

// ==========================================
// CRUD GENÉRICO
// ==========================================

// Listar registros (Apenas os Ativos)
router.get('/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);
  try {
    let query = `SELECT * FROM ${tabela}`;
    if (tabelasComAtivo.includes(tabela)) {
      query += ' WHERE ativo = true';
    } else {
      query += " WHERE status != 'Inativo'";
    }
    query += ' ORDER BY id DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados: ' + err.message });
  }
});

// Criar Registro
router.post('/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const data = req.body;

  if (data.senha_hash) {
    data.senha_hash = await bcrypt.hash(data.senha_hash, 10);
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const query = `INSERT INTO ${tabela} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inserir registro: ' + err.message });
  }
});

// Inativar Registro (Soft Delete)
router.delete('/:table/:id', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;
  try {
    let query = '';
    if (tabelasComAtivo.includes(tabela)) {
      query = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
    } else {
      query = `UPDATE ${tabela} SET status = 'Inativo' WHERE id = $1`;
    }
    await pool.query(query, [id]);
    res.json({ message: 'Registro movido para a lixeira.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar registro.' });
  }
});

// Reativar Registro
router.patch('/:table/:id/reativar', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;
  try {
    let query = '';
    if (tabelasComAtivo.includes(tabela)) {
      query = `UPDATE ${tabela} SET ativo = true WHERE id = $1`;
    } else {
      query = `UPDATE ${tabela} SET status = 'Agendado' WHERE id = $1`;
    }
    await pool.query(query, [id]);
    res.json({ message: 'Registro reativado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao reativar registro.' });
  }
});

// Auditoria de Acessos (Ajustado de app para router)
router.get('/admin/auditoria-acessos', async (req, res) => {
    try {
        const query = `
            SELECT l.id, l.data_hora as data_acesso, u.usuario as nome_pai, 
                   al.nome_completo as nome_aluno, al.escola
            FROM aee_log_acesso_pais l
            JOIN aee_usuarios_pais u ON l.pai_id = u.id
            JOIN aee_alunos al ON l.aluno_id = al.id
            ORDER BY l.data_hora DESC LIMIT 100
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;