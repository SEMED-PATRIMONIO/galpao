const express = require('express');
const router = express.Router();
const pool = require('../db');

// --- CONFIGURAÇÃO ---

// Lista de tabelas que usam a coluna 'ativo' (boolean) para soft delete
const tabelasComAtivo = ['aee_usuarios_equipe', 'aee_alunos', 'aee_profissionais_saude'];

// Função auxiliar para mapear o nome da rota para o nome real da tabela no banco
const getTableName = (param) => {
    const mapping = {
        'alunos': 'aee_alunos',
        'usuarios': 'aee_usuarios_equipe',
        'profissionais': 'aee_profissionais_saude',
        'especialidades': 'aee_especialidades'
    };
    return mapping[param] || param;
};

// --- ROTAS ---

// 1. Listar Registros (Apenas Ativos)
router.get('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    try {
        let query = `SELECT * FROM ${tabela}`;
        
        // Se a tabela tiver lógica de inativação, filtramos apenas os ativos
        if (tabelasComAtivo.includes(tabela)) {
            query += ` WHERE ativo = true`;
        }
        
        query += ` ORDER BY id DESC`;
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(`Erro ao listar ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao buscar dados.' });
    }
});

// 2. Buscar por ID
router.get('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM ${tabela} WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar registro.' });
    }
});

// 3. Inativar Registro (Soft Delete) - CORRIGIDO
router.delete('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    
    try {
        let query = '';
        if (tabelasComAtivo.includes(tabela)) {
            // Caso a tabela use a coluna booleana 'ativo'
            query = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
            console.log(`[CRUD] Inativando via 'ativo=false' na tabela ${tabela} ID ${id}`);
        } else {
            // Caso a tabela use a coluna de texto 'status'
            query = `UPDATE ${tabela} SET status = 'Inativo' WHERE id = $1`;
            console.log(`[CRUD] Inativando via 'status=Inativo' na tabela ${tabela} ID ${id}`);
        }

        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro não encontrado.' });
        }

        res.json({ message: 'Registro removido com sucesso.' });
    } catch (err) {
        console.error("Erro na inativação:", err.message);
        res.status(500).json({ error: 'Erro ao inativar registro no servidor.' });
    }
});

// 4. Exemplo de rota de Update Genérica (ajuste conforme sua necessidade)
router.put('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    const campos = req.body;

    try {
        const keys = Object.keys(campos);
        const values = Object.values(campos);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        
        const query = `UPDATE ${tabela} SET ${setClause} WHERE id = $${keys.length + 1}`;
        await pool.query(query, [...values, id]);
        
        res.json({ message: 'Atualizado com sucesso!' });
    } catch (err) {
        console.error("Erro no update:", err.message);
        res.status(500).json({ error: 'Erro ao atualizar.' });
    }
});

// IMPORTANTE: Exportar o router corretamente para o server.js
module.exports = router;