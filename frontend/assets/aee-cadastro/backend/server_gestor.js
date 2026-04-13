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
        // Busca o usuário na tabela aee_usuarios_equipe [cite: 88, 94]
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true', 
            [login]
        );
        const usuario = result.rows[0];

        // Verifica a senha através do hash 
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
            res.status(401).json({ error: 'Credenciais inválidas ou acesso inativo' });
        }
    } catch (err) {
        res.status(500).json({ error: "Erro no servidor: " + err.message });
    }
});

// Helper para filtros de data (usado nas estatísticas)
const getPeriodFilter = (startDate, endDate, column) => {
    if (startDate && endDate) {
        return ` AND ${column} BETWEEN '${startDate} 00:00:00' AND '${endDate} 23:59:59'`;
    }
    return '';
};

// 2. ROTA DE ESTATÍSTICAS (DASHBOARD)
app.get('/api/diretoria/stats', async (req, res) => {
    const { start, end } = req.query;
    try {
        const stats = {
            // Contagens baseadas nas tabelas do sistema [cite: 18, 73, 62, 1, 34]
            alunos: (await pool.query(`SELECT count(*) FROM aee_alunos WHERE ativo = true ${getPeriodFilter(start, end, 'data_cadastro')}`)).rows[0].count,
            profissionais: (await pool.query(`SELECT count(*) FROM aee_profissionais_saude WHERE ativo = true ${getPeriodFilter(start, end, 'criado_em')}`)).rows[0].count,
            especialidades: (await pool.query(`SELECT count(*) FROM aee_especialidades WHERE ativo = true`)).rows[0].count,
            agendamentos: (await pool.query(`SELECT count(*) FROM aee_agendamentos WHERE status != 'Inativo' ${getPeriodFilter(start, end, 'data_hora')}`)).rows[0].count,
            atendimentos: (await pool.query(`SELECT count(*) FROM aee_atendimentos WHERE status = 'Realizado' ${getPeriodFilter(start, end, 'data_hora')}`)).rows[0].count,
            faltas: (await pool.query(`SELECT count(*) FROM aee_atendimentos WHERE status = 'Falta' ${getPeriodFilter(start, end, 'data_hora')}`)).rows[0].count,
            // Agendamentos que ainda aguardam confirmação do pai (status 'Agendado') [cite: 13]
            pendentes_pai: (await pool.query(`SELECT count(*) FROM aee_agendamentos WHERE status = 'Agendado'`)).rows[0].count
        };
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. ROTA PARA LISTAGEM DETALHADA (MODAL E PDF)
app.get('/api/diretoria/detalhes/:categoria', async (req, res) => {
    const { categoria } = req.params;
    const { start, end } = req.query;
    let query = "";

    // Mapeamento de categorias para queries SQL reais
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
    }
    
    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3005, () => console.log('🚀 Servidor GESTOR/DIRETORIA rodando na porta 3005'));