const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// Entrada em massa de Patrimônio
router.post('/patrimonio/massa', verificarToken, verificarPerfil(['admin']), async (req, res) => {
    const { produto_id, local_id, setor_id, series } = req.body;
    try {
        await db.query('BEGIN');
        for (let serie of series) {
            await db.query(
                'INSERT INTO patrimonios (produto_id, numero_serie, local_id, setor_id, status) VALUES ($1, $2, $3, $4, $5)',
                [produto_id, serie.toUpperCase(), local_id, setor_id, 'ESTOQUE']
            );
        }
        await db.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2', [series.length, produto_id]);
        await db.query('COMMIT');
        res.json({ message: 'Patrimônios cadastrados com sucesso' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Listar estoque com alertas de nível baixo (para MATERIAL)
router.get('/central', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.nome as categoria_nome,
            (p.tipo = 'MATERIAL' AND p.quantidade_estoque <= p.alerta_minimo) as alerta_baixo
            FROM produtos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.nome ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;