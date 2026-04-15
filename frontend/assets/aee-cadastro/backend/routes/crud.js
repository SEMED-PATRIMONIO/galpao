const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

// Tabelas com coluna 'ativo'
const tabelasComAtivo = [
  'aee_usuarios_equipe',
  'aee_alunos',
  'aee_profissionais_saude',
  'aee_usuarios_pais',
  'aee_escolas',
  'aee_especialidades'
];

// Mapeamento frontend <-> banco
const getTableName = (param) => {
  const mapping = {
    'alunos': 'aee_alunos',
    'usuarios': 'aee_usuarios_equipe',
    'usuarios_equipe': 'aee_usuarios_equipe',
    'profissionais': 'aee_profissionais_saude',
    'profissionais_saude': 'aee_profissionais_saude',
    'escolas': 'aee_escolas',
    'especialidades': 'aee_especialidades',
    'pais': 'aee_usuarios_pais',
    'usuarios_pais': 'aee_usuarios_pais'
  };
  return mapping[param] || param;
};

// ✅ Função para processar campos antes de salvar no banco
const processarCampos = async (tabela, campos, isEdicao = false) => {
  const processado = { ...campos };

  // --- PROFISSIONAIS DE SAÚDE ---
  if (tabela === 'aee_profissionais_saude') {
    // Se enviou campo 'senha', converte para 'senha_hash' com bcrypt
    if (processado.senha && processado.senha.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      processado.senha_hash = await bcrypt.hash(processado.senha, salt);
    }
    // Remove o campo 'senha' (não existe no banco)
    delete processado.senha;

    // Se é edição e não tem senha_hash, não sobrescreve
    if (isEdicao && !processado.senha_hash) {
      delete processado.senha_hash;
    }

    // Se não enviou senha na inclusão, gera uma senha padrão
    if (!isEdicao && !processado.senha_hash) {
      const salt = await bcrypt.genSalt(10);
      processado.senha_hash = await bcrypt.hash('123456', salt);
    }

    // Converte especialidade_id para inteiro ou null
    if (processado.especialidade_id === '' || processado.especialidade_id === undefined) {
      processado.especialidade_id = null;
    } else if (processado.especialidade_id !== null) {
      processado.especialidade_id = parseInt(processado.especialidade_id);
    }
  }

  // --- USUÁRIOS DA EQUIPE ---
  if (tabela === 'aee_usuarios_equipe') {
    if (processado.senha && processado.senha.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      processado.senha_hash = await bcrypt.hash(processado.senha, salt);
    }
    delete processado.senha;

    if (isEdicao && !processado.senha_hash) {
      delete processado.senha_hash;
    }

    if (!isEdicao && !processado.senha_hash) {
      const salt = await bcrypt.genSalt(10);
      processado.senha_hash = await bcrypt.hash('123456', salt);
    }

    if (processado.especialidade_id === '' || processado.especialidade_id === undefined) {
      processado.especialidade_id = null;
    } else if (processado.especialidade_id !== null) {
      processado.especialidade_id = parseInt(processado.especialidade_id);
    }
  }

  // --- PAIS / RESPONSÁVEIS ---
  if (tabela === 'aee_usuarios_pais') {
    // Converte aluno_id para inteiro ou null
    if (processado.aluno_id === '' || processado.aluno_id === undefined) {
      processado.aluno_id = null;
    } else if (processado.aluno_id !== null) {
      processado.aluno_id = parseInt(processado.aluno_id);
    }

    // Garante que senha_pin tem valor na inclusão
    if (!isEdicao && (!processado.senha_pin || processado.senha_pin.trim() === '')) {
      processado.senha_pin = '00000';
    }

    // Se é edição e não digitou pin, não sobrescreve
    if (isEdicao && (!processado.senha_pin || processado.senha_pin.trim() === '')) {
      delete processado.senha_pin;
    }
  }

  // --- ALUNOS ---
  if (tabela === 'aee_alunos') {
    // especialidades é jsonb - garante que é array
    if (processado.especialidades && !Array.isArray(processado.especialidades)) {
      try {
        processado.especialidades = JSON.parse(processado.especialidades);
      } catch {
        processado.especialidades = [];
      }
    }
    // Converte para JSON string para o PostgreSQL
    if (Array.isArray(processado.especialidades)) {
      processado.especialidades = JSON.stringify(processado.especialidades);
    }
  }

  return processado;
};

