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
        // Busca o pai na tabela aee_usuarios_pais
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_pais WHERE usuario = $1 AND ativo = true', 
            [usuario]
        );
        const pai = result.rows[0];

        // Verifica a senha (pode ser o PIN ou Hash, dependendo do seu fluxo, aqui usaremos o hash)
        if (pai && await bcrypt.compare(senha, pai.senha_hash)) {
            
            // REGISTRA O LOG DE ACESSO IMEDIATAMENTE
            await pool.query(
                'INSERT INTO aee_log_acesso_pais (pai_id, aluno_id) VALUES ($1, $2)',
                [pai.id, pai.aluno_id]
            );

            const token = jwt.sign({ id: pai.id, aluno_id: pai.aluno_id }, JWT_SECRET);
            
            res.json({ 
                token, 
                user: { 
                    id: pai.id, 
                    aluno_id: pai.aluno_id, 
                    nome: pai.usuario 
                } 
            });
        } else {
            res.status(401).json({ error: 'Usuário ou senha inválidos' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. BUSCAR AGENDAMENTOS PENDENTES (STATUS = 'Agendado')
app.get('/api/pais/avisos/:alunoId', async (req, res) => {
    const { alunoId } = req.params;
    try {
        const query = `
            SELECT 
                a.id, 
                a.data_hora, 
                a.status,
                p.nome as profissional_nome,
                e.nome as especialidade_nome,
                e.id as especialidade_id
            FROM aee_agendamentos a
            JOIN aee_profissionais_saude p ON a.profissional_id = p.id
            JOIN aee_especialidades e ON p.especialidade_id = e.id
            WHERE a.aluno_id = $1 AND a.status = 'Agendado'
            ORDER BY a.data_hora ASC
        `;
        const result = await pool.query(query, [alunoId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. CONFIRMAR AGENDAMENTO (CIÊNCIA DOS PAIS)
app.post('/api/pais/confirmar-leitura', async (req, res) => {
    const { agendamento_id, aluno_id, especialidade_id, especialidade_nome, data_hora } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // A. Atualiza status na tabela aee_agendamentos
        await client.query(
            "UPDATE aee_agendamentos SET status = 'Confirmado' WHERE id = $1",
            [agendamento_id]
        );

        // B. Registra na tabela aee_atendimentos com o campo visualizado_em
        // Criamos um registro de atendimento prévio ou vinculamos ao existente
        const insertAtendimento = `
            INSERT INTO aee_atendimentos 
            (aluno_id, especialidade, especialidade_id, data_hora, status, visualizado_em)
            VALUES ($1, $2, $3, $4, 'Agendado', NOW())
        `;
        await client.query(insertAtendimento, [aluno_id, especialidade_nome, especialidade_id, data_hora]);

        await client.query('COMMIT');
        res.json({ message: "Ciência registrada com sucesso!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.listen(3006, () => console.log('Servidor Portal dos Pais rodando na porta 3006'));