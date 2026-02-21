const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const port = 3000;

// Configurações Iniciais
app.use(cors());
app.use(express.json());
app.use(express.static('frontend')); // Serve os arquivos da pasta frontend

// 1. Conexão com o Banco de Dados PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'email',
    password: 'SUA_SENHA_AQUI', // <--- COLOQUE SUA SENHA DO POSTGRES
    port: 5432,
});

// 2. Configuração do Multer (Upload de fotos)
const upload = multer({ storage: multer.memoryStorage() });

// 3. Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'seu-email@gmail.com', // <--- SEU E-MAIL
        pass: 'sua-senha-app'        // <--- SUA SENHA DE APP DO GMAIL
    }
});

// --- ROTAS DE CONTATOS ---

app.get('/api/contatos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contatos ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contatos', async (req, res) => {
    const { nome, email } = req.body;
    try {
        await pool.query('INSERT INTO contatos (nome, email) VALUES ($1, $2)', [nome, email]);
        res.status(201).send("Contato salvo!");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/contatos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;
    try {
        await pool.query('UPDATE contatos SET nome = $1, email = $2 WHERE id = $3', [nome, email, id]);
        res.send("Contato atualizado!");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contatos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM contatos WHERE id = $1', [id]);
        res.send("Contato apagado!");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ROTA DE ENVIO DE E-MAIL (COM REGISTRO NO HISTÓRICO) ---

app.post('/api/email/enviar', upload.single('foto'), async (req, res) => {
    const { para, assunto, nome_contato } = req.body;
    const arquivo = req.file;

    if (!arquivo) return res.status(400).send("Nenhuma foto selecionada.");

    const mailOptions = {
        from: 'seu-email@gmail.com',
        to: para,
        subject: assunto || "Uma foto nova para você! 📸",
        text: `Olá! Segue em anexo a foto enviada pelo aplicativo.`,
        attachments: [{
            filename: arquivo.originalname,
            content: arquivo.buffer
        }]
    };

    try {
        // 1. Envia o e-mail
        await transporter.sendMail(mailOptions);

        // 2. REGISTRA NO HISTÓRICO (A linha que você precisava)
        const sqlHistorico = `
            INSERT INTO historico (contato_nome, contato_email, arquivo_nome, arquivo_tipo) 
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(sqlHistorico, [nome_contato, para, arquivo.originalname, arquivo.mimetype]);

        res.status(200).send("E-mail enviado e registrado no histórico!");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao enviar e-mail.");
    }
});

// --- ROTA PARA BUSCAR O HISTÓRICO ---

app.get('/api/historico', async (req, res) => {
    try {
        // Busca do mais novo para o mais antigo
        const result = await pool.query('SELECT * FROM historico ORDER BY data_hora DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar histórico." });
    }
});

// Iniciar Servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});