// ✅ ROTA FIXA: Buscar inativos (ANTES da rota dinâmica /:table)
router.get('/:table/inativos', async (req, res) => {
  const tabela = getTableName(req.params.table);
  try {
    const sql = `SELECT * FROM ${tabela} WHERE ativo = false ORDER BY id DESC`;
    const result = await pool.query(sql);
    res.json(result.rows || []);
  } catch (err) {
    console.error(`[CRUD] Erro ao buscar inativos de ${tabela}:`, err.message);
    res.status(500).json({ error: 'Erro ao buscar inativos' });
  }
});

// 1. LISTAGEM GERAL
router.get('/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);

  if (tabela === 'inativos') {
    return res.status(400).json({ error: 'Rota inválida.' });
  }

  try {
    let sql = `SELECT * FROM ${tabela}`;
    if (tabelasComAtivo.includes(tabela)) {
      sql += ` WHERE ativo = true`;
    }
    sql += ` ORDER BY id DESC`;

    const result = await pool.query(sql);
    res.json(result.rows || []);
  } catch (err) {
    console.error(`[CRUD] Falha ao listar ${tabela}:`, err.message);
    res.status(500).json({ error: 'Erro ao buscar dados no banco.' });
  }
});

// 2. INCLUIR (POST) ✅ com processamento de campos
router.post('/:table', async (req, res) => {
  const tabela = getTableName(req.params.table);

  try {
    const campos = await processarCampos(tabela, req.body, false);
    delete campos.id;

    const keys = Object.keys(campos);
    const values = Object.values(campos);

    if (keys.length === 0) return res.status(400).json({ error: 'Dados vazios' });

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO ${tabela} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;

    console.log(`[CRUD] INSERT em ${tabela}:`, keys);
    const result = await pool.query(sql, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(`[CRUD] Falha ao incluir em ${tabela}:`, err.message);
    res.status(500).json({ error: `Erro ao inserir registro: ${err.message}` });
  }
});

// 3. EDITAR (PUT) ✅ com processamento de campos
router.put('/:table/:id', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;

  try {
    const campos = await processarCampos(tabela, req.body, true);
    const keys = Object.keys(campos).filter(k => k !== 'id' && k !== 'criado_em' && k !== 'data_cadastro');
    const values = keys.map(k => campos[k]);

    if (keys.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const sql = `UPDATE ${tabela} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;

    console.log(`[CRUD] UPDATE em ${tabela} ID ${id}:`, keys);
    const result = await pool.query(sql, [...values, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro não encontrado para edição.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(`[CRUD] Falha ao editar ${tabela} ID ${id}:`, err.message);
    res.status(500).json({ error: `Erro ao atualizar dados: ${err.message}` });
  }
});

// 4. INATIVAR (PATCH)
router.patch('/:table/:id/inativar', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;

  try {
    const sql = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
    const result = await pool.query(sql, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro não encontrado para inativação.' });
    }

    res.json({ message: 'Registro inativado com sucesso.' });
  } catch (err) {
    console.error(`[CRUD] Falha ao inativar ${tabela}:`, err.message);
    res.status(500).json({ error: 'Erro ao processar inativação.' });
  }
});

// 5. REATIVAR (PATCH)
router.patch('/:table/:id/reativar', async (req, res) => {
  const tabela = getTableName(req.params.table);
  const { id } = req.params;

  try {
    const sql = `UPDATE ${tabela} SET ativo = true WHERE id = $1`;
    await pool.query(sql, [id]);
    res.json({ message: 'Registro reativado com sucesso.' });
  } catch (err) {
    console.error(`[CRUD] Falha ao reativar ${tabela}:`, err.message);
    res.status(500).json({ error: 'Erro ao reativar registro.' });
  }
});

module.exports = router;