const jwt = require('jsonwebtoken');
const SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

const verificarToken = (req, res, next) => {
    // 1. Tenta pegar do Header (Bearer) ou da Query String (?token=...)
    const authHeader = req.headers['authorization'];
    const tokenHeader = authHeader ? authHeader.replace('Bearer ', '') : null;
    const tokenQuery = req.query.token;

    const token = tokenHeader || tokenQuery;

    if (!token) return res.status(403).send('Token não fornecido');

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(500).send('Falha na autenticação');

        req.userId = decoded.id;
        req.perfil = decoded.perfil;
        req.user = {
            id: decoded.id,
            perfil: decoded.perfil,
            local_id: decoded.local_id
        };

        next();
    });
};

module.exports = { verificarToken };