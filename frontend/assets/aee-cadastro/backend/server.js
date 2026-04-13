// /var/www/aee-cadastro/backend/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');     // Garanta que o ficheiro db.js está na mesma pasta
const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/crud');

const app = express();

// Configurações Globais
app.use(cors());
app.use(express.json());

// Registo das Rotas Modulares
// Mapeamos ambos os prefixos para o crudRoutes para garantir compatibilidade total
app.use('/api/auth', authRoutes);
app.use('/api/crud', crudRoutes);
app.use('/api/data', crudRoutes);

/**
 * Rota de alteração de senha (PATCH)
 * Utilizada pelo ChangePasswordModal no frontend.
 * Atualiza a tabela aee_usuarios_equipe com base no ID.
 */
app.patch('/api/usuarios/update-password/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;

    if (!senha) {
        return res.status(400).json({ error: "A nova senha deve ser fornecida." });
    }

    try {
        // Gerar o Hash da senha para segurança
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(senha, salt);
        
        // Atualiza a senha e marca que não é mais o primeiro acesso (se aplicável)
        const query = `
            UPDATE aee_usuarios_equipe 
            SET senha_hash = $1 
            WHERE id = $2 
            RETURNING id
        `;
        
        const result = await pool.query(query, [hash, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado." });
        }
        
        res.json({ message: "Senha atualizada com sucesso! 🛡️" });
    } catch (err) {
        console.error("Erro ao atualizar senha:", err.message);
        res.status(500).json({ error: "Erro interno ao processar a senha." });
    }
});

// Porta de execução
const PORT = 3004;
app.listen(PORT, () => {
    console.log(`
    🚀 Sistema AEE (Atendimento Educacional Especializado)
    📡 Backend operacional na porta ${PORT}
    📅 ${new Date().toLocaleString()}
    `);
});