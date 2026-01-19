const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// Entrada em massa de Patrimônio
router.post('/patrimonio/massa', verificarToken, verificarPerfil(['admin']), async (req, res) => {
    const { produto_id, local_id, setor_id, series } = req.body;
    try {
        await db.query('BEGIN');
        for (let serie of series) {
            await db.query(
                'INSERT INTO patrimonios (produto_id, numero_serie, local_id, setor_id, status) VALUES ($1, $2, $3, $4, $5)',
                [produto_id, serie.toUpperCase(), local_id, setor_id, 'ESTOQUE']
            );
        }
        await db.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2', [series.length, produto_id]);
        await db.query('COMMIT');
        res.json({ message: 'Patrimônios cadastrados com sucesso' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Listar estoque com alertas de nível baixo (para MATERIAL)
router.get('/central', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.nome as categoria_nome,
            (p.tipo = 'MATERIAL' AND p.quantidade_estoque <= p.alerta_minimo) as alerta_baixo
            FROM produtos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.nome ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: Abastecer estoque de uniformes por grade
router.post('/abastecer-uniforme', verificarToken, verificarPerfil(['admin', 'estoque', 'super']), async (req, res) => {
    const { produto_id, itens } = req.body; // itens: [{ tamanho: 'P', quantidade: 10 }, ...]

    if (!produto_id || !itens || !Array.isArray(itens)) {
        return res.status(400).json({ error: "DADOS INCOMPLETOS" });
    }

    try {
        await db.query('BEGIN');

        let totalAdicionado = 0;

        for (const item of itens) {
            const { tamanho, quantidade } = item;
            if (quantidade <= 0) continue;

            // Incrementa ou cria o registro do tamanho específico
            await db.query(`
                INSERT INTO estoque_grades (produto_id, tamanho, quantidade)
                VALUES ($1, $2, $3)
                ON CONFLICT (produto_id, tamanho) 
                DO UPDATE SET quantidade = estoque_grades.quantidade + $3
            `, [produto_id, tamanho.toUpperCase(), quantidade]);

            totalAdicionado += quantidade;
        }

        // Atualiza o saldo geral na tabela de produtos
        await db.query(
            "UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2",
            [totalAdicionado, produto_id]
        );

        await db.query('COMMIT');
        res.json({ message: "ESTOQUE ATUALIZADO COM SUCESSO!", total: totalAdicionado });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "ERRO AO PROCESSAR ENTRADA: " + err.message });
    }
});

// ROTA: Buscar saldo detalhado de uniformes por tamanho
router.get('/grade-uniformes', verificarToken, verificarPerfil(['admin', 'estoque', 'super', 'logistica']), async (req, res) => {
    try {
        const query = `
            SELECT 
                p.nome as produto_nome, 
                eg.tamanho, 
                eg.quantidade
            FROM estoque_grades eg
            JOIN produtos p ON eg.produto_id = p.id
            WHERE p.tipo = 'UNIFORMES'
            ORDER BY p.nome, eg.tamanho;
        `;
        const result = await db.query(query);
        
        // Organiza os dados para facilitar a montagem da grade no frontend
        const estoqueAgrupado = {};
        result.rows.forEach(row => {
            if (!estoqueAgrupado[row.produto_nome]) {
                estoqueAgrupado[row.produto_nome] = {};
            }
            estoqueAgrupado[row.produto_nome][row.tamanho] = row.quantidade;
        });

        res.json(estoqueAgrupado);
    } catch (err) {
        res.status(500).json({ error: "ERRO AO BUSCAR GRADE DE ESTOQUE: " + err.message });
    }
});

module.exports = router;