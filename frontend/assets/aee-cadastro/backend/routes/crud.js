const express = require('express');
const router = express.Router();
const pool = require('../db');

// Tabelas com coluna 'ativo' (boolean)
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
        'escolas': 'aee_escolas',
        'especialidades': 'aee_especialidades',
        'pais': 'aee_usuarios_pais'
    };
    return mapping[param] || param;
};

// 1. LISTAGEM GERAL (ativos por padrão, se existir coluna 'ativo')
router.get('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);

    // ✅ Proteção contra path "inativos" sendo interpretado como tabela
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

// 2. INCLUIR (POST)
router.post('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const campos = req.body;

    try {
        delete campos.id;
        const keys = Object.keys(campos);
        const values = Object.values(campos);

        if (keys.length === 0) return res.status(400).json({ error: 'Dados vazios' });

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${tabela} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;

        const result = await pool.query(sql, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(`[CRUD] Falha ao incluir em ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao inserir registro.' });
    }
});

// 3. EDITAR (PUT)
router.put('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    const campos = req.body;

    try {
        const keys = Object.keys(campos).filter(k => k !== 'id' && k !== 'criado_em');
        const values = keys.map(k => campos[k]);

        if (keys.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const sql = `UPDATE ${tabela} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;

        const result = await pool.query(sql, [...values, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro não encontrado para edição.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[CRUD] Falha ao editar ${tabela} ID ${id}:`, err.message);
        res.status(500).json({ error: 'Erro ao atualizar dados.' });
    }
});

// 4. INATIVAR (PATCH) ✅ mantém ativo=false
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

// 6. BUSCAR APENAS INATIVOS ✅ rota fixa, não conflita com :table
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

module.exports = router;