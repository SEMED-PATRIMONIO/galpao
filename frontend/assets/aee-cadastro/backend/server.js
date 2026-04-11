// /var/www/aee-cadastro/backend/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Importação necessária para a rota de senha
const pool = require('./db');     // Importação necessária para a rota de senha
const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/crud');

const app = express();
app.use(cors());
app.use(express.json());

// Registro das Rotas Modulares
app.use('/api/auth', authRoutes);
app.use('/api/crud', crudRoutes);
app.use('/api/data', crudRoutes);

// Rota de alteração de senha implementada (Usada pelo ChangePasswordModal)
app.patch('/api/usuarios/update-password/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(senha, salt);
        
        // Atualiza a senha na tabela de equipe conforme o schema [cite: 96]
        await pool.query(
            'UPDATE aee_usuarios_equipe SET senha_hash = $1 WHERE id = $2',
            [hash, id]
        );
        
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar senha: " + err.message });
    }
});

const PORT = 3004;
app.listen(PORT, () => console.log(`🚀 Sistema AEE rodando na porta ${PORT}`));