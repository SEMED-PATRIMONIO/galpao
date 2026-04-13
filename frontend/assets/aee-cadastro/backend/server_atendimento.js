const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'segredo_medico_aee'; // Em produção, use variável de ambiente

// ==========================================
// 1. LOGIN DO PROFISSIONAL
// ==========================================
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

            res.json({ 
                token, 
                user: { 
                    id: user.id,
                    nome: user.nome, 
                    esp_id: user.especialidade_id,
                    esp_nome: user.nome_especialidade 
                } 
            });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas ou acesso inativo.' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 2. LISTAR ALUNOS DA ESPECIALIDADE
// ==========================================
app.get('/api/alunos/por-especialidade/:espId', async (req, res) => {
    const { espId } = req.params;
    try {
        // Busca o nome da especialidade para filtrar no JSONB
        const espResult = await pool.query('SELECT nome FROM aee_especialidades WHERE id = $1', [espId]);
        if (espResult.rowCount === 0) return res.status(404).json({ error: "Especialidade não encontrada" });
        
        const nomeEsp = espResult.rows[0].nome;

        // Filtra alunos que tenham essa especialidade marcada como TRUE no JSONB
        const alunos = await pool.query(
            "SELECT id, nome_completo, ra, escola FROM aee_alunos WHERE especialidades->>$1 = 'true' AND ativo = true ORDER BY nome_completo",
            [nomeEsp]
        );
        res.json(alunos.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 3. AGENDA DO DIA E ALERTAS DE PENDÊNCIA
// ==========================================
app.get('/api/agenda/:profissionalId', async (req, res) => {
    const { profissionalId } = req.params;
    try {
        // 1. Agendamentos de HOJE
        const hoje = await pool.query(
            `SELECT g.*, a.nome_completo as aluno_nome 
             FROM aee_agendamentos g
             JOIN aee_alunos a ON g.aluno_id = a.id
             WHERE g.profissional_id = $1 
             AND g.data_hora::date = CURRENT_DATE
             AND g.status = 'Agendado'
             ORDER BY g.data_hora ASC`,
            [profissionalId]
        );

        // 2. Alertas: Agendamentos de ONTEM (ou antes) sem atendimento registrado
        const pendentes = await pool.query(
            `SELECT g.*, a.nome_completo as aluno_nome 
             FROM aee_agendamentos g
             JOIN aee_alunos a ON g.aluno_id = a.id
             WHERE g.profissional_id = $1 
             AND g.data_hora::date < CURRENT_DATE
             AND g.status = 'Agendado'
             ORDER BY g.data_hora DESC`,
            [profissionalId]
        );

        res.json({ hoje: hoje.rows, pendentes: pendentes.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 4. REGISTRAR ATENDIMENTO / FALTA
// ==========================================
app.post('/api/atendimentos/registrar', async (req, res) => {
    const { agendamento_id, aluno_id, profissional_id, especialidade_id, especialidade_nome, status, evolucao, obs_clinica } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (status === 'Atendido') {
            // Insere na tabela aee_atendimentos
            await client.query(
                `INSERT INTO aee_atendimentos (aluno_id, especialidade, especialidade_id, data_hora, status, evolucao, observacao_clinica)
                 VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
                [aluno_id, especialidade_nome, especialidade_id, status, evolucao, obs_clinica]
            );
            
            // Atualiza o agendamento original
            await client.query('UPDATE aee_agendamentos SET status = $1 WHERE id = $2', ['Atendido', agendamento_id]);
            
        } else if (status === 'Não Compareceu') {
            // Registra na Auditoria
            await client.query(
                `INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes)
                 VALUES ($1, $2, $3, $4)`,
                [profissional_id, 'FALTA_ATENDIMENTO', aluno_id, `O aluno não compareceu ao atendimento de ${especialidade_nome} agendado.`]
            );
            
            // Atualiza o agendamento para Inativo (concluído por falta)
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

// Registrar NOVO Agendamento
app.post('/api/agendamentos', async (req, res) => {
    const { profissional_id, aluno_id, data_hora, observacoes } = req.body;
    try {
        await pool.query(
            'INSERT INTO aee_agendamentos (profissional_id, aluno_id, data_hora, observacoes, status) VALUES ($1, $2, $3, $4, $5)',
            [profissional_id, aluno_id, data_hora, observacoes, 'Agendado']
        );
        res.status(201).json({ message: 'Agendamento realizado!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = 3005; // Porta diferente do portal admin
app.listen(PORT, () => console.log(`Portal Profissional rodando na porta ${PORT}`));