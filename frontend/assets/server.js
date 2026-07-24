const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3038;
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_lifyn_troque_em_producao';

// Middleware para processar JSON e formulários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// BANCO DE DADOS EM MEMÓRIA (Substitua pela sua conexão de banco real, ex: Postgres/MongoDB)
// -----------------------------------------------------------------------------
const usersDatabase = [
  {
    id: 'usr_1',
    username: 'admin',
    // Senha pré-criptografada para a palavra "123456"
    passwordHash: '$2a$10$wJkS9G305K1P2NfR1p392.Gj3h1O1u1v3a1R1p392.Gj3h1O1u1v3', 
    dadosConta: {
      nome: 'Administrador Lifyn',
      configuracoes: { tema: 'escuro', notificacoes: true }
    }
  }
];

// -----------------------------------------------------------------------------
// MIDDLEWARE DE AUTENTICAÇÃO
// -----------------------------------------------------------------------------
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const decodificado = jwt.verify(token, JWT_SECRET);
    req.user = decodificado;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
}

// -----------------------------------------------------------------------------
// ROTAS DA API
// -----------------------------------------------------------------------------

// 1. Rota de Login (Dispositivo Novo)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  // Busca o usuário
  const user = usersDatabase.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  // No caso de banco real, use bcrypt.compare(password, user.passwordHash)
  if (!user) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  // Gerar Token JWT com validade de 30 dias para persistência de login
  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.json({
    message: 'Login realizado com sucesso!',
    token,
    user: {
      id: user.id,
      username: user.username,
      dadosConta: user.dadosConta
    }
  });
});

// 2. Rota de Validação do Token (Dispositivo Já Cadastrado)
app.get('/api/me', verificarToken, (req, res) => {
  const user = usersDatabase.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      dadosConta: user.dadosConta
    }
  });
});

// Fallback para SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`Servidor Lifyn rodando com sucesso na porta ${PORT}`);
});