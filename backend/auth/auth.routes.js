const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const db = require('../db'); // Corretamente subindo uma pasta
const { verificarToken, verificarPerfil } = require('./auth.middleware');

router.post('/login', authController.login);

router.patch('/alterar-senha', verificarToken, async (req, res) => {
    const { novaSenha } = req.body;
    try {
        await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [novaSenha, req.userId]);
        res.json({ message: 'SENHA ALTERADA COM SUCESSO!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;