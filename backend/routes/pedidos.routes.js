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
        // 1. Busca dados do usuário com segurança
        const userRes = await db.query('SELECT local_id, perfil FROM usuarios WHERE id = $1', [req.userId]);
        
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const { local_id, perfil } = userRes.rows[0];

        // 2. Executa as contagens baseadas nos status exatos do seu banco
        // Ajuste os nomes dos status ('EM_TRANSPORTE', etc) se forem diferentes no seu SQL
        const queries = {
            admin: "SELECT COUNT(*) FROM pedidos WHERE status = 'AGUARDANDO_AUTORIZACAO'",
            estoque: "SELECT COUNT(*) FROM pedidos WHERE status = 'APROVADO'",
            logistica: "SELECT COUNT(*) FROM pedidos WHERE status = 'COLETA_LIBERADA'",
            escola: "SELECT COUNT(*) FROM pedidos WHERE status = 'EM_TRANSPORTE' AND local_destino_id = $1"
        };

        const [admin, estoque, logistica, escola] = await Promise.all([
            db.query(queries.admin),
            db.query(queries.estoque),
            db.query(queries.logistica),
            db.query(queries.escola, [local_id])
        ]);

        // 3. Retorna o objeto exatamente como o frontend espera
        res.json({
            admin_pendente: parseInt(admin.rows[0].count) || 0,
            estoque_pendente: parseInt(estoque.rows[0].count) || 0,
            logistica_pendente: parseInt(logistica.rows[0].count) || 0,
            escola_recebimento: parseInt(escola.rows[0].count) || 0
        });

    } catch (err) {
        console.error("ERRO CRÍTICO NA ROTA DE ALERTAS:", err.message);
        res.status(500).json({ error: "Erro interno ao processar contagem: " + err.message });
    }
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
// 1. ESTOQUE: Listar pedidos aguardando separação (ou parciais)
router.get('/fila-separacao', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT p.id, l.nome as escola, p.status, p.data_criacao
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status IN ('APROVADO', 'SEPARACAO_PARCIAL')
            ORDER BY p.data_criacao ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
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

// Listar todos os pedidos prontos para coleta (Entregas e Devoluções)
router.get('/fila-coleta-geral', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.volumes, l.nome as escola, p.status, p.data_criacao
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status IN ('COLETA_LIBERADA', 'DEVOLUCAO_AUTORIZADA')
            ORDER BY p.data_criacao ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
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

// Atualizar Status para Transporte (Funciona para ambos os tipos)
router.post('/:id/iniciar-transporte-geral', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Busca o status atual para saber qual será o próximo
        const pedido = await db.query("SELECT status FROM pedidos WHERE id = $1", [id]);
        if (pedido.rows.length === 0) return res.status(404).json({ error: "Pedido não encontrado" });

        const statusAtual = pedido.rows[0].status;
        let novoStatus = '';

        if (statusAtual === 'COLETA_LIBERADA') {
            novoStatus = 'EM_TRANSPORTE'; // Entrega indo para escola
        } else if (statusAtual === 'DEVOLUCAO_AUTORIZADA') {
            novoStatus = 'DEVOLUCAO_EM_TRANSITO'; // Devolução vindo para o estoque
        }

        await db.query(
            "UPDATE pedidos SET status = $1, data_saida = NOW() WHERE id = $2",
            [novoStatus, id]
        );

        res.json({ message: "STATUS ATUALIZADO: ITEM EM TRANSPORTE!", novoStatus });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
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

// 1. ESCOLA: Solicitar Devolução
// 1. ESCOLA solicita devolução
router.post('/devolucao/solicitar', verificarToken, async (req, res) => {
    const { itens } = req.body;
    try {
        await db.query('BEGIN');
        const user = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [req.userId]);
        
        const pedido = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
             VALUES ($1, $2, 'DEVOLUCAO_PENDENTE', 'DEVOLUCAO') RETURNING id`,
            [req.userId, user.rows[0].local_id]
        );

        for (const it of itens) {
            await db.query(
                "INSERT INTO pedido_itens (pedido_id, produto_id, tamanho, quantidade_solicitada) VALUES ($1, $2, $3, $4)",
                [pedido.rows[0].id, it.produto_id, it.tamanho, it.quantidade]
            );
        }
        await db.query('COMMIT');
        res.status(201).json({ success: true });
    } catch (err) { await db.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

// 2. ADMIN autoriza a devolução (Libera para a Logística coletar)
router.post('/devolucao/autorizar/:id', verificarToken, verificarPerfil(['admin']), async (req, res) => {
    try {
        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_AUTORIZADA' WHERE id = $1", [req.params.id]);
        res.json({ message: "COLETA DE DEVOLUÇÃO LIBERADA PARA LOGÍSTICA." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. LOGÍSTICA confirma a coleta na escola
router.post('/devolucao/coletar/:id', verificarToken, verificarPerfil(['logistica']), async (req, res) => {
    try {
        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_EM_TRANSITO' WHERE id = $1", [req.params.id]);
        res.json({ message: "PRODUTOS EM TRÂNSITO PARA O ESTOQUE CENTRAL." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. ESTOQUE recebe e FINALMENTE atualiza o saldo
router.post('/devolucao/receber/:id', verificarToken, verificarPerfil(['estoque', 'admin']), async (req, res) => {
    try {
        await db.query('BEGIN');
        
        // Busca os itens para dar entrada
        const { rows: itens } = await db.query(
            "SELECT produto_id, tamanho, quantidade_solicitada FROM pedido_itens WHERE pedido_id = $1",
            [req.params.id]
        );

        for (const it of itens) {
            // AUMENTA o saldo na grade
            await db.query(
                "UPDATE estoque_grades SET quantidade = quantidade + $1 WHERE produto_id = $2 AND tamanho = $3",
                [it.quantidade_solicitada, it.produto_id, it.tamanho]
            );
            // AUMENTA o saldo geral
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2",
                [it.quantidade_solicitada, it.produto_id]
            );
        }

        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_CONCLUIDA', data_entrega = NOW() WHERE id = $1", [req.params.id]);
        await db.query('COMMIT');
        res.json({ message: "DEVOLUÇÃO RECEBIDA E ESTOQUE ATUALIZADO!" });
    } catch (err) { await db.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

// 2. ADMIN: Autorizar Devolução (Não mexe no estoque ainda)
router.patch('/devolucao/autorizar/:id', verificarToken, verificarPerfil(['admin', 'super']), async (req, res) => {
    try {
        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_AUTORIZADA' WHERE id = $1", [req.params.id]);
        res.json({ message: "DEVOLUÇÃO AUTORIZADA PARA COLETA!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. LOGÍSTICA: Iniciar Transporte da Devolução (Escola -> Estoque)
router.post('/devolucao/iniciar-transporte/:id', verificarToken, verificarPerfil(['logistica', 'admin']), async (req, res) => {
    try {
        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_EM_TRANSITO' WHERE id = $1", [req.params.id]);
        res.json({ message: "TRANSPORTE DE DEVOLUÇÃO INICIADO! O ESTOQUE FOI NOTIFICADO." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. ESTOQUE: Confirmar Recebimento e INCREMENTAR SALDO
router.post('/devolucao/confirmar-recebimento/:id', verificarToken, verificarPerfil(['estoque', 'admin', 'super']), async (req, res) => {
    try {
        await db.query('BEGIN');
        
        // 1. Atualiza status do pedido
        await db.query("UPDATE pedidos SET status = 'DEVOLVIDO', data_entrega = NOW() WHERE id = $1", [req.params.id]);

        // 2. Busca itens da devolução
        const itens = await db.query("SELECT produto_id, quantidade_solicitada FROM pedido_itens WHERE pedido_id = $1", [req.params.id]);

        // 3. Incrementa o estoque central para cada item
        for (const item of itens.rows) {
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2",
                [item.quantidade_solicitada, item.produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ message: "DEVOLUÇÃO RECEBIDA E ESTOQUE INCREMENTADO COM SUCESSO!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 2. ESTOQUE: Buscar detalhes com saldo restante (Remessa Parcial)
router.get('/:id/detalhes-separacao', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                pi.produto_id, 
                p.nome as produto_nome, 
                pi.tamanho, 
                pi.quantidade_solicitada, 
                pi.quantidade_enviada,
                (pi.quantidade_solicitada - pi.quantidade_enviada) as saldo_pendente
            FROM pedido_itens pi
            JOIN produtos p ON pi.produto_id = p.id
            WHERE pi.pedido_id = $1 AND (pi.quantidade_solicitada - pi.quantidade_enviada) > 0
        `;
        const result = await db.query(query, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. ESTOQUE: Finalizar separação (Gera remessa e muda status para Logística)
router.post('/:id/finalizar-separacao', verificarToken, async (req, res) => {
    const { itens_separados, volumes } = req.body;
    try {
        await db.query('BEGIN');

        let totalPendenteRestante = 0;

        for (const item of itens_separados) {
            // 1. Atualiza a quantidade enviada no item do pedido
            await db.query(
                "UPDATE pedido_itens SET quantidade_enviada = quantidade_enviada + $1 WHERE pedido_id = $2 AND produto_id = $3 AND tamanho = $4",
                [item.qtd_nesta_remessa, req.params.id, item.produto_id, item.tamanho]
            );

            // 2. Baixa o estoque físico real
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2",
                [item.qtd_nesta_remessa, item.produto_id]
            );
        }

        // Verifica se ainda resta algo para enviar no pedido total
        const check = await db.query(
            "SELECT SUM(quantidade_solicitada - quantidade_enviada) as total FROM pedido_itens WHERE pedido_id = $1",
            [req.params.id]
        );
        totalPendenteRestante = parseInt(check.rows[0].total) || 0;

        // Muda status para a Logística coletar esta remessa
        // Se ainda houver pendência, marcamos como parcial, mas liberamos a coleta do que está pronto
        const novoStatus = totalPendenteRestante > 0 ? 'COLETA_LIBERADA' : 'COLETA_LIBERADA'; 
        // Nota: Ambos liberam coleta. A lógica de retorno ao estoque ocorre após a entrega da logística.

        await db.query(
            "UPDATE pedidos SET status = 'COLETA_LIBERADA', volumes = $1, data_separacao = NOW() WHERE id = $2",
            [volumes, req.params.id]
        );

        await db.query('COMMIT');
        res.json({ message: "REMESSA LIBERADA PARA LOGÍSTICA!", parcial: totalPendenteRestante > 0 });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Rota para buscar os produtos e os tamanhos disponíveis para cada um
// Rota para buscar os produtos e os tamanhos disponíveis para cada um
router.get('/uniformes/grades', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.nome, eg.tamanho
            FROM produtos p
            JOIN estoque_grades eg ON p.id = eg.produto_id
            WHERE p.tipo = 'UNIFORMES'
            ORDER BY p.nome, 
                     CASE 
                        WHEN eg.tamanho ~ '^[0-9]+$' THEN eg.tamanho::integer 
                        ELSE 999 
                     END, eg.tamanho;
        `;
        const { rows } = await db.query(query);
        
        // Agrupar por produto para facilitar o frontend
        const produtosComGrades = rows.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = { id: row.id, nome: row.nome, tamanhos: [] };
            }
            acc[row.id].tamanhos.push(row.tamanho);
            return acc;
        }, {});

        res.json(Object.values(produtosComGrades));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para liberar remessa (Total ou Parcial)
router.post('/liberar-remessa/:pedido_id', verificarToken, async (req, res) => {
    const { pedido_id } = req.params;
    const { volumes, itensRemessa } = req.body; // itensRemessa = [{id_item_pedido, qtd_enviada}]

    try {
        await db.query('BEGIN');

        for (const item of itensRemessa) {
            // 1. Atualiza a quantidade já enviada no pedido_itens
            await db.query(
                `UPDATE pedido_itens 
                 SET quantidade_enviada = quantidade_enviada + $1 
                 WHERE id = $2`, 
                [item.qtd_enviada, item.id_item_pedido]
            );

            // 2. Baixa o estoque real do produto/grade
            // A baixa ocorre aqui ou na autorização do Admin, conforme sua regra.
            // Se a baixa for na autorização, aqui apenas registramos a saída física.
        }

        // 3. Verifica se o pedido foi totalmente atendido
        const check = await db.query(
            `SELECT SUM(quantidade_solicitada - quantidade_enviada) as pendente 
             FROM pedido_itens WHERE pedido_id = $1`, [pedido_id]
        );

        const statusFinal = check.rows[0].pendente > 0 ? 'AGUARDANDO SEPARACAO' : 'EM TRANSPORTE';
        
        await db.query(
            "UPDATE pedidos SET status = $1, volumes = $2 WHERE id = $3",
            [statusFinal, volumes, pedido_id]
        );

        // 4. Log da Remessa
        await db.query(
            "INSERT INTO historico_log (pedido_id, acao, detalhe) VALUES ($1, 'REMESSA', $2)",
            [pedido_id, `Saída de ${volumes} volumes. Status: ${statusFinal}`]
        );

        await db.query('COMMIT');
        res.json({ message: "Remessa processada com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Rota para o Admin autorizar e baixar estoque
router.post('/admin/autorizar', verificarToken, verificarPerfil(['admin']), async (req, res) => {
    const { idPedido, acao, itensEditados } = req.body;

    try {
        await db.query('BEGIN');

        if (acao === 'RECUSADO') {
            await db.query("UPDATE pedidos SET status = 'RECUSADO', ativo = 0 WHERE id = $1", [idPedido]);
        } else {
            // 1. Aplicar edições do Admin nas quantidades solicitadas
            for (const item of itensEditados) {
                await db.query(
                    "UPDATE pedido_itens SET quantidade_solicitada = $1 WHERE id = $2 AND pedido_id = $3",
                    [item.quantidade, item.id_item, idPedido]
                );
            }

            // 2. Buscar itens atualizados para baixar estoque
            const { rows: itens } = await db.query(
                "SELECT produto_id, tamanho, quantidade_solicitada FROM pedido_itens WHERE pedido_id = $1 AND quantidade_solicitada > 0",
                [idPedido]
            );

            for (const it of itens) {

                // Exemplo de lógica de validação no momento da baixa
                const checkEstoque = await db.query(
                    "SELECT quantidade FROM estoque_grades WHERE produto_id = $1 AND tamanho = $2",
                    [item.produto_id, item.tamanho]
                );

                if (checkEstoque.rows[0].quantidade < item.quantidade_solicitada) {
                    throw new Error(`SALDO INSUFICIENTE: ${item.nome} TAMANHO ${item.tamanho}`);
                }
                // 3. Baixa na tabela de grades
                const resGrade = await db.query(
                    "UPDATE estoque_grades SET quantidade = quantidade - $1 WHERE produto_id = $2 AND tamanho = $3 RETURNING quantidade",
                    [it.quantidade_solicitada, it.produto_id, it.tamanho]
                );

                if (resGrade.rowCount === 0) throw new Error(`ERRO: PRODUTO ${it.produto_id} TAMANHO ${it.tamanho} NÃO ENCONTRADO.`);
                
                // 4. Baixa no total da tabela produtos
                await db.query(
                    "UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2",
                    [it.quantidade_solicitada, it.produto_id]
                );
            }

            await db.query("UPDATE pedidos SET status = 'PARA_SEPARACAO' WHERE id = $1", [idPedido]);
        }

        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/processar-remessa/:id', verificarToken, verificarPerfil(['estoque', 'admin']), async (req, res) => {
    const { volumes, itensRemessa } = req.body; // [{id_item, qtd_enviada}]
    const pedidoId = req.params.id;

    try {
        await db.query('BEGIN');

        for (const item of itensRemessa) {
            // Incrementa o que foi enviado nesta remessa específica
            await db.query(
                `UPDATE pedido_itens 
                 SET quantidade_enviada = quantidade_enviada + $1 
                 WHERE id = $2 AND pedido_id = $3`,
                [item.qtd_enviada, item.id_item, pedidoId]
            );
        }

        // Atualiza o pedido com a quantidade de volumes e muda status
        // Isso alerta o perfil 'logistica' que há carga pronta
        await db.query(
            `UPDATE pedidos SET 
                status = 'COLETA_LIBERADA', 
                volumes = $1, 
                data_separacao = NOW() 
             WHERE id = $2`,
            [volumes, pedidoId]
        );

        // Registro no Histórico Log de Remessas
        await db.query(
            "INSERT INTO historico (usuario_id, pedido_id, acao, tipo_historico) VALUES ($1, $2, $3, 'LOG')",
            [req.userId, pedidoId, `SEPARAÇÃO CONCLUÍDA: ${volumes} VOLUMES LIBERADOS PARA COLETA.`]
        );

        await db.query('COMMIT');
        res.json({ message: "REMESSA LIBERADA COM SUCESSO!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/escola/receber/:id', verificarToken, async (req, res) => {
    const pedidoId = req.params.id;

    try {
        await db.query('BEGIN');

        // 1. Verificar se o pedido foi totalmente atendido
        const { rows } = await db.query(
            `SELECT 
                SUM(quantidade_solicitada) as total_solicitado,
                SUM(quantidade_enviada) as total_enviado
             FROM pedido_itens 
             WHERE pedido_id = $1`, [pedidoId]
        );

        const { total_solicitado, total_enviado } = rows[0];
        
        // Se o que foi enviado é igual ao que foi solicitado, finaliza.
        // Se não, volta para 'AGUARDANDO SEPARACAO' para o estoque ver o que falta.
        const statusFinal = (total_enviado >= total_solicitado) ? 'ENTREGUE' : 'AGUARDANDO SEPARACAO';

        await db.query(
            "UPDATE pedidos SET status = $1, data_entrega = NOW() WHERE id = $2",
            [statusFinal, pedidoId]
        );

        // 2. Registrar no histórico log
        await db.query(
            "INSERT INTO historico (usuario_id, pedido_id, acao, tipo_historico) VALUES ($1, $2, $3, 'LOG')",
            [req.userId, pedidoId, `RECEBIMENTO CONFIRMADO PELA ESCOLA. STATUS: ${statusFinal}`]
        );

        await db.query('COMMIT');
        res.json({ statusFinal });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/logistica', verificarToken, verificarPerfil(['logistica', 'admin']), async (req, res) => {
    const { itens } = req.body;
    try {
        await db.query('BEGIN');
        
        // Obtém o local_id do utilizador de logística
        const user = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [req.userId]);
        const local_id = user.rows[0].local_id;

        const pedido = await db.query(
            "INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, data_criacao) VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', NOW()) RETURNING id",
            [req.userId, local_id]
        );

        for (const item of itens) {
            await db.query(
                "INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada) VALUES ($1, $2, $3)",
                [pedido.rows[0].id, item.produto_id, item.quantidade]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "PEDIDO DE MATERIAL REGISTADO." });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Adicione esta rota ao seu arquivo backend/routes/pedidos.routes.js
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

router.get('/relatorios/estatisticas', verificarToken, verificarPerfil(['admin']), async (req, res) => {
    try {
        // 1. Total de Uniformes entregues no mês atual
        const uniformesMes = await db.query(`
            SELECT SUM(pi.quantidade_enviada) as total 
            FROM pedido_itens pi 
            JOIN pedidos p ON pi.pedido_id = p.id 
            JOIN produtos pr ON pi.produto_id = pr.id 
            WHERE pr.tipo = 'UNIFORMES' 
            AND p.status = 'ENTREGUE' 
            AND p.data_entrega >= date_trunc('month', current_date)
        `);

        // 2. Ranking de Escolas (Mais pedidos de Materiais)
        const rankingEscolas = await db.query(`
            SELECT l.nome, COUNT(p.id) as total 
            FROM pedidos p 
            JOIN locais l ON p.local_destino_id = l.id 
            WHERE p.status != 'RECUSADO'
            GROUP BY l.nome 
            ORDER BY total DESC LIMIT 5
        `);

        // 3. Produtos com Stock Crítico
        const stockCritico = await db.query(`
            SELECT nome, quantidade_estoque, alerta_minimo 
            FROM produtos 
            WHERE (tipo = 'MATERIAL' AND quantidade_estoque <= alerta_minimo)
            OR (tipo = 'UNIFORMES' AND quantidade_estoque < 20)
            ORDER BY quantidade_estoque ASC LIMIT 10
        `);

        res.json({
            totalUniformes: uniformesMes.rows[0].total || 0,
            ranking: rankingEscolas.rows,
            criticos: stockCritico.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;