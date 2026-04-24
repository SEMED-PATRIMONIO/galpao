require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// Conexão com o banco (somente leitura é o ideal)
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

// Serve a pasta 'public' onde está o index.html e os assets
app.use(express.static(path.join(__dirname, 'public')));

// Rota pública para buscar a remessa sem precisar de Token
app.get('/api/validar/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                r.id AS remessa_id,
                p.id AS pedido_id,
                p.data_saida,
                COALESCE(l.nome_oficial, l.nome, 'Local não identificado') AS destino_final,
                u_origem.nome AS solicitante,
                u_autoriza.nome AS quem_autorizou
            FROM pedido_remessas r
            JOIN pedidos p ON r.pedido_id = p.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            LEFT JOIN usuarios u_origem ON p.usuario_origem_id = u_origem.id
            LEFT JOIN usuarios u_autoriza ON p.autorizado_por = u_autoriza.id
            WHERE r.id = $1;
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Documento não encontrado ou inválido." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro na validação:', err);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`Validador rodando na porta ${PORT}`));