const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// Listar histórico completo com filtros
router.get('/geral', verificarToken, verificarPerfil(['admin', 'super', 'estoque', 'logistica']), async (req, res) => {
    try {
        const { pedido_id, tipo } = req.query;
        let query = `
            SELECT h.*, u.nome as usuario_nome, u.perfil as usuario_perfil 
            FROM historico h 
            JOIN usuarios u ON h.usuario_id = u.id 
            WHERE 1=1
        `;
        const params = [];

        if (pedido_id) {
            params.push(pedido_id);
            query += ` AND h.pedido_id = $${params.length}`;
        }
        if (tipo) {
            params.push(tipo);
            query += ` AND h.tipo_movimentacao = $${params.length}`;
        }

        query += ` ORDER BY h.data DESC LIMIT 200`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;