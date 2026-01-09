const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// Listar Locais e Setores
router.get('/locais', verificarToken, async (req, res) => {
    const result = await db.query('SELECT * FROM locais ORDER BY nome');
    res.json(result.rows);
});

router.get('/setores', verificarToken, async (req, res) => {
    const result = await db.query('SELECT * FROM setores ORDER BY nome');
    res.json(result.rows);
});

// Cadastro de Produtos (Admin)
router.post('/produtos', verificarToken, verificarPerfil(['admin']), async (req, res) => {
    const { nome, tipo, categoria_id, alerta_minimo } = req.body;
    try {
        await db.query(
            'INSERT INTO produtos (nome, tipo, categoria_id, alerta_minimo) VALUES ($1, $2, $3, $4)',
            [nome.toUpperCase(), tipo, categoria_id, alerta_minimo || 0]
        );
        res.json({ message: 'PRODUTO CADASTRADO' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar itens de patrimônio disponíveis por produto
router.get('/patrimonios/disponiveis/:produtoId', verificarToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, numero_serie FROM patrimonios 
             WHERE produto_id = $1 AND status = 'DISPONIVEL' 
             ORDER BY numero_serie ASC`,
            [req.params.produtoId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "ERRO AO BUSCAR PLAQUETAS: " + err.message });
    }
});

// Rota para Inventário Atual (Posição de Estoque por Local)
router.get('/relatorios/inventario-atual', verificarToken, async (req, res) => {
    try {
        // Esta query une o saldo de produtos (estoque central) 
        // com a contagem de patrimônios distribuídos por locais
        const query = `
            -- Parte 1: Produtos em Estoque Central (Consumíveis)
            SELECT 
                'ESTOQUE CENTRAL' as local_nome,
                p.nome as produto,
                p.tipo,
                p.quantidade_estoque as quantidade,
                'N/A' as detalhes
            FROM produtos p
            WHERE p.quantidade_estoque > 0 AND p.tipo != 'PATRIMONIO'

            UNION ALL

            -- Parte 2: Patrimônios por Local (Contagem Unitária)
            SELECT 
                l.nome as local_nome,
                prod.nome as produto,
                'PATRIMONIO' as tipo,
                COUNT(*) as quantidade,
                string_agg(pat.numero_serie, ', ') as detalhes
            FROM patrimonios pat
            JOIN produtos prod ON pat.produto_id = prod.id
            JOIN locais l ON pat.local_id = l.id
            GROUP BY l.nome, prod.nome, prod.tipo

            ORDER BY local_nome, produto;
        `;

        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "ERRO AO GERAR INVENTÁRIO: " + err.message });
    }
});

// Rota para buscar materiais com estoque baixo
router.get('/relatorios/estoque-baixo-material', verificarToken, async (req, res) => {
    try {
        const limiteCritico = 10; // Você pode alterar este valor conforme a necessidade
        const query = `
            SELECT 
                nome, 
                quantidade_estoque, 
                CASE 
                    WHEN quantidade_estoque <= 0 THEN 'ESGOTADO'
                    WHEN quantidade_estoque <= 5 THEN 'CRÍTICO'
                    ELSE 'BAIXO'
                END as status_estoque
            FROM produtos 
            WHERE tipo = 'MATERIAL' 
              AND quantidade_estoque < $1
            ORDER BY quantidade_estoque ASC;
        `;
        const result = await db.query(query, [limiteCritico]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "ERRO AO BUSCAR ESTOQUE BAIXO: " + err.message });
    }
});

// Rota para buscar produtos por nome de categoria
router.get('/produtos/categoria/:nomeCategoria', verificarToken, async (req, res) => {
    const { nomeCategoria } = req.params;
    try {
        const query = `
            SELECT p.*, c.nome as categoria_nome 
            FROM produtos p
            JOIN categorias c ON p.categoria_id = c.id
            WHERE c.nome = $1
            ORDER BY p.nome
        `;
        const result = await db.query(query, [nomeCategoria.toUpperCase()]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "ERRO AO BUSCAR PRODUTOS: " + err.message });
    }
});

module.exports = router;