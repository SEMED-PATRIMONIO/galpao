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

// 3. Inativar Registro (Soft Delete) - SUPORTE AMPLIADO
// Usamos .all para aceitar DELETE, POST ou PATCH e não dar erro de método
router.all('/:table/inativar/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    
    try {
        let query = '';
        if (tabelasComAtivo.includes(tabela)) {
            // AQUI É ONDE O 't' VIRA 'f'
            query = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
            console.log(`[CRUD] Mudando 'ativo' para FALSE na tabela ${tabela} ID ${id}`);
        } else {
            query = `UPDATE ${tabela} SET status = 'Inativo' WHERE id = $1`;
            console.log(`[CRUD] Mudando 'status' para Inativo na tabela ${tabela} ID ${id}`);
        }

        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro não encontrado no banco de dados.' });
        }

        res.json({ message: 'Registro inativado com sucesso no banco!' });
    } catch (err) {
        console.error("Erro crítico na inativação:", err.message);
        res.status(500).json({ error: 'Erro ao processar inativação no servidor.' });
    }
});

// Mantemos também a rota DELETE padrão por compatibilidade
router.delete('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    try {
        const query = tabelasComAtivo.includes(tabela) 
            ? `UPDATE ${tabela} SET ativo = false WHERE id = $1`
            : `UPDATE ${tabela} SET status = 'Inativo' WHERE id = $1`;
            
        await pool.query(query, [id]);
        res.json({ message: 'Removido com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

// 4. Update Genérica
router.put