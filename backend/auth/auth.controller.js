
const db = require('../db');
const jwt = require('jsonwebtoken');
const SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

exports.login = async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        // No PostgreSQL usamos db.query e acessamos o array .rows
        const result = await db.query('SELECT * FROM usuarios WHERE nome = $1 AND status = $2', [usuario.toUpperCase(), 'ativo']);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Usuário não encontrado ou inativo' });
        }

        const user = result.rows[0];

        // Verificação simples de senha conforme solicitado (texto plano ou hash)
        if (senha !== user.senha) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        const token = jwt.sign({ id: user.id, perfil: user.perfil }, SECRET, { expiresIn: '8h' });

        res.json({
            token,
            perfil: user.perfil,
            nome: user.nome
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


