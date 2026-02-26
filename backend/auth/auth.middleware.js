const jwt = require('jsonwebtoken');
const SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send('Token não fornecido');

    jwt.verify(token.replace('Bearer ', ''), SECRET, (err, decoded) => {
        if (err) return res.status(500).send('Falha na autenticação');

        // 1. MANTÉM O QUE JÁ EXISTIA (Para não quebrar rotas antigas)
        req.userId = decoded.id;
        req.perfil = decoded.perfil;

        // 2. ADICIONA O NOVO OBJETO (Para as rotas de Patrimônio e novas funções)
        req.user = {
            id: decoded.id,
            perfil: decoded.perfil,
            local_id: decoded.local_id // O "pulo do gato" está aqui
        };

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
