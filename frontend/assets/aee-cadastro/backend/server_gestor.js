// /var/www/aee-cadastro/backend/server_gestor.js
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'segredo_gestao_diretoria_aee';

// 1. ROTA DE LOGIN DA EQUIPE/GESTOR
app.post('/api/gestor/login', async (req, res) => {
    const { login, senha } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true', 
            [login]
        );
        const usuario = result.rows[0];

        if (usuario && await bcrypt.compare(senha, usuario.senha_hash)) {
            const token = jwt.sign(
                { id: usuario.id, nome: usuario.nome, nivel: 'gestor' }, 
                JWT_SECRET, 
                { expiresIn: '8h' }
            );
            
            res.json({ 
                token, 
                user: { id: usuario.id, nome: usuario.nome } 
            });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas ou conta inativa.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper para filtros de data
const getPeriodFilter = (start, end, column) => {
    if (start && end) return ` AND ${column} BETWEEN '${start}' AND '${end}'`;
    return "";
};

// 2. ROTA DE ESTATÍSTICAS PARA O DASHBOARD
app.get('/api/diretoria/estatisticas', async (req, res) => {
    const { start, end } = req.query;
    try {
        const stats = {};
        
        // Total de Alunos
        const alunos = await pool.query(`SELECT COUNT(*) FROM aee_alunos WHERE ativo = true ${getPeriodFilter(start, end, 'data_cadastro')}`);
        stats.totalAlunos = alunos.rows[0].count;

        // Total de Profissionais
        const profissionais = await pool.query(`SELECT COUNT(*) FROM aee_profissionais_saude WHERE ativo = true ${getPeriodFilter(start, end, 'criado_em')}`);
        stats.totalProfissionais = profissionais.rows[0].count;

        // Agendamentos por Status
        const agendamentos = await pool.query(`
            SELECT status, COUNT(*) FROM aee_agendamentos 
            WHERE status != 'Inativo' ${getPeriodFilter(start, end, 'data_hora')}
            GROUP BY status
        `);
        stats.agendamentos = agendamentos.rows;

        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. ROTA PARA LISTAGEM DETALHADA
app.get('/api/diretoria/detalhes/:categoria', async (req, res) => {
    const { categoria } = req.params;
    const { start, end } = req.query;
    let query = "";

    switch(categoria) {
        case 'alunos': 
            query = `SELECT nome_completo, ra, escola, data_cadastro FROM aee_alunos WHERE ativo = true ${getPeriodFilter(start, end, 'data_cadastro')}`;
            break;
        case 'profissionais':
            query = `SELECT p.nome, e.nome as especialidade, p.criado_em FROM aee_profissionais_saude p JOIN aee_especialidades e ON p.especialidade_id = e.id WHERE p.ativo = true ${getPeriodFilter(start, end, 'p.criado_em')}`;
            break;
        case 'agendamentos':
            query = `SELECT a.data_hora, al.nome_completo as aluno, p.nome as profissional, a.status FROM aee_agendamentos a JOIN aee_alunos al ON a.aluno_id = al.id JOIN aee_profissionais_saude p ON a.profissional_id = p.id WHERE a.status != 'Inativo' ${getPeriodFilter(start, end, 'a.data_hora')}`;
            break;
        default:
            return res.status(400).json({ error: "Categoria inválida" });
    }

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inicialização
const PORT = 3005;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Servidor de Gestão (Dash) Online na porta ${PORT}`);
});