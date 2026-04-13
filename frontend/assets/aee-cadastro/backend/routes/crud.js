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
// ROTAS ESPECÍFICAS (Dropdowns e Inativos)
// ==========================================

// Listar Escolas Ativas (Para a caixa de listagem do Aluno)
router.get('/escolas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM aee_escolas WHERE ativo = true ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar escolas: ' + err.message });
  }
});

// Listar Especialidades Ativas (Para os botões do Aluno)
router.get('/especialidades', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM aee_especialidades WHERE ativo = true ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar especialidades: ' + err.message });
  }
});

// Listar Inativos (Alimenta o Modal de Reativação)
router.get('/inativos/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);
  try {
    let query = `SELECT * FROM ${tabela}`;
    if (tabelasComAtivo.includes(tabela)) {
      query += ' WHERE ativo = false ORDER BY id DESC';
    } else {
      query += " WHERE status = 'Inativo' ORDER BY id DESC"; // Fallback
    }
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar inativos: ' + err.message });
  }
});

// ==========================================
// ROTAS GENÉRICAS (CRUD Principal)
// ==========================================

// Ler Registros (Apenas Ativos)
router.get('/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);
  try {
    let query = `SELECT * FROM ${tabela}`;
    
    // Filtro de ativos baseado na estrutura do banco
    if (tabelasComAtivo.includes(tabela)) {
      query += ' WHERE ativo = true';
    } else if (['aee_agendamentos', 'aee_atendimentos'].includes(tabela)) {
      query += " WHERE status != 'Inativo'";
    }
    
    // Ordenação amigável
    if (tabela === 'aee_alunos') query += ' ORDER BY nome_completo ASC';
    else if (tabela === 'aee_escolas' || tabela === 'aee_especialidades') query += ' ORDER BY nome ASC';
    else query += ' ORDER BY id DESC';

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados: ' + err.message });
  }
});

// Criar Registro (POST)
router.post('/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const data = req.body;

  // Limpeza de campos que o banco gera automaticamente ou que foram removidos
  delete data.id; 
  delete data.carga_horaria; 

  if (data.senha_hash) {
    data.senha_hash = await bcrypt.hash(data.senha_hash, 10);
  }

  // Se for aluno, garante que o campo JSONB seja válido
  if (tabela === 'aee_alunos') {
    data.especialidades = data.especialidades || {};
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const query = `INSERT INTO ${tabela} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ATUALIZAR REGISTRO (PUT) - Função que faltava para a Edição!
router.put('/:table/:id', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;
  const data = req.body;

  // Remover colunas que não devem ser atualizadas
  delete data.id;
  delete data.carga_horaria;
  delete data.criado_em;

  if (data.senha_hash) {
    data.senha_hash = await bcrypt.hash(data.senha_hash, 10);
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  
  // Monta dinamicamente a string "campo1 = $1, campo2 = $2"
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id); // O ID é o último parâmetro do array

  try {
    const query = `UPDATE ${tabela} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar registro: ' + err.message });
  }
});

// Inativar Registro (Soft Delete)
router.patch('/:table/:id/inativar', async (req, res) => {
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
    res.json({ message: 'Registro enviado para o arquivo (inativado) com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar registro.' });
  }
});

// Reativar Registro - Traz de volta os arquivos inativos
router.patch('/:table/:id/reativar', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;
  try {
    let query = '';
    if (tabelasComAtivo.includes(tabela)) {
      query = `UPDATE ${tabela} SET ativo = true WHERE id = $1`;
    } else {
      query = `UPDATE ${tabela} SET status = 'Agendado' WHERE id = $1`; // Status genérico para retorno
    }
    
    await pool.query(query, [id]);
    res.json({ message: 'Registro reativado e listado novamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao tentar reativar registro.' });
  }
});

// Rota para buscar logs de acesso dos pais e auditoria de faltas
router.get('/admin/auditoria-acessos', async (req, res) => {
    try {
        const query = `
            SELECT 
                l.id,
                l.data_hora as data_acesso,
                u.usuario as nome_pai,
                al.nome_completo as nome_aluno,
                al.escola
            FROM aee_log_acesso_pais l
            JOIN aee_usuarios_pais u ON l.pai_id = u.id
            JOIN aee_alunos al ON l.aluno_id = al.id
            ORDER BY l.data_hora DESC
            LIMIT 100
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;