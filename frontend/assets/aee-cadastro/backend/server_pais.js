// /var/www/aee-cadastro/backend/server_pais.js
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
const JWT_SECRET = 'segredo_pais_aee';

// Middleware para registrar logs de acesso
const registrarLogAcesso = async (paiId, alunoId) => {
    await pool.query(
        'INSERT INTO aee_log_acesso_pais (pai_id, aluno_id) VALUES ($1, $2)',
        [paiId, alunoId]
    );
};

// Login com verificação de Primeiro Acesso
app.post('/api/pais/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM aee_usuarios_pais WHERE usuario = $1 AND ativo = true', [usuario]);
        const pai = result.rows[0];

        if (pai && await bcrypt.compare(senha, pai.senha_hash)) {
            const token = jwt.sign({ id: pai.id, aluno_id: pai.aluno_id }, JWT_SECRET);
            
            // Se for primeiro acesso, obriga a troca de senha
            if (pai.primeiro_acesso) {
                return res.json({ token, forcePasswordChange: true });
            }

            await registrarLogAcesso(pai.id, pai.aluno_id);
            res.json({ token, aluno_id: pai.aluno_id, nome_pai: pai.usuario });
        } else {
            res.status(401).json({ error: 'Acesso negado' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Troca de Senha Obrigatória (Primeiro Acesso)
app.post('/api/pais/primeiro-acesso', async (req, res) => {
    const { paiId, novaSenha } = req.body;
    const hash = await bcrypt.hash(novaSenha, 10);
    try {
        await pool.query(
            'UPDATE aee_usuarios_pais SET senha_hash = $1, primeiro_acesso = false, senha_alterada = true WHERE id = $2',
            [hash, paiId]
        );
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Buscar agendamentos não visualizados (Para o Alerta)
app.get('/api/pais/alertas/:alunoId', async (req, res) => {
    try {
        // Busca agendamentos que não possuem registro de 'Ciente' na auditoria
        const agendamentos = await pool.query(
            `SELECT ag.* FROM aee_agendamentos ag
             WHERE ag.aluno_id = $1 AND ag.status = 'Agendado'
             AND NOT EXISTS (
                 SELECT 1 FROM aee_auditoria au 
                 WHERE au.aluno_id = ag.aluno_id AND au.detalhes LIKE '%' || ag.id || '%'
             )`, [req.params.alunoId]);
        res.json(agendamentos.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registrar Ciência na Auditoria
app.post('/api/pais/confirmar-ciencia', async (req, res) => {
    const { paiId, alunoId, agendamentoId, detalhes } = req.body;
    try {
        await pool.query(
            'INSERT INTO aee_auditoria (usuario_id, acao, aluno_id, detalhes) VALUES ($1, $2, $3, $4)',
            [paiId, 'Ciente de Agendamento', alunoId, `Ciente do Agendamento ID: ${agendamentoId}. ${detalhes}`]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3011, () => console.log('Portal dos Pais rodando na porta 3011'));