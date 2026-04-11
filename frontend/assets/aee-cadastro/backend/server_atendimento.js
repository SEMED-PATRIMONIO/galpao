// /var/www/aee-cadastro/backend/server_atendimento.js
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = 'segredo_medico_aee';

// Login do Profissional
app.post('/api/auth/login', async (req, res) => {
    const { login, senha } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM aee_profissionais_saude WHERE login = $1 AND ativo = true', 
            [login]
        );
        const user = result.rows[0];

        if (user && await bcrypt.compare(senha, user.senha_hash)) {
            const token = jwt.sign({ 
                id: user.id, 
                especialidade_id: user.especialidade_id 
            }, JWT_SECRET);
            res.json({ token, user: { nome: user.nome, esp_id: user.especialidade_id } });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas ou usuário inativo' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar Alunos da Especialidade do Médico
app.get('/api/meus-alunos', async (req, res) => {
    const { esp_id } = req.query;
    try {
        // Busca o nome da especialidade para filtrar no JSONB
        const esp = await pool.query('SELECT nome FROM aee_especialidades WHERE id = $1', [esp_id]);
        const nomeEsp = esp.rows[0].nome;

        // Filtra alunos que tenham essa especialidade no campo JSONB 
        const alunos = await pool.query(
            "SELECT id, nome_completo, ra FROM aee_alunos WHERE especialidades ? $1 ORDER BY nome_completo",
            [nomeEsp]
        );
        res.json(alunos.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Histórico Clínico Completo (Multidisciplinar)
app.get('/api/historico/:alunoId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, e.nome as nome_especialidade 
             FROM aee_atendimentos a 
             LEFT JOIN aee_especialidades e ON a.especialidade_id = e.id 
             WHERE a.aluno_id = $1 
             ORDER BY a.data_hora DESC`, 
            [req.params.alunoId]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registrar Agendamento [cite: 1]
app.post('/api/agendamentos', async (req, res) => {
    const { profissional_id, aluno_id, data_hora, observacoes } = req.body;
    try {
        await pool.query(
            'INSERT INTO aee_agendamentos (profissional_id, aluno_id, data_hora, observacoes) VALUES ($1, $2, $3, $4)',
            [profissional_id, aluno_id, data_hora, observacoes]
        );
        res.status(201).json({ message: 'Agendado com sucesso' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3012, () => console.log('Portal Médico na porta 3012'));