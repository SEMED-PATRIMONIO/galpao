const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const db = require('../db');
const { verificarToken, verificarPerfil } = require('./auth.middleware');

router.post('/login', authController.login);

// Criar usuário (Apenas Super)
router.post('/usuarios', verificarToken, verificarPerfil(['super']), async (req, res) => {
    const { nome, senha, perfil, local_id } = req.body;
    try {
        await db.query(
            'INSERT INTO usuarios (nome, senha, perfil, local_id, status) VALUES ($1, $2, $3, $4, $5)',
            [nome.toUpperCase(), senha, perfil, local_id, 'ativo']
        );
        res.json({ message: 'USUÁRIO CRIADO' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Inativar/Reativar usuário (Apenas Super)
router.patch('/usuarios/:id/status', verificarToken, verificarPerfil(['super']), async (req, res) => {
    const { status } = req.body;
    try {
        await db.query('UPDATE usuarios SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ message: 'STATUS ATUALIZADO' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar usuários para o Super (sem mostrar senhas)
router.get('/usuarios', verificarToken, verificarPerfil(['super']), async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome, perfil, status FROM usuarios');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/alterar-senha', verificarToken, async (req, res) => {
    const { novaSenha } = req.body;
    try {
        await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [novaSenha, req.userId]);
        res.json({ message: 'SENHA ALTERADA COM SUCESSO' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;