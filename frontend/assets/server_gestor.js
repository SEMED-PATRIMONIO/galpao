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

// 1. LOGIN DA GESTÃO (EQUIPE/DIRETORIA)
app.post('/api/gestor/login', async (req, res) => {
    const login = req.body.login ? req.body.login.trim() : '';
    const senha = req.body.senha ? String(req.body.senha).trim() : '';
    
    try {
        const result = await pool.query(
            'SELECT * FROM aee_usuarios_equipe WHERE login = $1 AND ativo = true', 
            [login]
        );
        const usuario = result.rows[0];

        // Adicionado .trim() no usuario.senha_hash
        if (usuario && await bcrypt.compare(senha, usuario.senha_hash.trim())) {
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

// 2. DASHBOARD - ESTATÍSTICAS GERAIS
app.get('/api/diretoria/stats', async (req, res) => {
    try {
        const totalAlunos = await pool.query('SELECT COUNT(*) FROM aee_alunos WHERE ativo = true');
        const totalProfissionais = await pool.query('SELECT COUNT(*) FROM aee_profissionais_saude WHERE ativo = true');
        const atendimentosMes = await pool.query("SELECT COUNT(*) FROM aee_atendimentos WHERE status = 'Concluído' AND data_hora >= date_trunc('month', now())");
        const faltasMes = await pool.query("SELECT COUNT(*) FROM aee_auditoria WHERE acao = 'FALTA_ATENDIMENTO' AND data_hora >= date_trunc('month', now())");

        res.json({
            alunos: totalAlunos.rows[0].count,
            profissionais: totalProfissionais.rows[0].count,
            atendimentos: atendimentosMes.rows[0].count,
            faltas: faltasMes.rows[0].count
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inicialização na porta 3005
const PORT = 3005;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Portal do Gestor Online na porta ${PORT}`);
});