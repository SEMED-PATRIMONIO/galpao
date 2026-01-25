const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Importações de Rotas
const authRoutes = require('./auth/auth.routes');
const apiRoutes = require('./routes/api.routes'); 

// 1. Rotas da API
app.use('/auth', authRoutes); 
app.use('/', apiRoutes);      

// 2. Servir Arquivos Estáticos
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// 3. Rota de captura (Substituição da linha 23 que causou o erro)
// Usar app.use sem caminho definido funciona como um "catch-all" seguro
app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});