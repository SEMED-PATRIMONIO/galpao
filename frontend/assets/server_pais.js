// /var/www/aee-cadastro/backend/server_pais.js
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'segredo_acesso_pais_aee';

// 1. LOGIN DOS PAIS + REGISTRO DE LOG
app.post('/api/pais/login', async (req, res) => {
    const usuario = req.body.usuario ? req.body.usuario.trim() : '';
    const senha = req.body.senha ? String(req.body.senha).trim() : '';
    
    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_pais WHERE usuario = $1 AND ativo = true', 
            [usuario]
        );
        const pai = result.rows[0];

        if (pai && await bcrypt.compare(senha, pai.senha_hash.trim())) {
            await pool.query(
                'INSERT INTO aee_log_acesso_pais (pai_id, aluno_id) VALUES ($1, $2)',
                [pai.id, pai.aluno_id]
            );
            const token = jwt.sign({ id: pai.id, aluno_id: pai.aluno_id }, JWT_SECRET);
            res.json({ token, aluno_id: pai.aluno_id });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. BUSCAR AGENDAMENTOS DO FILHO
app.get('/api/pais/agendamentos/:aluno_id', async (req, res) => {
    const { aluno_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT a.id, a.data_hora, p.nome as profissional, 
                   e.nome as especialidade_nome, a.status
            FROM aee_agendamentos a
            JOIN aee_profissionais_saude p ON a.profissional_id = p.id
            JOIN aee_especialidades e ON p.especialidade_id = e.id
            WHERE a.aluno_id = $1 AND a.status != 'Inativo'
            ORDER BY a.data_hora ASC
        `, [aluno_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inicialização na porta 3011
const PORT = 3011;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`👨‍👩‍👧‍👦 Portal dos Pais Online na porta ${PORT}`);
});