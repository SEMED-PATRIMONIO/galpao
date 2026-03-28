const jwt = require('jsonwebtoken');
// Mantive exatamente a sua chave secreta original
const SECRET = process.env.JWT_SECRET || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const tokenQuery = req.query.token;
    
    const tokenRaw = authHeader || tokenQuery;

    if (!tokenRaw) return res.status(403).send('Token não fornecido');

    const token = tokenRaw.startsWith('Bearer ') ? tokenRaw.replace('Bearer ', '') : tokenRaw;

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(500).send('Falha na autenticação');

        // Injeta o objeto completo para que req.user.local_id funcione na rota
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

const verificarPerfil = (perfisPermitidos) => {
    return (req, res, next) => {
        if (!perfisPermitidos.includes(req.perfil)) {
            return res.status(403).send('Acesso negado: perfil sem permissão');
        }
        next();
    };
};

module.exports = { verificarToken, verificarPerfil };