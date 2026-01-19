const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// 1. ESCOLA: GRAVAR SOLICITAÇÃO (Sem baixar estoque)
router.post('/escola', verificarToken, async (req, res) => {
    const { itens } = req.body;
    try {
        await db.query('BEGIN');
        // Busca o local_id do usuário logado (usando coluna perfil)
        const user = await db.query('SELECT local_id, perfil FROM usuarios WHERE id = $1', [req.userId]);
        const local_id = user.rows[0].local_id;

        const pedido = await db.query(
            "INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, data_criacao) VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', NOW()) RETURNING id",
            [req.userId, local_id]
        );

        for (const item of itens) {
            await db.query(
                "INSERT INTO pedido_itens (pedido_id, produto_id, tamanho, quantidade_solicitada) VALUES ($1, $2, $3, $4)",
                [pedido.rows[0].id, item.produto_id, item.tamanho, item.quantidade]
            );
        }
        await db.query('COMMIT');
        res.status(201).json({ message: "SOLICITAÇÃO ENVIADA COM SUCESSO!", id: pedido.rows[0].id });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 2. ADMIN: PEDIDO DIRETO (Com baixa imediata e local selecionado)
router.post('/admin-direto', verificarToken, verificarPerfil(['admin', 'super']), async (req, res) => {
    const { itens, local_destino_id } = req.body;
    try {
        await db.query('BEGIN');

        // Validação de Estoque antes de baixar
        for (const item of itens) {
            const estoque = await db.query("SELECT quantidade FROM estoque_tamanhos WHERE produto_id = $1 AND tamanho = $2", [item.produto_id, item.tamanho]);
            if (!estoque.rows[0] || estoque.rows[0].quantidade < item.quantidade) {
                throw new Error(`ESTOQUE INSUFICIENTE PARA O ITEM ID ${item.produto_id} TAMANHO ${item.tamanho}`);
            }
        }

        const pedido = await db.query(
            "INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, data_criacao, data_autorizacao, autorizado_por) VALUES ($1, $2, 'AUTORIZADO_SEPARACAO', NOW(), NOW(), $1) RETURNING id",
            [req.userId, local_destino_id]
        );

        for (const item of itens) {
            // Baixa no estoque
            await db.query("UPDATE estoque_tamanhos SET quantidade = quantidade - $1 WHERE produto_id = $2 AND tamanho = $3", [item.quantidade, item.produto_id, item.tamanho]);
            // Grava o item
            await db.query("INSERT INTO pedido_itens (pedido_id, produto_id, tamanho, quantidade_solicitada, quantidade_atendida) VALUES ($1, $2, $3, $4, $4)",
                [pedido.rows[0].id, item.produto_id, item.tamanho, item.quantidade]);
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "PEDIDO DIRETO CRIADO E ESTOQUE BAIXADO!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

// 3. ADMIN: AUTORIZAR E BAIXAR ESTOQUE (Permite editar quantidades na hora)
router.post('/autorizar/:id', verificarToken, verificarPerfil(['admin', 'super']), async (req, res) => {
    const { itens_atualizados } = req.body; // Caso o admin tenha editado as quantidades na tela
    const pedidoId = req.params.id;

    try {
        await db.query('BEGIN');

        // 1. Atualiza os itens se o Admin editou
        if (itens_atualizados) {
            for (const item of itens_atualizados) {
                await db.query("UPDATE pedido_itens SET quantidade_solicitada = $1 WHERE pedido_id = $2 AND produto_id = $3 AND tamanho = $4",
                    [item.quantidade, pedidoId, item.produto_id, item.tamanho]);
            }
        }

        // 2. Valida e Baixa Estoque
        const itens = await db.query("SELECT * FROM pedido_itens WHERE pedido_id = $1", [pedidoId]);
        for (const item of itens.rows) {
            const estoque = await db.query("SELECT quantidade FROM estoque_tamanhos WHERE produto_id = $1 AND tamanho = $2", [item.produto_id, item.tamanho]);
            if (!estoque.rows[0] || estoque.rows[0].quantidade < item.quantidade_solicitada) {
                throw new Error(`ESTOQUE INSUFICIENTE PARA O ITEM ID ${item.produto_id} TAMANHO ${item.tamanho}`);
            }
            await db.query("UPDATE estoque_tamanhos SET quantidade = quantidade - $1 WHERE produto_id = $2 AND tamanho = $3", [item.quantidade_solicitada, item.produto_id, item.tamanho]);
        }

        // 3. Muda Status
        await db.query("UPDATE pedidos SET status = 'AUTORIZADO_SEPARACAO', autorizado_por = $1, data_autorizacao = NOW() WHERE id = $2", [req.userId, pedidoId]);

        await db.query('COMMIT');
        res.json({ message: "PEDIDO AUTORIZADO E ESTOQUE ATUALIZADO!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

// 4. ADMIN: RECUSAR (Apagar do Banco)
router.delete('/:id', verificarToken, verificarPerfil(['admin', 'super']), async (req, res) => {
    try {
        await db.query('BEGIN');
        await db.query("DELETE FROM pedido_itens WHERE pedido_id = $1", [req.params.id]);
        await db.query("DELETE FROM pedidos WHERE id = $1", [req.params.id]);
        await db.query('COMMIT');
        res.json({ message: "SOLICITAÇÃO RECUSADA E EXCLUÍDA." });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 5. ESTOQUE: INICIAR SEPARAÇÃO
router.post('/:id/iniciar-separacao', verificarToken, verificarPerfil(['estoque', 'admin']), async (req, res) => {
    try {
        await db.query("UPDATE pedidos SET status = 'SEPARACAO_INICIADA', usuario_separacao_id = $1, data_separacao = NOW() WHERE id = $2", [req.userId, req.params.id]);
        res.json({ message: "SEPARAÇÃO INICIADA!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. ROTA DE CONTAGEM PARA ALERTAS VISUAIS (Segundo plano)
router.get('/contagem/alertas', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'AGUARDANDO_AUTORIZACAO') as admin_pendente,
                COUNT(*) FILTER (WHERE status = 'AUTORIZADO_SEPARACAO') as estoque_pendente,
                COUNT(*) FILTER (WHERE status = 'COLETA_LIBERADA') as logistica_pendente,
                COUNT(*) FILTER (WHERE status = 'EM_TRANSPORTE' AND local_destino_id = (SELECT local_id FROM usuarios WHERE id = $1)) as escola_recebimento
            FROM pedidos
        `, [req.userId]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Listar todas as solicitações pendentes
router.get('/pendentes', verificarToken, verificarPerfil(['admin', 'super']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.data_criacao, u.nome as solicitante, l.nome as escola, p.status
            FROM pedidos p
            JOIN usuarios u ON p.usuario_origem_id = u.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'AGUARDANDO_AUTORIZACAO'
            ORDER BY p.data_criacao DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: Ver detalhes de uma solicitação específica
router.get('/:id/detalhes', verificarToken, async (req, res) => {
    try {
        const itens = await db.query(`
            SELECT pi.*, pr.nome as produto_nome
            FROM pedido_itens pi
            JOIN produtos pr ON pi.produto_id = pr.id
            WHERE pi.pedido_id = $1
        `, [req.params.id]);
        res.json(itens.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LISTAR PEDIDOS PARA O ESTOQUE (Tudo que já foi autorizado)
router.get('/fila-separacao', verificarToken, verificarPerfil(['estoque', 'admin', 'super']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.data_autorizacao, l.nome as escola, p.status, u.nome as quem_autorizou
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            JOIN usuarios u ON p.autorizado_por = u.id
            WHERE p.status IN ('AUTORIZADO_SEPARACAO', 'SEPARACAO_INICIADA')
            ORDER BY p.data_autorizacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ABASTECER ESTOQUE (Entrada de Carga) - Admin e Estoque
router.post('/abastecer', verificarToken, verificarPerfil(['admin', 'super', 'estoque']), async (req, res) => {
    const { produto_id, itens } = req.body; 
    try {
        await db.query('BEGIN');
        
        for (const item of itens) {
            // 1. Atualiza ou Insere na tabela de estoque por tamanho
            await db.query(
                `INSERT INTO estoque_tamanhos (produto_id, tamanho, quantidade) 
                 VALUES ($1, $2, $3)
                 ON CONFLICT (produto_id, tamanho) 
                 DO UPDATE SET quantidade = estoque_tamanhos.quantidade + $3`,
                [produto_id, item.tamanho, item.quantidade]
            );
        }

        // 2. Registrar no Histórico Geral
        await db.query(
            "INSERT INTO historico (data, usuario_id, acao, tipo_historico, observacoes) VALUES (NOW(), $1, $2, 'ENTRADA', $3)",
            [req.userId, 'ENTRADA DE UNIFORMES NO ESTOQUE', `Produto ID: ${produto_id}`]
        );

        await db.query('COMMIT');
        res.json({ message: "ESTOQUE ATUALIZADO COM SUCESSO!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ESTOQUE: Concluir Separação e Liberar para Coleta
router.post('/:id/concluir-separacao', verificarToken, verificarPerfil(['estoque', 'admin']), async (req, res) => {
    const { itens_conferidos, volumes } = req.body;
    const pedidoId = req.params.id;

    try {
        await db.query('BEGIN');

        for (const item of itens_conferidos) {
            // 1. Verificar se a quantidade conferida não ultrapassa a solicitada/autorizada
            const original = await db.query(
                "SELECT quantidade_solicitada FROM pedido_itens WHERE pedido_id = $1 AND produto_id = $2 AND tamanho = $3",
                [pedidoId, item.produto_id, item.tamanho]
            );

            const qtdAutorizada = original.rows[0].quantidade_solicitada;
            
            if (item.quantidade_conferida > qtdAutorizada) {
                throw new Error(`ERRO: QUANTIDADE ENVIADA (${item.quantidade_conferida}) MAIOR QUE A AUTORIZADA (${qtdAutorizada}) NO ITEM ID ${item.produto_id}`);
            }

            // 2. Atualiza a quantidade que está saindo nesta remessa
            // Aqui usamos a coluna quantidade_atendida para registrar o que está indo agora
            await db.query(
                "UPDATE pedido_itens SET quantidade_atendida = $1 WHERE pedido_id = $2 AND produto_id = $3 AND tamanho = $4",
                [item.quantidade_conferida, pedidoId, item.produto_id, item.tamanho]
            );
        }

        // 3. Atualiza volumes e muda status para COLETA_LIBERADA
        await db.query(
            "UPDATE pedidos SET status = 'COLETA_LIBERADA', volumes = $1, data_separacao = NOW() WHERE id = $2",
            [volumes, pedidoId]
        );

        await db.query('COMMIT');
        res.json({ message: "PEDIDO CONFERIDO E VOLUMES REGISTRADOS! AGUARDANDO COLETA DA LOGÍSTICA." });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

// LOGÍSTICA: Listar coletas pendentes
router.get('/fila-coleta', verificarToken, verificarPerfil(['logistica', 'admin', 'super']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.volumes, l.nome as escola, p.status, p.data_separacao
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'COLETA_LIBERADA'
            ORDER BY p.data_separacao ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOGÍSTICA: Confirmar Início de Transporte
router.post('/:id/iniciar-transporte', verificarToken, verificarPerfil(['logistica', 'admin']), async (req, res) => {
    try {
        await db.query(
            "UPDATE pedidos SET status = 'EM_TRANSPORTE', data_saida = NOW() WHERE id = $1",
            [req.params.id]
        );
        res.json({ message: "TRANSPORTE INICIADO! A ESCOLA FOI NOTIFICADA." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ESCOLA: Confirmar Recebimento (Finaliza o pedido)
router.post('/:id/confirmar-recebimento', verificarToken, async (req, res) => {
    try {
        await db.query(
            "UPDATE pedidos SET status = 'PEDIDO_ENTREGUE', data_recebimento = NOW() WHERE id = $1",
            [req.params.id]
        );
        res.json({ message: "RECEBIMENTO CONFIRMADO COM SUCESSO!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;