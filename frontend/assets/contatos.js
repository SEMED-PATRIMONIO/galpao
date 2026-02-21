const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar todos os contatos
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM contatos ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar contatos" });
    }
});

// Salvar novo contato
router.post('/', async (req, res) => {
    const { nome, email, telefone } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO contatos (nome, email, telefone) VALUES ($1, $2, $3) RETURNING *',
            [nome, email, telefone]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao salvar contato" });
    }
});

// Editar contato existente
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, telefone } = req.body;
    try {
        const result = await db.query(
            'UPDATE contatos SET nome = $1, email = $2, telefone = $3 WHERE id = $4 RETURNING *',
            [nome, email, telefone, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Contato não encontrado" });
        res.json({ message: "Contato atualizado com sucesso! ✨" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar contato" });
    }
});

// Rota para Excluir um contato
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM contatos WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Contato não encontrado" });
        res.json({ message: "Contato removido com sucesso! 🗑️" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao excluir contato" });
    }
});

module.exports = router;