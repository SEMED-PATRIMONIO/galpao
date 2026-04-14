const express = require('express');
const router = express.Router();
const pool = require('../db'); // Certifique-se que o caminho do seu pool está correto
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Recomendado para comparar senhas

const JWT_SECRET = process.env.JWT_SECRET || 'omeq_secret_key_2026';

// 1. LOGIN PARA EQUIPE TÉCNICA / GESTORES
router.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_equipe WHERE usuario = $1 AND ativo = true',
            [usuario]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
        }

        const user = result.rows[0];

        // Comparação de senha (se estiver usando bcrypt)
        // const match = await bcrypt.compare(senha, user.senha_hash);
        // Se estiver usando texto plano para teste (não recomendado):
        const match = (senha === user.senha_hash);

        if (!match) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        const token = jwt.sign(
            { id: user.id, role: 'equipe', cargo: user.cargo },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Remove a senha antes de enviar para o frontend
        delete user.senha_hash;

        res.json({ token, user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

// 2. LOGIN PARA PAIS / RESPONSÁVEIS
router.post('/login-pais', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_pais WHERE usuario = $1 AND ativo = true',
            [usuario]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Responsável não encontrado ou inativo.' });
        }

        const user = result.rows[0];
        const match = (senha === user.senha_hash); // Ajustar para bcrypt se necessário

        if (!match) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        const token = jwt.sign(
            { id: user.id, role: 'pai', aluno_id: user.aluno_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        delete user.senha_hash;

        res.json({ token, user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

module.exports = router;