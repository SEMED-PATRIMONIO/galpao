  GNU nano 7.2                              /var/www/email/backend/server.js                                        
const cors = require('cors');
const path = require('path');
const contatoRoutes = require('./routes/contatos');
const emailRoutes = require('./routes/email'); // <-- ESSA LINHA ESTAVA FALTANDO!

const app = express();
const PORT = 3011;

app.use(cors());
app.use(express.json());

// Servir o frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rotas da API
app.use('/api/contatos', contatoRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/historico', historicoRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
