require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('/var/www/admsemed'));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT || 5432,
});

// LOGIN
app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await pool.query(
            "SELECT id, usuario FROM public.usuarios WHERE usuario = $1 AND senha = $2 AND status = 'A'", 
            [usuario, senha]
        );
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(401).json({ error: "Credenciais Inválidas" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// LISTAGEM DE ITENS (ESTOQUE)
// LISTAR ITENS
app.get('/api/item', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, item, quantidade, alerta, status 
            FROM public.item 
            WHERE status = 'A' OR status IS NULL 
            ORDER BY item ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOCAIS (Usando 'AS nome' para o frontend entender)
app.get('/api/local', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, local as nome FROM public.local ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CATEGORIAS (Corrigido para usar a coluna 'categoria')
app.get('/api/categoria', async (req, res) => {
    try {
        // Selecionamos nome_categoria (onde está o texto) e apelidamos de 'categoria'
        const result = await pool.query("SELECT id, nome_categoria AS categoria FROM public.categoria WHERE status = 'A' ORDER BY nome_categoria ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ROTA: AJUSTE DE ESTOQUE (INVENTÁRIO)
app.patch('/api/item/:id/ajuste-estoque', async (req, res) => {
    const { id } = req.params;
    const { novaQuantidade } = req.body;
    try {
        await pool.query('BEGIN');
        const itemRes = await pool.query("SELECT item, quantidade FROM public.item WHERE id = $1", [id]);
        const { item, quantidade: saldoAnterior } = itemRes.rows[0];
        const diferenca = novaQuantidade - saldoAnterior;

        if (diferenca === 0) return res.status(400).json({ error: "Saldo idêntico." });

        const tagAuditoria = diferenca < 0 ? 'AUDIT_RED' : 'AUDIT_BLUE';

        await pool.query("UPDATE public.item SET quantidade = $1 WHERE id = $2", [novaQuantidade, id]);
        await pool.query(
            "INSERT INTO public.historico (nome_item, tipo, quant, data, destino) VALUES ($1, 'DIFERENÇA INVENTÁRIO', $2, NOW(), $3)",
            [item, Math.abs(diferenca), tagAuditoria]
        );

        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// INATIVAR ITEM (LIXEIRA)
app.patch('/api/item/:id/inativar', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            "UPDATE public.item SET status = 'I' WHERE id = $1",
            [id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao inativar item:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// HISTÓRICO (Com suporte a múltiplas colunas e unificação)
app.get('/api/historico', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, 
                COALESCE(data, data_movimentacao, NOW()) as data, 
                COALESCE(nome_item, 'Item') as nome_item, 
                COALESCE(tipo, tipo_movimento, 'N/D') as tipo, 
                COALESCE(quant, quantidade_movimentada, 0) as quant, 
                COALESCE(usuario, usuario_responsavel_nome, 'Sistema') as usuario, 
                COALESCE(destino, local_destino, '-') as destino, 
                num_nota
            FROM public.historico 
            ORDER BY data DESC LIMIT 300
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ACERTO DE SALDO (Gera registro de AJUSTE)
app.post('/api/item/atualizar-saldo', async (req, res) => {
    const { id, valor, responsavel } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query("SELECT item FROM public.item WHERE id = $1", [id]);
        const nomeItem = itemRes.rows[0].item;
        await client.query('UPDATE public.item SET quantidade = $1 WHERE id = $2', [valor, id]);
        await client.query(
            "INSERT INTO public.historico (data, nome_item, tipo, quant, usuario, destino) VALUES (NOW(), $1, 'AJUSTE', $2, $3, 'ACERTO MANUAL')",
            [nomeItem, valor, responsavel]
        );
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

// MOVIMENTAÇÃO (ENTRADA/SAÍDA)
app.post('/api/movimentacao', async (req, res) => {
    const { item_id, tipo, quantidade, responsavel, destino_nome, num_nota } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query('SELECT item, quantidade FROM public.item WHERE id = $1', [item_id]);
        const item = itemRes.rows[0];
        let q = parseInt(quantidade);
        let novoSaldo = (tipo === 'ENTRADA') ? parseInt(item.quantidade) + q : parseInt(item.quantidade) - q;
        if (novoSaldo < 0) throw new Error("Saldo insuficiente!");
        
        await client.query('UPDATE public.item SET quantidade = $1 WHERE id = $2', [novoSaldo, item_id]);
        await client.query(
            "INSERT INTO public.historico (data, nome_item, tipo, quant, usuario, destino, num_nota) VALUES (NOW(), $1, $2, $3, $4, $5, $6)", 
            [item.item, tipo, q, responsavel, destino_nome, num_nota]
        );
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ error: err.message }); } finally { client.release(); }
});

app.post('/api/item/atualizar-alerta', async (req, res) => {
    try {
        await pool.query('UPDATE public.item SET alerta = $1 WHERE id = $2', [req.body.valor, req.body.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ALTERAR SENHA (Somente do próprio usuário)
app.post('/api/usuarios/alterar-senha', async (req, res) => {
    const { id, novaSenha } = req.body;
    await pool.query("UPDATE public.usuarios SET senha = $1 WHERE id = $2", [novaSenha, id]);
    res.json({ success: true });
});

// ROTA PARA PANORAMA MENSAL (ÚLTIMOS 12 MESES)
app.get('/api/item/giro/:nome', async (req, res) => {
    const { nome } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                TO_CHAR(data_ref, 'MM/YYYY') as mes,
                SUM(CASE WHEN tipo_ref = 'ENTRADA' THEN qtd_ref ELSE 0 END) as entradas,
                SUM(CASE WHEN tipo_ref = 'SAIDA' THEN qtd_ref ELSE 0 END) as saidas
            FROM (
                SELECT 
                    COALESCE(data, data_movimentacao) as data_ref, 
                    COALESCE(tipo, tipo_movimento) as tipo_ref, 
                    COALESCE(quant, quantidade_movimentada) as qtd_ref
                FROM public.historico
                WHERE nome_item = $1
            ) subquery
            WHERE data_ref >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY TO_CHAR(data_ref, 'YYYY-MM'), TO_CHAR(data_ref, 'MM/YYYY')
            ORDER BY TO_CHAR(data_ref, 'YYYY-MM') DESC
        `, [nome]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ROTA PARA CADASTRAR NOVO ITEM
// CADASTRAR NOVO ITEM (Tabela item)
app.post('/api/item', async (req, res) => {
    const { item, categoria_id, quantidade, alerta } = req.body;
    try {
        await pool.query('BEGIN');
        // O ID é gerado automaticamente pelo item_id_seq
        const itemRes = await pool.query(
            "INSERT INTO public.item (item, categoria_id, quantidade, alerta, status) VALUES ($1, $2, $3, $4, 'A') RETURNING id",
            [item.toUpperCase(), categoria_id, quantidade || 0, alerta || 5]
        );

        if (quantidade > 0) {
            await pool.query(
                "INSERT INTO public.historico (nome_item, tipo, quant, data, destino) VALUES ($1, 'ENTRADA', $2, NOW(), 'ESTOQUE INICIAL')",
                [item.toUpperCase(), quantidade]
            );
        }
        await pool.query('COMMIT');
        res.status(201).json({ success: true });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/item/:id/desativar', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "UPDATE public.item SET status = 'I' WHERE id = $1 RETURNING *", 
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Item não encontrado" });
        }
        
        res.json({ success: true, message: "Item desativado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3001, () => console.log('Servidor ADMSEMED Ativo na Porta 3001'));