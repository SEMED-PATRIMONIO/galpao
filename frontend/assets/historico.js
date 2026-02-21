const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM historico ORDER BY data_hora DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao ler histórico" });
    }
});

module.exports = router;