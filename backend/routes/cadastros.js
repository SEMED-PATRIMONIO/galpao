const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');
// Rota para buscar categorias (usado nos selects do frontend)
router.get('/categorias', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categorias ORDER BY nome');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota genérica para tabelas simples (categorias, locais, setores)
router.post('/basico/:tabela', async (req, res) => {
    const { tabela } = req.params;
    const { nome } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO ${tabela} (nome) VALUES ($1) RETURNING *`,
            [nome.toUpperCase()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cadastro de Produtos com lógica de Grade de Uniformes
router.post('/produtos', async (req, res) => {
    const { nome, tipo, categoria_id, quantidade_estoque, alerta_minimo } = req.body;
    
    try {
        if (tipo === 'UNIFORMES') {
            let grade = [];
            const nomeUpper = nome.toUpperCase();
            
            // Define a grade baseada no nome
            if (nomeUpper.includes('TENIS')) {
                grade = ["22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43"];
            } else {
                grade = ["2", "4", "6", "8", "10", "12", "14", "16", "PP", "P", "M", "G", "GG", "XGG"];
            }

            // Insere um registro para cada tamanho da grade
            const queries = grade.map(tamanho => {
                return db.query(
                    `INSERT INTO produtos (nome, tipo, categoria_id, quantidade_estoque, alerta_minimo) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [`${nomeUpper} - TAM ${tamanho}`, tipo, categoria_id, quantidade_estoque, null]
                );
            });
            await Promise.all(queries);
            res.status(201).json({ message: "Grade de uniformes cadastrada com sucesso." });
        } else {
            // Cadastro simples para MATERIAL
            const result = await db.query(
                `INSERT INTO produtos (nome, tipo, categoria_id, quantidade_estoque, alerta_minimo) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [nome.toUpperCase(), tipo, categoria_id, quantidade_estoque, alerta_minimo]
            );
            res.status(201).json(result.rows[0]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para cadastrar patrimônio em lote
router.post('/patrimonio', verificarToken, async (req, res) => {
    const { produto_id, local_id, nota_fiscal, numeros_serie } = req.body;

    if (!produto_id || !local_id || !nota_fiscal || !numeros_serie || !Array.isArray(numeros_serie)) {
        return res.status(400).json({ error: "DADOS INCOMPLETOS PARA CADASTRO EM LOTE" });
    }

    try {
        await db.query('BEGIN');

        for (const serie of numeros_serie) {
            await db.query(
                `INSERT INTO patrimonios (produto_id, local_id, numero_serie, nota_fiscal, status) 
                 VALUES ($1, $2, $3, $4, 'DISPONIVEL')`,
                [produto_id, local_id, serie, nota_fiscal]
            );

            // Incrementa o estoque do produto automaticamente
            await db.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque + 1 WHERE id = $1`,
                [produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ message: `${numeros_serie.length} ITENS CADASTRADOS COM SUCESSO` });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "ERRO AO CADASTRAR PATRIMÔNIO: " + err.message });
    }
});

module.exports = router;