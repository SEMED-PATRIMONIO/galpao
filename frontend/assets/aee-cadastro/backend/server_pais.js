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
    const { usuario, senha } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_pais WHERE usuario = $1 AND ativo = true', 
            [usuario]
        );
        const pai = result.rows[0];

        if (pai && await bcrypt.compare(senha, pai.senha_hash)) {
            // REGISTRA O LOG DE ACESSO
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
            SELECT a.id as agendamento_id, a.data_hora, p.nome as profissional, 
                   e.nome as especialidade_nome, e.id as especialidade_id, a.status
            FROM aee_agendamentos a
            JOIN aee_profissionais_saude p ON a.profissional_id = p.id
            JOIN aee_especialidades e ON p.especialidade_id = e.id
            WHERE a.aluno_id = $1 AND a.status != 'Inativo'
            ORDER BY a.data_hora ASC
        `, [aluno_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. CONFIRMAR LEITURA/AGENDAMENTO
app.post('/api/pais/confirmar-leitura', async (req, res) => {
    const { agendamento_id, aluno_id, especialidade_id, especialidade_nome, data_hora } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("UPDATE aee_agendamentos SET status = 'Confirmado' WHERE id = $1", [agendamento_id]);
        
        const insertAtendimento = `
            INSERT INTO aee_atendimentos (aluno_id, especialidade, especialidade_id, data_hora, status, visualizado_em)
            VALUES ($1, $2, $3, $4, 'Agendado', NOW())
        `;
        await client.query(insertAtendimento, [aluno_id, especialidade_nome, especialidade_id, data_hora]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Inicialização
const PORT = 3011;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`👨‍👩‍👧‍👦 Portal dos Pais Online na porta ${PORT}`);
});