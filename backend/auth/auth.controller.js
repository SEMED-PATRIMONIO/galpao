const db = require('../db');
const jwt = require('jsonwebtoken');
const SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

exports.login = async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await db.query('SELECT * FROM usuarios WHERE nome = $1 AND status = $2', [usuario.toUpperCase(), 'ativo']);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Usuário não encontrado ou inativo' });
        }

        const user = result.rows[0];

        if (senha !== user.senha) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        // CORREÇÃO: Adicionado local_id ao payload do Token
        const token = jwt.sign({ 
            id: user.id, 
            perfil: user.perfil, 
            local_id: user.local_id 
        }, SECRET, { expiresIn: '8h' });

        // Retorna também o local_id para o frontend (script.js)
        res.json({
            token,
            perfil: user.perfil,
            nome: user.nome,
            local_id: user.local_id
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};