// /var/www/aee-cadastro/backend/server_atendimento.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'segredo_medico_aee';

// 1. LOGIN DO PROFISSIONAL
app.post('/api/auth/login-profissional', async (req, res) => {
    const login = req.body.login ? req.body.login.trim() : '';
    const senha = req.body.senha ? String(req.body.senha).trim() : '';
    
    try {
        const result = await pool.query(
            `SELECT p.*, e.nome as nome_especialidade 
             FROM aee_profissionais_saude p
             JOIN aee_especialidades e ON p.especialidade_id = e.id
             WHERE p.login = $1 AND p.ativo = true`, 
            [login]
        );
        const user = result.rows[0];

        if (user && await bcrypt.compare(senha, user.senha_hash.trim())) {
            const token = jwt.sign({ 
                id: user.id, 
                especialidade_id: user.especialidade_id,
                nome: user.nome,
                cargo: 'profissional'
            }, JWT_SECRET, { expiresIn: '8h' });

            res.json({ token, user: { id: user.id, nome: user.nome, especialidade: user.nome_especialidade } });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inicialização na porta 3012
const PORT = 3012;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🩺 Portal de Atendimento Online na porta ${PORT}`);
});