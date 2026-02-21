const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const multer = require('multer');

// Configuração para salvar temporariamente o arquivo no servidor
const upload = multer({ dest: 'uploads/' });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

router.post('/enviar', upload.single('foto'), async (req, res) => {
    const { para, assunto } = req.body;
    const arquivo = req.file; // O arquivo enviado via upload

    if (!arquivo) {
        return res.status(400).json({ error: "Nenhuma imagem foi selecionada." });
    }

    const mailOptions = {
        from: '"Minhas Fotos 📸" <seu-email@gmail.com>',
        to: para,
        subject: assunto || "Uma foto especial para você!",
        text: "Olá! Veja esta foto linda que tirei e estou enviando para você.",
        attachments: [
            {
                filename: arquivo.originalname,
                path: arquivo.path // O Nodemailer lê o arquivo direto do disco
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "E-mail enviado com sucesso! 🎉" });
    } catch (error) {
        console.error("Erro no envio:", error);
        res.status(500).json({ error: "Erro ao enviar o e-mail." });
    }
});

module.exports = router;