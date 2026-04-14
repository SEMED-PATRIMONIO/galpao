const express = require('express');
const router = express.Router();
const pool = require('../db');

// Lista de tabelas que usam a coluna 'ativo' (boolean) para controle de exibição
const tabelasComAtivo = [
    'aee_usuarios_equipe', 
    'aee_alunos', 
    'aee_profissionais_saude', 
    'aee_usuarios_pais', 
    'aee_escolas', 
    'aee_especialidades'
];

// Mapeamento rigoroso entre o que o Front-end pede e o nome real no Banco de Dados
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

/**
 * 1. LISTAGEM GERAL
 * Resolve o problema da tabela 'Usuários' não carregar.
 */
router.get('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    try {
        let sql = `SELECT * FROM ${tabela}`;
        
        // Se a tabela tiver a coluna 'ativo', filtramos para mostrar apenas os ativos
        if (tabelasComAtivo.includes(tabela)) {
            sql += ` WHERE ativo = true`;
        }
        
        sql += ` ORDER BY id DESC`;
        
        const result = await pool.query(sql);
        res.json(result.rows || []);
    } catch (err) {
        console.error(`[BACKEND ERROR] Falha ao listar ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao buscar dados no banco.' });
    }
});

/**
 * 2. INCLUIR NOVO (POST)
 * Resolve o botão 'INCLUIR NOVO'
 */
router.post('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const campos = req.body;

    try {
        // Removemos o 'id' caso o front envie, pois o Postgres gera automático
        delete campos.id;

        const keys = Object.keys(campos);
        const values = Object.values(campos);
        
        if (keys.length === 0) return res.status(400).json({ error: 'Dados vazios' });

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${tabela} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        
        const result = await pool.query(sql, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(`[BACKEND ERROR] Falha ao incluir em ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao inserir registro.' });
    }
});

/**
 * 3. EDITAR DADOS (PUT)
 * Resolve o botão 'EDITAR DADOS'
 */
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
        console.error(`[BACKEND ERROR] Falha ao editar ${tabela} ID ${id}:`, err.message);
        res.status(500).json({ error: 'Erro ao atualizar dados.' });
    }
});

/**
 * 4. INATIVAR (PATCH)
 * Resolve o botão 'INATIVAR' que chama a rota /inativar
 */
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
        console.error(`[BACKEND ERROR] Falha ao inativar ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao processar inativação.' });
    }
});

/**
 * 5. REATIVAR (PATCH)
 * Rota auxiliar para o modal de Reativar
 */
router.patch('/:table/:id/reativar', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;

    try {
        const sql = `UPDATE ${tabela} SET ativo = true WHERE id = $1`;
        await pool.query(sql, [id]);
        res.json({ message: 'Registro reativado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao reativar registro.' });
    }
});

// BUSCAR APENAS INATIVOS (Para o modal de reativar)
router.get('/:table/inativos', async (req, res) => {
    const tabela = getTableName(req.params.table);
    try {
        // Busca apenas onde o ativo for FALSE
        const sql = `SELECT * FROM ${tabela} WHERE ativo = false ORDER BY id DESC`;
        const result = await pool.query(sql);
        res.json(result.rows || []);
    } catch (err) {
        console.error(`Erro ao buscar inativos de ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao buscar inativos' });
    }
});

module.exports = router;