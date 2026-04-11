// /var/www/aee-cadastro/backend/server_gestor.js
const express = require('express');
const pool = require('./db');
const app = express();
app.use(express.json());

app.get('/api/gestor/stats', async (req, res) => {
    const { inicio, fim } = req.query;
    // Datas padrão caso não enviadas (mês atual)
    const dIni = inicio || '2000-01-01'; 
    const dFim = fim || '2099-12-31';

    try {
        const stats = {};

        // Totais Gerais no Período
        stats.agendamentos = (await pool.query("SELECT count(*) FROM aee_agendamentos WHERE data_hora BETWEEN $1 AND $2", [dIni, dFim])).rows[0].count;
        stats.alunos = (await pool.query("SELECT count(*) FROM aee_alunos WHERE criado_em BETWEEN $1 AND $2", [dIni, dFim])).rows[0].count;
        stats.atendimentos = (await pool.query("SELECT count(*) FROM aee_atendimentos WHERE data_hora BETWEEN $1 AND $2", [dIni, dFim])).rows[0].count;
        stats.especialidades = (await pool.query("SELECT count(*) FROM aee_especialidades")).rows[0].count;
        stats.profissionais = (await pool.query("SELECT count(*) FROM aee_profissionais_saude WHERE ativo = true")).rows[0].count;

        // Profissional que mais atendeu no período
        const topProf = await pool.query(`
            SELECT p.nome, count(a.id) as total 
            FROM aee_atendimentos a
            JOIN aee_profissionais_saude p ON a.profissional_id = p.id
            WHERE a.data_hora BETWEEN $1 AND $2
            GROUP BY p.nome ORDER BY total DESC LIMIT 1
        `, [dIni, dFim]);
        
        stats.top_profissional = topProf.rows[0] || { nome: "Nenhum no período", total: 0 };

        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Endpoint para listagem detalhada do Modal
app.get('/api/gestor/detalhes/:tabela', async (req, res) => {
    const { tabela } = req.params;
    const { inicio, fim } = req.query;
    let campoData = (tabela === 'aee_alunos' || tabela === 'aee_especialidades') ? 'criado_em' : 'data_hora';
    
    try {
        const query = `SELECT * FROM ${tabela} WHERE ${campoData} BETWEEN $1 AND $2 ORDER BY ${campoData} DESC`;
        const result = await pool.query(query, [inicio, fim]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3005, () => console.log('Painel do Gestor na porta 3005'));