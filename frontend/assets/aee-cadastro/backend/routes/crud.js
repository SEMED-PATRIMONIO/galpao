const express = require('express');
const router = express.Router();
const pool = require('../db');

const tabelasComAtivo = ['aee_usuarios_equipe', 'aee_alunos', 'aee_profissionais_saude', 'aee_usuarios_pais'];

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

// 1. LISTAGEM (Garante retorno de array para evitar tela branca)
router.get('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    try {
        let sql = `SELECT * FROM ${tabela}`;
        if (tabelasComAtivo.includes(tabela)) sql += ` WHERE ativo = true`;
        sql += ` ORDER BY id DESC`;
        const result = await pool.query(sql);
        res.json(result.rows || []);
    } catch (err) {
        res.status(200).json([]); // Retorna vazio em vez de erro para o front não travar
    }
});

// 2. INATIVAR (Ajustado para a URL que o seu Dashboard.jsx usa)
router.patch('/:table/:id/inativar', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    try {
        const query = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
        await pool.query(query, [id]);
        res.json({ message: 'Inativado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao inativar no banco.' });
    }
});

// 3. SALVAR NOVO (POST) - Faltava esta rota no seu código
router.post('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const campos = req.body;
    try {
        const keys = Object.keys(campos);
        const values = Object.values(campos);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO ${tabela} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao inserir registro.' });
    }
});

// 4. ATUALIZAR (PUT)
router.put('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    const campos = req.body; // O front envia os campos alterados aqui
    
    try {
        const keys = Object.keys(campos).filter(k => k !== 'id');
        const values = Object.values(campos).filter((v, i) => Object.keys(campos)[i] !== 'id');
        
        // Monta o SQL automaticamente: "SET nome=$1, ra=$2..."
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        
        const query = `UPDATE ${tabela} SET ${setClause} WHERE id = $${keys.length + 1}`;
        const result = await pool.query(query, [...values, id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Não encontrado' });
        
        res.json({ message: 'Atualizado com sucesso no Postgres!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao editar no banco' });
    }
});

module.exports = router;