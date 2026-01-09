const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

router.get('/', verificarToken, verificarPerfil(['super', 'admin']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT h.*, u.nome as usuario_nome 
            FROM historico h 
            JOIN usuarios u ON h.usuario_id = u.id 
            ORDER BY h.data DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;