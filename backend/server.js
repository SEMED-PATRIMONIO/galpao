const express = require('express');
const router = express.Router();
const cors = require('cors');
const db = require('./db');
const { verificarToken } = require('./auth/auth.middleware');

// Importação das rotas externas
const authRoutes = require('./auth/auth.routes');
const catalogoRoutes = require('./routes/catalogo.routes');
const pedidosRoutes = require('./routes/pedidos.routes');
const estoqueRoutes = require('./routes/estoque.routes');
const historicoRoutes = require('./routes/historico.routes');
const cadastrosRoutes = require('./routes/cadastros.routes');

const app = express();
app.use(cors());
app.use(express.json());

// Middlewares e Rotas Principais
app.use('/auth', authRoutes);
app.use('/catalogo', catalogoRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/estoque', estoqueRoutes);
app.use('/historico', historicoRoutes);
app.use('/api/cadastros', cadastrosRoutes);

// ============================================================
// NOVAS ROTAS PARA SOLICITAÇÃO DE UNIFORMES (PERFIL ESCOLA)
// ============================================================
// Rota para entrada de estoque por tamanho (Exclusivo Uniformes)
// Rota para entrada de estoque por tamanho (Exclusivo Uniformes)
app.post('/estoque/entrada-uniforme', verificarToken, async (req, res) => {
    const { produto_id, grade } = req.body; // grade: [{tamanho: 'M', qtd: 50}, ...]
    try {
        await db.query('BEGIN');
        let totalEntrada = 0;

        for (const item of grade) {
            if (item.qtd > 0) {
                await db.query(
                    `UPDATE estoque_tamanhos SET quantidade = quantidade + $1 
                     WHERE produto_id = $2 AND tamanho = $3`,
                    [item.qtd, produto_id, item.tamanho]
                );
                totalEntrada += item.qtd;

                // Registrar no histórico de detalhes para auditoria
                await db.query(
                    `INSERT INTO historico_detalhes (produto_id, tamanho, quantidade, tipo_produto) 
                     VALUES ($1, $2, $3, 'ENTRADA')`,
                    [produto_id, item.tamanho, item.qtd]
                );
            }
        }

        // Registrar no histórico principal
        await db.query(
            `INSERT INTO historico (data, usuario_id, acao, quantidade_total) 
             VALUES (NOW(), $1, 'ABASTECIMENTO DE UNIFORMES', $2)`,
            [req.userId, totalEntrada]
        );

        await db.query('COMMIT');
        res.json({ message: "ESTOQUE ATUALIZADO" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});
// 1. Rota para a Escola gravar a solicitação

// 2. Rota para listar histórico de solicitações das escolas
app.get('/historico/escolas', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                h.id, h.data, h.quantidade_total,
                u.nome as usuario_nome,
                l.nome as escola_nome
            FROM historico h
            JOIN usuarios u ON h.usuario_id = u.id
            JOIN locais l ON h.local_id = l.id
            WHERE h.acao = 'SOLICITACAO_DE_UNIFORME'
            ORDER BY h.data DESC`;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Rota para detalhes (Duplo Clique)
app.get('/historico/:id/detalhes', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT p.nome as produto, hd.tamanho, hd.quantidade
            FROM historico_detalhes hd
            JOIN produtos p ON hd.produto_id = p.id
            WHERE hd.historico_id = $1`;
        const result = await db.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================

// --- ROTA PARA ENTRADA DE ESTOQUE (UNIFORMES E MATERIAIS) ---
app.post('/estoque/entrada', verificarToken, async (req, res) => {
    if (['escola', 'logistica'].includes(req.perfil.toLowerCase())) {
        return res.status(403).json({ error: "PERMISSÃO NEGADA PARA ESTE PERFIL" });
    }
    const { acao, itens, total, observacoes } = req.body;
    try {
        await db.query('BEGIN');
        const histRes = await db.query(
            "INSERT INTO historico (usuario_id, acao, tipo_historico, quantidade_total, observacoes) VALUES ($1, $2, 'ENTRADA', $3, $4) RETURNING id",
            [req.usuarioId, acao, total, observacoes]
        );
        const historicoId = histRes.rows[0].id;
        for (const item of itens) {
            const prodRes = await db.query("SELECT id, tipo FROM produtos WHERE nome = $1", [item.produto]);
            const produtoId = prodRes.rows[0].id;
            const tipoProduto = prodRes.rows[0].tipo;
            await db.query(
                "INSERT INTO historico_detalhes (historico_id, produto_id, tamanho, quantidade, tipo_produto) VALUES ($1, $2, $3, $4, $5)",
                [historicoId, produtoId, item.tamanho, item.quantidade, tipoProduto]
            );
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2",
                [item.quantidade, produtoId]
            );
        }
        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// --- ROTA PARA LISTAR PRODUTOS ---
app.get('/produtos', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM produtos ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rota para Admin: Solicitações aguardando aprovação
app.get('/api/alertas/admin/pendentes', verificarToken, async (req, res) => {
    try {
        // Atualizado para buscar o novo status que as escolas geram
        const result = await db.query("SELECT COUNT(*) FROM pedidos WHERE status = 'AGUARDANDO_AUTORIZACAO'");
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rota para Estoque: Pedidos aprovados aguardando separação
app.get('/api/alertas/estoque/aprovados', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT COUNT(*) FROM pedidos WHERE status = 'APROVADO'");
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rota para Logística: Pedidos aguardando coleta
app.get('/api/alertas/logistica/coleta', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT COUNT(*) FROM pedidos WHERE status = 'AGUARDANDO COLETA'");
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const path = require('path');
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Rota unificada para Alertas de Logística (Entrega + Devolução)
app.get('/api/alertas/logistica/geral', verificarToken, async (req, res) => {
    try {
        // Conta entregas prontas E devoluções autorizadas
        const result = await db.query(`
            SELECT COUNT(*) FROM pedidos 
            WHERE status IN ('COLETA_LIBERADA', 'DEVOLUCAO_AUTORIZADA')
        `);
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// Adicione esta rota ao seu arquivo de pedidos
router.get('/alertas/devolucoes', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT status, COUNT(*) as total 
            FROM pedidos 
            WHERE tipo_pedido = 'DEVOLUCAO' 
            AND status IN ('DEVOLUCAO_PENDENTE', 'DEVOLUCAO_AUTORIZADA', 'DEVOLUCAO_EM_TRANSITO')
            GROUP BY status`;
        
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em https://patrimoniosemed.paiva.api.br:${PORT}`);
});
