const express = require('express');
const router = express.Router();
const pool = require('../db');

// --- CONFIGURAÇÃO ---

// Lista exata das tabelas que possuem a coluna 'ativo' (boolean) conforme seu banco
const tabelasComAtivo = [
    'aee_usuarios_equipe', 
    'aee_alunos', 
    'aee_profissionais_saude', 
    'aee_usuarios_pais'
];

// Mapeamento completo das rotas para as tabelas reais do banco
const getTableName = (param) => {
    const mapping = {
        'alunos': 'aee_alunos',
        'usuarios': 'aee_usuarios_equipe',
        'profissionais': 'aee_profissionais_saude',
        'pais': 'aee_usuarios_pais',
        'especialidades': 'aee_especialidades'
    };
    return mapping[param] || param;
};

// --- ROTAS ---

// 1. Listar Registros (Apenas Ativos ou Sem Filtro se não houver coluna ativo)
router.get('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    try {
        let sql = `SELECT * FROM ${tabela}`;
        
        // Filtro blindado: IS NOT FALSE pega TRUE e também registros que porventura estejam NULL
        if (tabelasComAtivo.includes(tabela)) {
            sql += ` WHERE ativo IS NOT FALSE`;
        }
        
        sql += ` ORDER BY id DESC`;
        
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error(`[ERRO LISTAGEM] Tabela ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao buscar dados.' });
    }
});

// 2. Buscar Registro por ID
router.get('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM ${tabela} WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar registro.' });
    }
});

// 3. Inativar Registro (Soft Delete) - ROTA MULTI-MÉTODO
// Esta rota aceita DELETE, POST ou PATCH para garantir que os botões do front funcionem
router.all('/:table/inativar/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    
    try {
        let query = '';
        if (tabelasComAtivo.includes(tabela)) {
            // Comando que muda 't' para 'f' no Postgres
            query = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
        } else {
            // Fallback para tabelas que usem status em texto
            query = `UPDATE ${tabela} SET status = 'Inativo' WHERE id = $1`;
        }

        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro não encontrado para inativação.' });
        }

        res.json({ message: 'Registro inativado com sucesso!' });
    } catch (err) {
        console.error(`[ERRO INATIVAÇÃO] Tabela ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao processar inativação no servidor.' });
    }
});

// 4. Rota DELETE padrão (Por compatibilidade com chamadas diretas)
router.delete('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    try {
        const query = tabelasComAtivo.includes(tabela) 
            ? `UPDATE ${tabela} SET ativo = false WHERE id = $1`
            : `DELETE FROM ${tabela} WHERE id = $1`; // Delete real se não tiver coluna ativo
            
        const result = await pool.query(query, [id]);
        res.json({ message: result.rowCount > 0 ? 'Removido/Inativado com sucesso.' : 'Nada foi alterado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro na operação de exclusão.' });
    }
});

// 5. Atualização Genérica (PUT)
router.put('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    const campos = req.body;

    try {
        const keys = Object.keys(campos);
        if (keys.length === 0) return res.status(400).json({ error: 'Nenhum campo enviado.' });

        const values = Object.values(campos);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        
        const query = `UPDATE ${tabela} SET ${setClause} WHERE id = $${keys.length + 1}`;
        const result = await pool.query(query, [...values, id]);
        
        res.json({ message: 'Atualizado com sucesso!', affected: result.rowCount });
    } catch (err) {
        console.error(`[ERRO UPDATE] Tabela ${tabela}:`, err.message);
        res.status(500).json({ error: 'Erro ao atualizar registro.' });
    }
});

module.exports = router;