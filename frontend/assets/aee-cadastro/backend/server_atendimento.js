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
    const { login, senha } = req.body;
    try {
        const result = await pool.query(
            `SELECT p.*, e.nome as nome_especialidade 
             FROM aee_profissionais_saude p
             JOIN aee_especialidades e ON p.especialidade_id = e.id
             WHERE p.login = $1 AND p.ativo = true`, 
            [login]
        );
        const user = result.rows[0];

        if (user && await bcrypt.compare(senha, user.senha_hash)) {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. REGISTRAR PRESENÇA OU FALTA
app.post('/api/atendimentos/registrar', async (req, res) => {
    const { agendamento_id, aluno_id, profissional_id, status, especialidade_id, especialidade_nome } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (status === 'PRESENTE') {
            await client.query(
                `INSERT INTO aee_atendimentos (aluno_id, profissional_id, especialidade_id, especialidade, data_hora, status)
                 VALUES ($1, $2, $3, $4, NOW(), 'Concluído')`,
                [aluno_id, profissional_id, especialidade_id, especialidade_nome]
            );
            await client.query("UPDATE aee_agendamentos SET status = 'Inativo' WHERE id = $1", [agendamento_id]);
        } else {
            // REGISTRA FALTA NA AUDITORIA
            await client.query(
                `INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes)
                 VALUES ($1, $2, $3, $4)`,
                [profissional_id, 'FALTA_ATENDIMENTO', aluno_id, `Falta no atendimento de ${especialidade_nome}`]
            );
            await client.query("UPDATE aee_agendamentos SET status = 'Inativo' WHERE id = $1", [agendamento_id]);
        }

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
const PORT = 3012;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🩺 Portal de Atendimento Médico Online na porta ${PORT}`);
});