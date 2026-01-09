const jwt = require('jsonwebtoken');
const SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send('Token não fornecido');

    jwt.verify(token.replace('Bearer ', ''), SECRET, (err, decoded) => {
        if (err) return res.status(500).send('Falha na autenticação');
        req.userId = decoded.id;
        req.perfil = decoded.perfil;
        next();
    });
};

const verificarPerfil = (perfisPermitidos) => {
    return (req, res, next) => {
        if (!perfisPermitidos.includes(req.perfil)) {
            return res.status(403).send('Acesso negado para seu perfil');
        }
        next();
    };
};

module.exports = { verificarToken, verificarPerfil };
