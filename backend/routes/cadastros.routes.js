const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// Entrada em massa de Patrimônio
router.post('/patrimonio/massa', verificarToken, verificarPerfil(['admin', 'estoque']), async (req, res) => {
    const { produto_id, series } = req.body; // 'series' é um array de strings
    const LOCAL_CENTRAL_ID = 1; // ID referente ao 'ESTOQUE CENTRAL' no seu banco

    try {
        await db.query('BEGIN');

        for (let serie of series) {
            // Inserção individual de cada item de patrimônio
            await db.query(
                `INSERT INTO patrimonios (produto_id, numero_serie, local_id, status) 
                 VALUES ($1, $2, $3, 'ESTOQUE')`,
                [produto_id, serie.trim().toUpperCase(), LOCAL_CENTRAL_ID]
            );
        }

        // Atualiza a quantidade total no cadastro do produto
        await db.query(
            'UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2',
            [series.length, produto_id]
        );

        // Registro no Histórico Log
        await db.query(
            "INSERT INTO historico (usuario_id, acao, tipo_historico) VALUES ($1, $2, 'PRINCIPAL')",
            [req.userId, `ENTRADA DE ${series.length} ITENS DE PATRIMÔNIO NO ESTOQUE CENTRAL`]
        );

        await db.query('COMMIT');
        res.json({ message: 'PATRIMÔNIOS CADASTRADOS E ESTOQUE ATUALIZADO!' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "ERRO AO PROCESSAR PATRIMÔNIO: " + err.message });
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

// Rota para transferir um item de patrimônio específico
router.post('/patrimonio/transferir', verificarToken, verificarPerfil(['admin', 'logistica']), async (req, res) => {
    const { patrimonio_id, local_destino_id } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Busca dados atuais do patrimônio para o log
        const patrimonio = await db.query(
            "SELECT p.numero_serie, l.nome as local_atual FROM patrimonios p JOIN locais l ON p.local_id = l.id WHERE p.id = $1",
            [patrimonio_id]
        );

        if (patrimonio.rowCount === 0) throw new Error("PATRIMÔNIO NÃO ENCONTRADO.");

        // 2. Atualiza o local do patrimônio
        await db.query(
            "UPDATE patrimonios SET local_id = $1, status = 'ALOCADO' WHERE id = $2",
            [local_destino_id, patrimonio_id]
        );

        // 3. Registra a movimentação no Histórico
        const localDestino = await db.query("SELECT nome FROM locais WHERE id = $1", [local_destino_id]);
        
        await db.query(
            "INSERT INTO historico (usuario_id, acao, tipo_historico) VALUES ($1, $2, 'PRINCIPAL')",
            [req.userId, `TRANSFERIU PATRIMÔNIO ${patrimonio.rows[0].numero_serie} DE ${patrimonio.rows[0].local_atual} PARA ${localDestino.rows[0].nome}`]
        );

        await db.query('COMMIT');
        res.json({ message: "TRANSFERÊNCIA CONCLUÍDA COM SUCESSO!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;