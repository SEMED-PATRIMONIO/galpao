const jwt = require('jsonwebtoken');
// Mantive exatamente a sua chave secreta original
const SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30';

const verificarToken = (req, res, next) => {
    // 1. Tenta pegar o token do cabeçalho ou da URL (para o PDF)
    const authHeader = req.headers['authorization'];
    const tokenQuery = req.query.token;
    
    const tokenRaw = authHeader || tokenQuery;


    if (!tokenRaw) return res.status(403).send('Token não fornecido');

    // 2. Extrai o token bruto (remove "Bearer " se vier do header)
    const token = tokenRaw.startsWith('Bearer ') ? tokenRaw.replace('Bearer ', '') : tokenRaw;

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(500).send('Falha na autenticação');

        // 3. Injeta os dados necessários para o restante do sistema
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

// ESTA É A FUNÇÃO QUE EU HAVIA ESQUECIDO (E QUE CAUSOU O ERRO):
const verificarPerfil = (perfisPermitidos) => {
    return (req, res, next) => {
        if (!perfisPermitidos.includes(req.perfil)) {
            return res.status(403).send('Acesso negado: perfil sem permissão');
        }
        next();
    };
};

// Exportando ambas as funções para o seu server.js e rotas funcionarem
module.exports = { verificarToken, verificarPerfil };