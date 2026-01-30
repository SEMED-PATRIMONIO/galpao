const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');

// ALTERAR STATUS DO USUÁRIO (Ativar/Inativar)
router.patch('/usuarios/:id/status', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'ATIVO' ou 'INATIVO'
    try {
        await db.query("UPDATE usuarios SET status = $1 WHERE id = $2", [status, id]);
        res.json({ message: `Usuário ${status === 'ATIVO' ? 'ativado' : 'desativado'} com sucesso.` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/locais/lista-simples', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id, nome FROM locais ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/auth/quem-sou-eu', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.nome, u.perfil, u.local_id, l.nome as local_nome 
            FROM usuarios u 
            LEFT JOIN locais l ON u.local_id = l.id 
            WHERE u.id = $1`, [req.userId]);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: "Usuário não encontrado" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/:id/conferencia-itens', verificarToken, async (req, res) => {
    const pedidoId = req.params.id;
    try {
        const sql = `
            SELECT 
                ip.produto_id, 
                p.nome, 
                ip.tamanho, 
                ip.quantidade,
                COALESCE((
                    SELECT SUM(pri.quantidade_enviada) 
                    FROM pedido_remessa_itens pri
                    JOIN pedido_remessas pr ON pri.remessa_id = pr.id
                    WHERE pr.pedido_id = ip.pedido_id 
                    AND pri.produto_id = ip.produto_id 
                    AND pri.tamanho = ip.tamanho
                ), 0) as total_enviado
            FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id
            WHERE ip.pedido_id = $1
        `;
        const result = await db.query(sql, [pedidoId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/admin/lista', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.data_criacao, 
                p.status, 
                p.tipo_pedido,
                u.nome as solicitante,
                l.nome as nome_escola -- 👈 BUSCA O NOME REAL DA ESCOLA
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id -- 👈 O VÍNCULO QUE FALTAVA NA TELA
            ORDER BY p.data_criacao DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar: " + err.message });
    }
});

// ROTA 1: Para a função telaAdminVerPedidos (Lista Geral)
router.get('/pedidos/admin/lista-geral', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.data_criacao, p.status, p.tipo_pedido, 
                   u.nome as solicitante, l.nome as escola_destino
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id -- LEFT JOIN garante que a linha apareça
            ORDER BY p.data_criacao DESC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pedidos/admin/aguardando', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.data_criacao, u.nome as solicitante, l.nome as escola_destino
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'AGUARDANDO_AUTORIZACAO'
            ORDER BY p.data_criacao ASC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ROTA 2: Para a função telaAdminGerenciarSolicitacoes (Apenas Pendentes)
router.get('/pedidos/admin/pendentes', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.data_criacao, 
                u.nome as solicitante, 
                COALESCE(l.nome, '⚠️ LOCAL NÃO VINCULADO') as escola_nome
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'AGUARDANDO_AUTORIZACAO'
            ORDER BY p.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DETALHES DO PEDIDO VS ESTOQUE ATUAL
router.get('/pedidos/detalhes-estoque/:id', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                ip.id as item_id, pr.nome as produto, ip.tamanho, ip.quantidade as solicitado,
                COALESCE(eg.quantidade, 0) as em_estoque
            FROM itens_pedido ip
            JOIN produtos pr ON ip.produto_id = pr.id
            LEFT JOIN estoque_grades eg ON (ip.produto_id = eg.produto_id AND ip.tamanho = eg.tamanho)
            WHERE ip.pedido_id = $1`, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/pedidos/itens/atualizar', verificarToken, async (req, res) => {
    const { itens } = req.body; // Array de { item_id, nova_qtd }

    try {
        await db.query('BEGIN');

        for (const item of itens) {
            await db.query(
                "UPDATE itens_pedido SET quantidade = $1 WHERE id = $2",
                [item.nova_qtd, item.item_id]
            );
        }

        await db.query('COMMIT');
        res.json({ message: "Quantidades atualizadas com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro ao atualizar itens:", err.message);
        res.status(500).json({ error: "Erro ao atualizar quantidades." });
    }
});

router.post('/pedidos/admin/autorizar', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;
    const admin_id = req.userId;

    try {
        await db.query('BEGIN');

        // 1. Busca os itens para verificar e subtrair saldo
        const itens = await db.query(
            "SELECT produto_id, tamanho, quantidade FROM itens_pedido WHERE pedido_id = $1",
            [pedidoId]
        );

        for (const item of itens.rows) {
            // Subtrai do estoque apenas se houver saldo (segurança contra furos)
            const baixa = await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3 AND quantidade >= $1`,
                [item.quantidade, item.produto_id, item.tamanho]
            );

            if (baixa.rowCount === 0) {
                throw new Error(`Saldo insuficiente para o produto ${item.produto_id} tam ${item.tamanho}`);
            }
        }

        // 2. Atualiza o pedido: Status muda para 'AGUARDANDO_SEPARACAO'
        await db.query(
            `UPDATE pedidos 
            SET status = 'APROVADO', 
                autorizado_por = $1, 
                 data_autorizacao = NOW() 
            WHERE id = $2`,
            [admin_id, pedidoId]
        );

        await db.query('COMMIT');
        res.json({ message: "Pedido autorizado e enviado para a fila de separação!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/uniformes/criar', verificarToken, async (req, res) => {
    const { itens, operacao } = req.body;
    const usuario_id = req.userId;

    try {
        await db.query('BEGIN');

        // O SELECT dentro do INSERT garante que o local_id do usuário seja gravado no local_destino_id do pedido
        const pedidoRes = await db.query(
            `INSERT INTO pedidos (
                usuario_origem_id, 
                local_destino_id, 
                status, 
                tipo_pedido, 
                data_criacao
            ) VALUES (
                $1, 
                (SELECT local_id FROM usuarios WHERE id = $1), 
                'AGUARDANDO_AUTORIZACAO', 
                $2, 
                NOW()
            ) RETURNING id, local_destino_id`,
            [usuario_id, operacao]
        );

        const pedidoId = pedidoRes.rows[0].id;

        // Validação: Se o usuário não tiver local no cadastro, o banco retornará null e barramos aqui
        if (!pedidoRes.rows[0].local_destino_id) {
            throw new Error("Usuário sem unidade vinculada. Verifique o cadastro de usuários.");
        }

        for (const item of itens) {
            await db.query(
                "INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) VALUES ($1, $2, $3, $4)",
                [pedidoId, item.id, item.tamanho, item.quantidade]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "Solicitação enviada!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/produtos/lista-por-tipo', verificarToken, async (req, res) => {
    const { tipo } = req.query;
    try {
        const result = await db.query(
            "SELECT id, nome FROM produtos WHERE tipo = $1 ORDER BY nome ASC",
            [tipo]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/estoque/pendentes', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                l.nome as escola_nome, 
                p.status, 
                p.data_autorizacao,
                p.tipo_pedido
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            -- Adicionamos AGUARDANDO_SEPARACAO e APROVADO no filtro
            WHERE p.status IN ('APROVADO', 'AGUARDANDO_SEPARACAO', 'SEPARACAO_INICIADA', 'EM_SEPARACAO')
            ORDER BY 
                CASE 
                    WHEN p.status = 'EM_SEPARACAO' THEN 1 
                    WHEN p.status = 'SEPARACAO_INICIADA' THEN 2
                    WHEN p.status = 'AGUARDANDO_SEPARACAO' THEN 3
                    ELSE 4 
                END, 
                p.data_autorizacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao listar pedidos pendentes." });
    }
});

router.post('/pedidos/estoque/iniciar-separacao', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;
    try {
        await db.query('BEGIN');
        
        // 1. Pegamos o status atual antes de mudar
        const atual = await db.query("SELECT status FROM pedidos WHERE id = $1", [pedidoId]);
        const statusAnterior = atual.rows[0].status;

        // 2. Atualizamos para 'SEPARACAO_INICIADA'
        await db.query("UPDATE pedidos SET status = 'SEPARACAO_INICIADA' WHERE id = $1", [pedidoId]);

        // 3. GRAVAMOS NO LOG (O que faltava!)
        await db.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) 
             VALUES ($1, $2, $3, 'SEPARACAO_INICIADA', 'Usuário iniciou a conferência dos itens')`,
            [pedidoId, req.userId, statusAnterior]
        );

        await db.query('COMMIT');
        res.json({ message: "Iniciado com sucesso" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/lista-adm', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.data_criacao, 
                p.status, 
                p.tipo_pedido,
                u.nome as quem_pediu,
                l.nome as escola_destino
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            ORDER BY p.data_criacao DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/meus-pedidos', verificarToken, async (req, res) => {
    try {
        let query = "SELECT p.*, l.nome as escola_nome FROM pedidos p LEFT JOIN locais l ON p.local_destino_id = l.id";
        let params = [];

        // RESTRIÇÃO: Se for perfil escola, filtra pelo local_id dele
        if (req.userPerfil === 'escola') {
            query += " WHERE p.local_destino_id = $1";
            params.push(req.userLocalId); // Este ID vem do seu middleware de token
        }

        const result = await db.query(query + " ORDER BY p.data_criacao DESC", params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/usuarios/:id/status', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'ATIVO' ou 'INATIVO'
    try {
        await db.query("UPDATE usuarios SET status = $1 WHERE id = $2", [status, id]);
        res.json({ message: `Usuário ${status === 'ATIVO' ? 'ativado' : 'desativado'} com sucesso.` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 1. LISTAR USUÁRIOS (Corrigido: removido 'u.usuario' que não existe)
router.get('/usuarios/lista', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.nome, u.perfil, u.status, u.local_id, l.nome as local_nome 
            FROM usuarios u 
            LEFT JOIN locais l ON u.local_id = l.id 
            ORDER BY u.nome ASC
        `);
        res.json(result.rows);
    } catch (err) { 
        console.error("Erro na lista de usuários:", err.message);
        res.status(500).json({ error: "Erro interno no servidor" }); 
    }
});

// 2. ROTA SIMPLES PARA ALIMENTAR O DROPDOWN DE LOCAIS
router.get('/locais/dropdown', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id, nome FROM locais ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. CRIAR USUÁRIO (Ajustado para receber local_id)
router.post('/usuarios/criar', verificarToken, async (req, res) => {
    const { nome, senha, perfil, local_id, status } = req.body;
    try {
        await db.query(
            "INSERT INTO usuarios (nome, senha, perfil, local_id, status) VALUES ($1, $2, $3, $4, $5)",
            [nome, senha, perfil, local_id, status || 'ativo']
        );
        res.status(201).json({ message: "Usuário criado com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 1. ROTAS DE PEDIDOS / SOLICITAÇÕES
// ==========================================

// Listar pedidos pendentes (Admin)
router.get('/pedidos/aguardando-autorizacao', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, l.nome as escola_nome 
            FROM pedidos p 
            JOIN locais l ON p.local_destino_id = l.id 
            WHERE p.status = 'AGUARDANDO_AUTORIZACAO'
            ORDER BY p.data_criacao DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 1. Rota para ver os itens detalhados de um pedido
router.get('/pedidos/:id/itens', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT i.quantidade, i.tamanho, p.nome, p.tipo 
            FROM itens_pedido i 
            JOIN produtos p ON i.produto_id = p.id 
            WHERE i.pedido_id = $1`, 
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar itens do pedido." });
    }
});

// 2. Rota de Pedido Direto do Admin (Já nasce APROVADO)
router.post('/pedidos/admin/direto', verificarToken, async (req, res) => {
    const { local_destino_id, itens, tipo_pedido } = req.body;

    try {
        await db.query('BEGIN');

        // Note: status 'APROVADO' e preenchemos 'autorizado_por' com o ID do Admin
        const pedidoRes = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao, data_autorizacao, autorizado_por) 
             VALUES ($1, $2, 'APROVADO', $3, NOW(), NOW(), $1) RETURNING id`,
            [req.userId, local_destino_id, tipo_pedido]
        );

        const pedidoId = pedidoRes.rows[0].id;

        for (const item of itens) {
            await db.query(
                `INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, item.produto_id, item.tamanho, item.quantidade]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "Pedido Admin criado e autorizado!", id: pedidoId });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 1. Rota para atualizar a quantidade de um item antes da aprovação
router.put('/pedidos/itens/:itemId', verificarToken, async (req, res) => {
    const { quantidade } = req.body;
    const { itemId } = req.params;

    try {
        await db.query(
            "UPDATE itens_pedido SET quantidade = $1 WHERE id = $2",
            [quantidade, itemId]
        );
        res.json({ message: "Quantidade atualizada!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar item." });
    }
});

router.post('/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await db.query(
            "SELECT id, nome, perfil, local_id FROM usuarios WHERE usuario = $1 AND senha = $2",
            [usuario, senha]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Token de exemplo (use sua lógica atual de geração)
            const token = "TOKEN_" + user.id + "_" + Math.random().toString(36).substr(2);

            res.json({
                token: token,
                perfil: user.perfil,
                nome: user.nome,
                local_id: user.local_id // Retorna o ID da escola vinculada
            });
        } else {
            res.status(401).json({ message: "Usuário ou senha inválidos." });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Rota de Aprovação com Baixa no Estoque (Grade e Geral)
router.post('/pedidos/:id/aprovar', verificarToken, async (req, res) => {
    const pedidoId = req.params.id;
    try {
        await db.query('BEGIN');

        // Atualiza status do pedido
        await db.query("UPDATE pedidos SET status = 'APROVADO', autorizado_por = $1, data_autorizacao = NOW() WHERE id = $2", [req.userId, pedidoId]);

        // Busca itens para dar baixa
        const itens = await db.query(`
            SELECT i.produto_id, i.tamanho, i.quantidade, p.tipo 
            FROM itens_pedido i 
            JOIN produtos p ON i.produto_id = p.id 
            WHERE i.pedido_id = $1`, [pedidoId]);

        for (const item of itens.rows) {
            // Se for uniforme, retira da grade específica
            if (item.tipo === 'UNIFORMES') {
                await db.query(
                    "UPDATE estoque_grades SET quantidade = quantidade - $1 WHERE produto_id = $2 AND tamanho = $3",
                    [item.quantidade, item.produto_id, item.tamanho]
                );
            }
            
            // Retira do saldo geral no cadastro de produtos para todos os tipos
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2",
                [item.quantidade, item.produto_id]
            );
        }

        // Registrar Log
        await db.query(
            "INSERT INTO historico_log_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'APROVADO', 'Autorizado com baixa automática de estoque.')",
            [pedidoId, req.userId]
        );

        await db.query('COMMIT');
        res.json({ message: "Aprovado com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 1. Rota para buscar itens e o saldo real (considerando a grade de uniformes)
router.get('/pedidos/:id/itens-com-estoque', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                i.id as item_id,
                i.produto_id,
                i.quantidade as qtd_solicitada,
                i.tamanho,
                p.nome as produto_nome,
                p.tipo as produto_tipo,
                -- Lógica para buscar saldo na tabela correta
                CASE 
                    WHEN p.tipo = 'UNIFORMES' THEN 
                        COALESCE((SELECT quantidade FROM estoque_grades WHERE produto_id = i.produto_id AND tamanho = i.tamanho), 0)
                    ELSE 
                        COALESCE(p.quantidade_estoque, 0)
                END as saldo_atual
            FROM itens_pedido i
            JOIN produtos p ON i.produto_id = p.id
            WHERE i.pedido_id = $1`, 
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar itens e saldo." });
    }
});

router.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const userRes = await db.query(
            "SELECT id, nome, perfil, local_id FROM usuarios WHERE email = $1 AND senha = $2", 
            [email, senha]
        );

        if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            
            // Aqui você deve usar sua lógica de geração de token (JWT ou similar)
            // Por enquanto, usaremos um token de exemplo
            const token = "TOKEN_DE_SESSAO_GERADO_" + user.id; 

            res.json({ 
                auth: true, 
                token: token, 
                perfil: user.perfil, 
                local_id: user.local_id,
                nome: user.nome 
            });
        } else {
            res.status(401).json({ error: "E-mail ou senha incorretos." });
        }
    } catch (err) {
        console.error("Erro no login:", err);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

// Listar pedidos autorizados para o Estoque (COLETA_LIBERADA ou PARCIAL)
router.get('/pedidos/estoque/autorizados', verificarToken, async (req, res) => {
    try {
        // Usando o status exato do seu banco de dados: 'APROVADO'
        const result = await db.query(`
            SELECT p.id, p.status, p.data_criacao, l.nome as escola_nome 
            FROM pedidos p 
            LEFT JOIN locais l ON p.local_destino_id = l.id 
            WHERE p.status = 'APROVADO'
            ORDER BY p.data_criacao ASC
        `);
        
        res.json(result.rows);
    } catch (err) {
        console.error("ERRO NA ROTA DE SEPARAÇÃO:", err.message);
        res.status(500).json({ error: "Erro interno ao buscar pedidos aprovados." });
    }
});

router.post('/pedidos/:id/remessa', verificarToken, async (req, res) => {
    const pedido_id = req.params.id;
    const { itens, veiculo } = req.body; // itens: [{produto_id, tamanho, qtd_enviar}]

    try {
        await db.query('BEGIN');

        // 1. Cria a Remessa
        const remessa = await db.query(
            "INSERT INTO remessas (pedido_id, usuario_id, veiculo_info) VALUES ($1, $2, $3) RETURNING id",
            [pedido_id, req.userId, veiculo]
        );

        for (const item of itens) {
            if (item.qtd_enviar <= 0) continue;

            // 2. Registra o item na remessa
            await db.query(
                "INSERT INTO remessa_itens (remessa_id, produto_id, tamanho, quantidade_enviada) VALUES ($1, $2, $3, $4)",
                [remessa.rows[0].id, item.produto_id, item.tamanho, item.qtd_enviar]
            );

            // 3. Baixa o estoque real (Uniformes ou Material)
            if (item.tamanho && item.tamanho !== 'N/A') {
                await db.query(
                    "UPDATE estoque_grades SET quantidade = quantidade - $1 WHERE produto_id = $2 AND tamanho = $3",
                    [item.qtd_enviar, item.produto_id, item.tamanho]
                );
            }
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2",
                [item.qtd_enviar, item.produto_id]
            );
        }

        // 4. Verifica se o pedido foi totalmente atendido
        const check = await db.query(`
            SELECT 
                (SELECT SUM(quantidade_solicitada) FROM pedido_itens WHERE pedido_id = $1) as total_pedido,
                (SELECT SUM(quantidade_enviada) FROM remessa_itens ri JOIN remessas r ON ri.remessa_id = r.id WHERE r.pedido_id = $1) as total_enviado
        `, [pedido_id]);

        const { total_pedido, total_enviado } = check.rows[0];
        const novoStatus = total_enviado >= total_pedido ? 'AGUARDANDO_COLETA' : 'ATENDIDO_PARCIALMENTE';

        await db.query("UPDATE pedidos SET status = $1 WHERE id = $2", [novoStatus, pedido_id]);

        await db.query('COMMIT');
        res.json({ message: "Saída processada!", status: novoStatus });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 1. Listar todas as remessas vinculadas a um pedido
router.get('/pedidos/:id/remessas', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, u.nome as usuario_nome 
            FROM remessas r 
            JOIN usuarios u ON r.usuario_id = u.id 
            WHERE r.pedido_id = $1 
            ORDER BY r.data_saida DESC`, 
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Erro ao carregar remessas" }); }
});

// 2. Detalhar os itens de uma remessa específica
router.get('/remessas/:id/itens', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ri.*, p.nome as produto_nome 
            FROM remessa_itens ri 
            JOIN produtos p ON ri.produto_id = p.id 
            WHERE ri.remessa_id = $1`, 
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Erro ao carregar itens da remessa" }); }
});

// Substitua sua rota de lista-geral por esta versão robusta
router.get('/pedidos/lista-geral', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.data_criacao, 
                p.status, 
                p.tipo_pedido,
                u.nome as solicitante,
                l.nome as escola_destino
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            ORDER BY p.data_criacao DESC
        `);
        
        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao listar pedidos:", err.message);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// --- ROTA DE NOTIFICAÇÕES (Para resolver o erro da linha 2837) ---
router.get('/pedidos/contagem/alertas', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT COUNT(*) as total FROM pedidos 
            WHERE status IN ('AGUARDANDO_AUTORIZACAO', 'COLETA_LIBERADA')
        `);
        res.json({ total: parseInt(result.rows[0].total || 0) });
    } catch (err) {
        console.error("Erro alertas:", err.message);
        res.json({ total: 0 }); // Retorna 0 em vez de erro 500
    }
});

// Rota para Atualizar o Status do Pedido (Autorizar ou Recusar)
router.patch('/pedidos/:id/status', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { status, motivo_recusa } = req.body;

    try {
        await db.query(
            'UPDATE pedidos SET status = $1, motivo_recusa = $2, data_autorizacao = NOW() WHERE id = $3',
            [status, motivo_recusa, id]
        );
        
        // Registrar no histórico (Opcional, mas recomendado)
        await db.query(
            'INSERT INTO historico (pedido_id, usuario_id, tipo_movimentacao, descricao, data) VALUES ($1, $2, $3, $4, NOW())',
            [id, req.userId, 'ALTERACAO_STATUS', `PEDIDO ${status} POR ADMIN`]
        );

        res.json({ message: `Solicitação atualizada para ${status}!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao atualizar status do pedido." });
    }
});

router.post('/pedidos/escola/solicitar', verificarToken, async (req, res) => {
    const { itens, tipo_pedido } = req.body; // Removemos o local_destino_id daqui

    try {
        await db.query('BEGIN');

        // 1. BUSCA AUTOMÁTICA: O backend descobre o local_id real do usuário no banco
        const userRes = await db.query(
            "SELECT local_id FROM usuarios WHERE id = $1", 
            [req.userId]
        );
        const local_id_automatico = userRes.rows[0]?.local_id;

        if (!local_id_automatico) {
            throw new Error("Usuário não possui um local vinculado no cadastro.");
        }

        // 2. INSERÇÃO: Agora usamos o local_id_automatico que veio direto do banco
        const pedidoRes = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', $3, NOW()) RETURNING id`,
            [req.userId, local_id_automatico, tipo_pedido]
        );

        const pedidoId = pedidoRes.rows[0].id;

        // Inserção dos itens
        for (const item of itens) {
            await db.query(
                `INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, item.produto_id, item.tamanho, item.quantidade]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "Pedido enviado com sucesso!", id: pedidoId });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("ERRO AO SALVAR PEDIDO:", err.message);
        res.status(500).json({ error: err.message || "Erro ao gravar pedido." });
    }
});

// Rota para a Escola ver o que está a caminho
router.get('/pedidos/alertas-escola', verificarToken, async (req, res) => {
    try {
        const userResult = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [req.userId]);
        const localId = userResult.rows[0]?.local_id;

        if (!localId) return res.json([]);

        // Usando apenas os status que existem no seu ENUM 'status_pedido'
        const result = await db.query(`
            SELECT id, status, data_criacao 
            FROM pedidos 
            WHERE local_destino_id = $1 
            AND status IN ('EM_TRANSPORTE', 'APROVADO', 'COLETA_LIBERADA')
            ORDER BY data_criacao DESC
        `, [localId]);

        res.json(result.rows);
    } catch (err) {
        console.error("ERRO SQL:", err.message);
        res.status(500).json({ error: "Erro ao consultar pedidos em transporte." });
    }
});

router.post('/pedidos/escola/devolver', verificarToken, async (req, res) => {
    const { itensDevolucao } = req.body;
    const usuario_id = req.userId;

    try {
        await db.query('BEGIN');

        // 1. Cria o pedido de devolução vinculado à escola do usuário
        const pedidoRes = await db.query(
            `INSERT INTO pedidos (
                usuario_origem_id, 
                local_destino_id, 
                status, 
                tipo_pedido, 
                data_criacao
            ) VALUES (
                $1, 
                (SELECT local_id FROM usuarios WHERE id = $1), 
                'DEVOLUCAO_PENDENTE', 
                'DEVOLUCAO', 
                NOW()
            ) RETURNING id`,
            [usuario_id]
        );

        const pedidoId = pedidoRes.rows[0].id;

        // 2. Insere os itens que a escola está a devolver
        for (const item of itensDevolucao) {
            await db.query(
                "INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) VALUES ($1, $2, $3, $4)",
                [pedidoId, item.produto_id, item.tamanho, item.quantidade]
            );
        }

        // 3. Regista no log para o Administrador acompanhar
        await db.query(
            "INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_novo, observacao) VALUES ($1, $2, 'DEVOLUCAO_PENDENTE', 'Solicitação de devolução iniciada pela escola')",
            [pedidoId, usuario_id]
        );

        await db.query('COMMIT');
        res.status(201).json({ message: "Solicitação de devolução enviada com sucesso!", pedidoId });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro na devolução:", err.message);
        res.status(500).json({ error: "Erro ao processar devolução." });
    }
});

// Criar Pedido Direto (Admin) - Para qualquer categoria
router.post('/pedidos/admin/criar', verificarToken, async (req, res) => {
    const { local_destino_id, itens, tipo_pedido } = req.body;
    const usuario_id = req.userId;

    try {
        await db.query('BEGIN');

        // Note o status: já nasce em 'APROVADO' ou 'EM_SEPARACAO'
        const pedidoRes = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'APROVADO', $3, NOW()) RETURNING id`,
            [usuario_id, local_destino_id, tipo_pedido]
        );

        const pedidoId = pedidoRes.rows[0].id;

        for (const item of itens) {
            await db.query(
                "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, tamanho) VALUES ($1, $2, $3, $4)",
                [pedidoId, item.id, item.quantidade, item.tamanho || null]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "Pedido Admin criado com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// LISTAR PEDIDOS PRONTOS PARA COLETA (Aguardando transporte)
router.get('/pedidos/logistica/aguardando-coleta', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, l.nome as escola_nome,
            (SELECT COUNT(*) FROM remessas r WHERE r.pedido_id = p.id) as total_remessas
            FROM pedidos p 
            JOIN locais l ON p.local_destino_id = l.id 
            WHERE p.status = 'AGUARDANDO_COLETA'
            ORDER BY p.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CONFIRMAR COLETA (Início do transporte)
router.post('/pedidos/:id/coletar', verificarToken, async (req, res) => {
    const pedido_id = req.params.id;
    try {
        await db.query(`
            UPDATE pedidos 
            SET status = 'EM_TRANSPORTE', data_saida_transporte = NOW() 
            WHERE id = $1`, [pedido_id]);
        
        // Registro no histórico
        await db.query(
            "INSERT INTO historico (usuario_id, tipo_movimentacao, descricao, data) VALUES ($1, $2, $3, NOW())",
            [req.userId, 'LOGISTICA_COLETA', `PEDIDO #${pedido_id} COLETADO E EM TRANSPORTE`]
        );

        res.json({ message: "Transporte iniciado!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 1. Listar devoluções que aguardam conferência no estoque
router.get('/pedidos/estoque/devolucoes-pendentes', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, l.nome as escola_nome 
            FROM pedidos p 
            JOIN locais l ON p.local_destino_id = l.id 
            WHERE p.status = 'DEVOLUCAO_PENDENTE'
            ORDER BY p.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Erro ao listar devoluções" }); }
});

// 2. Confirmar recebimento da devolução e atualizar saldo real
router.post('/pedidos/:id/confirmar-devolucao', verificarToken, async (req, res) => {
    const pedido_id = req.params.id;
    try {
        await db.query('BEGIN');

        const itens = await db.query("SELECT * FROM pedido_itens WHERE pedido_id = $1", [pedido_id]);

        for (const item of itens.rows) {
            // Se for uniforme (tem tamanho), atualiza a grade específica
            if (item.tamanho && item.tamanho !== 'N/A') {
                await db.query(`
                    INSERT INTO estoque_grades (produto_id, tamanho, quantidade)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (produto_id, tamanho) 
                    DO UPDATE SET quantidade = estoque_grades.quantidade + $3
                `, [item.produto_id, item.tamanho, item.quantidade_solicitada]);
            }

            // Atualiza o saldo geral na tabela de produtos para todas as categorias
            await db.query(
                "UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2",
                [item.quantidade_solicitada, item.produto_id]
            );
        }

        // Finaliza o pedido e regista no histórico
        await db.query("UPDATE pedidos SET status = 'DEVOLVIDO', data_finalizacao = NOW() WHERE id = $1", [pedido_id]);
        await db.query(
            "INSERT INTO historico (usuario_id, tipo_movimentacao, descricao, data) VALUES ($1, $2, $3, NOW())",
            [req.userId, 'ENTRADA_DEVOLUCAO', `RECEBIDA DEVOLUÇÃO DO PEDIDO #${pedido_id}`]
        );

        await db.query('COMMIT');
        res.json({ message: "Devolução processada e stock atualizado!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/escola/:acao', verificarToken, async (req, res) => {
    const { itens } = req.body;
    const { acao } = req.params; // solicitar ou devolver
    const status = acao === 'solicitar' ? 'AGUARDANDO_AUTORIZACAO' : 'DEVOLUCAO_PENDENTE';
    const tipo = acao === 'solicitar' ? 'SOLICITACAO' : 'DEVOLUCAO';

    try {
        await db.query('BEGIN');
        
        // Busca o local da escola. Se não achar local_id, retorna erro claro
        const userResult = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [req.userId]);
        const local_id = userResult.rows[0]?.local_id;

        if (!local_id) {
            throw new Error("Seu usuário não está vinculado a nenhuma unidade (local_id nulo).");
        }

        const pedido = await db.query(
            "INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, data_criacao, tipo_pedido) VALUES ($1, $2, $3, NOW(), $4) RETURNING id",
            [req.userId, local_id, status, tipo]
        );

        for (const item of itens) {
            await db.query(
                "INSERT INTO pedido_itens (pedido_id, produto_id, tamanho, quantidade_solicitada) VALUES ($1, $2, $3, $4)",
                [pedido.rows[0].id, item.produto_id, item.tamanho, item.quantidade]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ message: "Operação realizada com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

router.post('/pedidos/:id/confirmar-recebimento', verificarToken, async (req, res) => {
    const pedido_id = req.params.id;
    try {
        // Atualiza para o status exato do seu ENUM: 'ENTREGUE'
        const result = await db.query(
            "UPDATE pedidos SET status = 'ENTREGUE', data_finalizacao = NOW() WHERE id = $1 RETURNING id",
            [pedido_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Pedido não encontrado." });
        }

        // Registra no histórico
        await db.query(
            "INSERT INTO historico (usuario_id, tipo_movimentacao, descricao, data) VALUES ($1, $2, $3, NOW())",
            [req.userId, 'RECEBIMENTO_ESCOLA', `ESCOLA CONFIRMOU RECEBIMENTO DO PEDIDO #${pedido_id}`]
        );

        res.json({ message: "Recebimento confirmado com sucesso!" });
    } catch (err) {
        console.error("ERRO AO CONFIRMAR:", err.message);
        res.status(500).json({ error: "Erro ao atualizar status para ENTREGUE." });
    }
});

// Busca os totais para os cards do dashboard
router.get('/dashboard/estatisticas', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT status, COUNT(*) as total 
            FROM pedidos 
            GROUP BY status`;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
    }
});

// Busca detalhes completos de um pedido (incluindo local e itens)
router.get('/pedidos/:id/detalhes-gerais', verificarToken, async (req, res) => {
    try {
        const pedido = await db.query(`
            SELECT p.*, l.nome as escola_nome, u.nome as solicitante_nome
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE p.id = $1`, [req.params.id]);

        const itens = await db.query(`
            SELECT i.*, prod.nome as produto_nome 
            FROM itens_pedido i
            JOIN produtos prod ON i.produto_id = prod.id
            WHERE i.pedido_id = $1`, [req.params.id]);

        res.json({ info: pedido.rows[0], itens: itens.rows });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar detalhes." });
    }
});

router.get('/dashboard/evolucao-semanal', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                TO_CHAR(data_recebimento, 'DD/MM') as data, 
                COUNT(*) as total 
            FROM pedidos 
            WHERE status = 'ENTREGUE' 
              AND data_recebimento >= NOW() - INTERVAL '7 days'
            GROUP BY TO_CHAR(data_recebimento, 'DD/MM'), data_recebimento
            ORDER BY data_recebimento ASC`;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar evolução semanal." });
    }
});

// Rota rápida apenas para contagem de notificações
router.get('/pedidos/notificacoes/contagem', verificarToken, async (req, res) => {
    try {
        // Conta apenas pedidos que precisam de ação imediata (Autorização)
        const result = await db.query(
            "SELECT COUNT(*) FROM pedidos WHERE status = 'AGUARDANDO_AUTORIZACAO'"
        );
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: "Erro na contagem." });
    }
});

// ==========================================
// 2. ROTAS DE ESTOQUE
// ==========================================
// 1. Rota para estoque de Materiais (Consumo)
router.get('/estoque/materiais', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id, nome, quantidade_estoque, alerta_minimo FROM produtos WHERE tipo = 'MATERIAL' ORDER BY nome");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/estoque/grade/:id', verificarToken, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT tamanho, quantidade FROM estoque_grades WHERE produto_id = $1 ORDER BY tamanho",
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Rota para estoque de Uniformes (Detallhado por Tamanho)
router.get('/estoque/uniformes-grade', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.nome as produto, eg.tamanho, eg.quantidade
            FROM estoque_grades eg
            JOIN produtos p ON eg.produto_id = p.id
            ORDER BY p.nome, eg.tamanho
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/estoque/central', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.nome as categoria_nome
            FROM produtos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.nome ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rota principal de ENTRADA DE ESTOQUE
router.get('/estoque/geral', verificarToken, async (req, res) => {
    try {
        // Esta query calcula a soma das grades NA HORA e organiza por categoria
        const result = await db.query(`
            SELECT 
                p.id, 
                p.nome, 
                p.tipo, 
                p.alerta_minimo,
                COALESCE(SUM(eg.quantidade), 0) AS quantidade_estoque
            FROM produtos p
            LEFT JOIN estoque_grades eg ON p.id = eg.produto_id
            GROUP BY p.id, p.nome, p.tipo, p.alerta_minimo
            ORDER BY 
                CASE WHEN p.tipo = 'UNIFORMES' THEN 1 ELSE 2 END, 
                p.nome ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("Erro no estoque geral:", err);
        res.status(500).json({ error: "Erro ao processar saldo de estoque." });
    }
});

router.post('/estoque/entrada', verificarToken, async (req, res) => {
    const { produto_id, tipo, grade, quantidade_total } = req.body;
    try {
        await db.query('BEGIN');
        if (tipo === 'UNIFORMES') {
            for (const item of grade) {
                await db.query(`
                    INSERT INTO estoque_grades (produto_id, tamanho, quantidade)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (produto_id, tamanho) DO UPDATE SET quantidade = estoque_grades.quantidade + $3
                `, [produto_id, item.tamanho, item.quantidade]);
            }
        }
        await db.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2', [quantidade_total, produto_id]);
        await db.query('COMMIT');
        res.json({ message: "OK" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. ROTAS DE HISTÓRICO
// ==========================================
router.get('/historico/geral', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT h.*, u.nome as usuario_nome 
            FROM historico h 
            JOIN usuarios u ON h.usuario_id = u.id 
            ORDER BY h.data DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 4. ROTAS DE PRODUTOS
// ==========================================
router.get('/produtos/tipo/:tipo', verificarToken, async (req, res) => {
    const tipoSolicitado = req.params.tipo.toUpperCase();
    try {
        // O cast ::text resolve a falha de comparação do ENUM
        const result = await db.query(
            "SELECT id, nome FROM produtos WHERE UPPER(tipo::text) = $1 ORDER BY nome", 
            [tipoSolicitado]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar produtos" });
    }
});

// Rota para cadastrar apenas a definição do produto
router.get('/produtos/lista', verificarToken, async (req, res) => {
    const { tipo } = req.query;
    try {
        const query = tipo 
            ? "SELECT id, nome FROM produtos WHERE tipo = $1 ORDER BY nome ASC"
            : "SELECT id, nome, tipo FROM produtos ORDER BY nome ASC";
        const result = await db.query(query, tipo ? [tipo] : []);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/estoque/entrada-patrimonio-lote', verificarToken, async (req, res) => {
    const { produto_id, series, local_id } = req.body;

    try {
        await db.query('BEGIN');
        for (const serie of series) {
            await db.query(
                "INSERT INTO estoque_individual (produto_id, local_id, numero_serie, status) VALUES ($1, $2, $3, 'DISPONIVEL')",
                [produto_id, local_id, serie.toUpperCase()]
            );
        }
        await db.query('COMMIT');
        res.status(201).json({ message: "Itens registrados com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "Erro ao inserir: " + err.message });
    }
});

router.post('/produtos/cadastrar', verificarToken, async (req, res) => {
    const { nome, tipo, descricao, categoria } = req.body;

    // Validação básica
    if (!nome || !tipo) {
        return res.status(400).json({ error: "Nome e Tipo são obrigatórios." });
    }

    try {
        const query = `
            INSERT INTO produtos (nome, tipo, descricao, categoria, data_cadastro)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
        `;
        const values = [nome, tipo, descricao, categoria];
        const result = await db.query(query, values);

        res.status(201).json({ 
            message: "Produto cadastrado com sucesso!", 
            id: result.rows[0].id 
        });
    } catch (err) {
        console.error("Erro ao cadastrar produto:", err.message);
        res.status(500).json({ error: "Erro interno ao salvar produto." });
    }
});

router.post('/cadastros/produtos', verificarToken, async (req, res) => {
    const { nome, tipo, alerta_minimo, categoria_id } = req.body;

    try {
        // Usamos toUpperCase() para padronizar e COALESCE ou || 0 para evitar erros de valor nulo
        await db.query(
            "INSERT INTO produtos (nome, tipo, alerta_minimo, categoria_id) VALUES ($1, $2, $3, $4)",
            [
                nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(), 
                tipo, 
                alerta_minimo || 0, 
                categoria_id || null
            ]
        );
        res.status(201).json({ message: "Produto cadastrado com sucesso!" });
    } catch (err) {
        console.error("Erro ao cadastrar produto:", err.message);
        res.status(500).json({ error: "Erro ao inserir no banco: " + err.message });
    }
});

// ROTA PARA CADASTROS GERAIS
router.post('/cadastros/:tabela', verificarToken, async (req, res) => {
    const { tabela } = req.params;
    const campos = Object.keys(req.body).join(', ');
    const valores = Object.values(req.body);
    const placeholders = valores.map((_, i) => `$${i + 1}`).join(', ');

    try {
        const query = `INSERT INTO ${tabela} (${campos}) VALUES (${placeholders})`;
        await db.query(query, valores);
        res.status(201).json({ message: "OK" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao inserir no banco: " + err.message });
    }
});

router.get('/produtos/:id/grade', verificarToken, async (req, res) => {
    try {
        // Buscamos o tipo/categoria do produto primeiro
        const prod = await db.query("SELECT tipo, nome FROM produtos WHERE id = $1", [req.params.id]);
        const nomeProduto = prod.rows[0].nome.toUpperCase();

        // Se for tênis, buscamos a grade de calçados, senão a de vestuário
        // Você também pode filtrar isso pela tabela 'estoque_tamanhos' se ela tiver uma coluna 'categoria'
        let queryTamanhos = "SELECT tamanho FROM estoque_tamanhos WHERE categoria = $1 ORDER BY id";
        let categoriaBusca = nomeProduto.includes('TENIS') ? 'CALCADO' : 'VESTUARIO';

        const tamanhos = await db.query(queryTamanhos, [categoriaBusca]);
        res.json(tamanhos.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar grade." });
    }
});

router.post('/pedidos/estoque/finalizar-remessa', verificarToken, async (req, res) => {
    const { pedidoId, itens } = req.body;
    const usuarioId = req.userId; // Extraído do token

    try {
        await db.query('BEGIN');

        // 1. Criar o cabeçalho da Remessa
        const remessaRes = await db.query(
            `INSERT INTO pedido_remessas (pedido_id, status, data_criacao) 
             VALUES ($1, 'PRONTO', NOW()) RETURNING id`,
            [pedidoId]
        );
        const remessaId = remessaRes.rows[0].id;

        // 2. Registrar os itens da remessa
        for (const item of itens) {
            await db.query(
                `INSERT INTO pedido_remessa_itens (remessa_id, produto_id, tamanho, quantidade_enviada) 
                 VALUES ($1, $2, $3, $4)`,
                [remessaId, item.produto_id, item.tamanho, item.quantidade_enviada]
            );
        }

        // 3. Cálculo de Saldo (Otimizado: Uma única query para os dois valores)
        const check = await db.query(`
            SELECT 
                (SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido WHERE pedido_id = $1) as solicitado,
                (SELECT COALESCE(SUM(pri.quantidade_enviada), 0) 
                 FROM pedido_remessa_itens pri 
                 JOIN pedido_remessas pr ON pri.remessa_id = pr.id 
                 WHERE pr.pedido_id = $1) as enviado
        `, [pedidoId]);
        
        const { solicitado, enviado } = check.rows[0];
        
        // Decisão do novo status baseado no saldo real
        const novoStatus = (parseInt(enviado) >= parseInt(solicitado)) ? 'COLETA_LIBERADA' : 'EM_SEPARACAO';

        // 4. Pegar status anterior para o log de auditoria
        const statusRes = await db.query("SELECT status FROM pedidos WHERE id = $1", [pedidoId]);
        const statusAnterior = statusRes.rows[0].status;

        // 5. Atualizar Pedido Principal
        await db.query("UPDATE pedidos SET status = $1 WHERE id = $2", [novoStatus, pedidoId]);

        // 6. Registrar Log de Auditoria (Usando a coluna data_hora que confirmamos antes)
        await db.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) 
             VALUES ($1, $2, $3, $4, $5)`,
            [pedidoId, usuarioId, statusAnterior, novoStatus, `Remessa #${remessaId} gerada. Progresso: ${enviado}/${solicitado} itens.`]
        );

        await db.query('COMMIT');
        res.json({ message: "Remessa salva com sucesso!", status: novoStatus, remessaId });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("ERRO NA REMESSA:", err);
        res.status(500).json({ error: "Falha interna ao processar remessa: " + err.message });
    }
});

router.get('/pedidos/dashboard/contagem', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT status, COUNT(*) as total 
            FROM pedidos 
            GROUP BY status
        `);
        
        // Transformamos o array em um objeto fácil de ler no frontend
        const contagem = {};
        result.rows.forEach(row => {
            contagem[row.status] = parseInt(row.total);
        });

        res.json(contagem);
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar dashboard." });
    }
});

router.get('/impressao/romaneio/:id', verificarToken, async (req, res) => {
    const romaneioId = req.params.id;

    try {
        const result = await db.query(`
            SELECT 
                r.id AS romaneio_id, r.motorista_nome, r.veiculo_placa, r.data_saida,
                p.id AS pedido_id, p.tipo_pedido,
                l.nome AS escola_nome, l.endereco,
                pri.quantidade_enviada, pr.produto_id, prod.nome AS produto_nome, pri.tamanho
            FROM romaneios r
            JOIN pedidos p ON p.romaneio_id = r.id
            JOIN locais l ON p.local_destino_id = l.id
            JOIN pedido_remessas pr ON pr.pedido_id = p.id
            JOIN pedido_remessa_itens pri ON pri.remessa_id = pr.id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE r.id = $1`, [romaneioId]);

        if (result.rows.length === 0) return res.status(404).json({ error: "Romaneio não encontrado." });

        // Agrupando os dados para o cabeçalho
        const romaneioData = {
            info: result.rows[0],
            itens: result.rows
        };

        res.json(romaneioData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para o perfil Logística ver o que está pronto para carregar
router.get('/pedidos/logistica/prontos', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                l.nome as escola_nome, 
                p.data_separacao,
                p.volumes,
                p.status
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'COLETA_LIBERADA'
            ORDER BY p.data_separacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar pedidos para coleta." });
    }
});

// Rota para o perfil Logística ver o que está pronto para carregar
router.get('/pedidos/logistica/prontos', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                l.nome as escola_nome, 
                p.data_separacao,
                p.volumes,
                p.status
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'COLETA_LIBERADA'
            ORDER BY p.data_separacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar pedidos para coleta." });
    }
});

// DESPACHAR
router.post('/pedidos/logistica/despachar', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;
    await db.query("UPDATE pedidos SET status = 'EM_TRANSPORTE', data_saida = NOW() WHERE id = $1", [pedidoId]);
    res.json({ message: "Carga em transporte!" });
});

router.post('/pedidos/escola/confirmar-recebimento', verificarToken, async (req, res) => {
    const { remessaId, pedidoId } = req.body;
    const usuario_id = req.userId;

    try {
        await db.query('BEGIN');

        // A. Atualiza a Remessa para ENTREGUE
        await db.query("UPDATE pedido_remessas SET status = 'ENTREGUE' WHERE id = $1", [remessaId]);

        // B. Verifica se todas as remessas deste pedido já foram entregues
        // e se a soma das quantidades enviadas bate com o total do pedido
        const conferênciaFinal = await db.query(`
            SELECT 
                (SELECT SUM(quantidade) FROM itens_pedido WHERE pedido_id = $1) as total_pedido,
                (SELECT SUM(pri.quantidade_enviada) 
                 FROM pedido_remessa_itens pri 
                 JOIN pedido_remessas pr ON pri.remessa_id = pr.id 
                 WHERE pr.pedido_id = $1 AND pr.status = 'ENTREGUE') as total_recebido
        `, [pedidoId]);

        const { total_pedido, total_recebido } = conferênciaFinal.rows[0];

        // C. Se o total recebido atingiu o total do pedido, encerra o Pedido Pai
        if (parseInt(total_recebido) >= parseInt(total_pedido)) {
            await db.query("UPDATE pedidos SET status = 'ENTREGUE' WHERE id = $1", [pedidoId]);
            
            // Log de Encerramento Total
            await db.query(
                `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao, data_hora) 
                 VALUES ($1, $2, 'EM_TRANSPORTE', 'ENTREGUE', 'Pedido totalmente recebido pela escola', NOW())`,
                [pedidoId, usuario_id]
            );
        }

        await db.query('COMMIT');
        res.json({ message: "Recebimento confirmado com sucesso!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/escola/a-caminho', verificarToken, async (req, res) => {
    const usuario_id = req.userId;

    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.data_saida, 
                r.motorista_nome, 
                r.veiculo_placa,
                p.status
            FROM pedidos p
            JOIN romaneios r ON p.romaneio_id = r.id
            WHERE p.local_destino_id = (SELECT local_id FROM usuarios WHERE id = $1)
            AND p.status = 'EM_TRANSPORTE'
            ORDER BY p.data_saida DESC
        `, [usuario_id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar pedidos a caminho:", err.message);
        res.status(500).json({ error: "Erro ao carregar entregas." });
    }
});

router.get('/pedidos/escola/limite-devolucao', verificarToken, async (req, res) => {
    const usuario_id = req.userId;

    try {
        const result = await db.query(`
            SELECT 
                prod.id AS produto_id, 
                prod.nome AS produto_nome, 
                pri.tamanho, 
                SUM(pri.quantidade_enviada)::integer AS total_recebido
            FROM pedido_remessa_itens pri
            JOIN pedido_remessas pr ON pri.remessa_id = pr.id
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE p.local_destino_id = (SELECT local_id FROM usuarios WHERE id = $1)
              AND p.data_criacao >= NOW() - INTERVAL '30 days'
              AND p.status IN ('ENTREGUE', 'EM_TRANSPORTE', 'COLETA_LIBERADA')
            GROUP BY prod.id, prod.nome, pri.tamanho
            HAVING SUM(pri.quantidade_enviada) > 0
        `, [usuario_id]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao calcular limite: " + err.message });
    }
});

router.post('/pedidos/solicitar', verificarToken, async (req, res) => {
    const usuario_id = req.userId; // Vem do token JWT

    try {
        // Buscamos o local do usuário para garantir
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id = userRes.rows[0].local_id;

        if (!local_id) {
            return res.status(400).json({ error: "Seu usuário não está vinculado a nenhuma escola/local." });
        }

        // Inserimos o pedido. A Trigger agora garante o preenchimento, 
        // mas passar o local_id aqui é o "plano A".
        const result = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
             VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'SAIDA') RETURNING id`,
            [usuario_id, local_id]
        );

        res.status(201).json({ pedidoId: result.rows[0].id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao processar solicitação." });
    }
});

router.post('/pedidos/finalizar-autorizacao', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Busca os itens do pedido para saber o que subtrair
        const itensReq = await db.query(
            "SELECT produto_id, tamanho, quantidade FROM itens_pedido WHERE pedido_id = $1",
            [pedidoId]
        );

        // 2. Para cada item, damos baixa no estoque central (estoque_grades)
        for (const item of itensReq.rows) {
            const updateEstoque = await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3 AND quantidade >= $1
                 RETURNING quantidade`,
                [item.quantidade, item.produto_id, item.tamanho]
            );

            if (updateEstoque.rowCount === 0) {
                throw new Error(`Estoque insuficiente para o produto ID ${item.produto_id} tamanho ${item.tamanho}`);
            }
        }

        // 3. Atualiza o status do pedido para 'EM_SEPARACAO'
        await db.query(
            "UPDATE pedidos SET status = 'EM_SEPARACAO' WHERE id = $1",
            [pedidoId]
        );

        await db.query('COMMIT');
        res.json({ message: "Pedido autorizado e estoque atualizado!" });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro ao finalizar:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/autorizar-final', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Busca os itens do pedido
        const itensReq = await db.query(
            "SELECT produto_id, tamanho, quantidade FROM itens_pedido WHERE pedido_id = $1",
            [pedidoId]
        );

        // 2. Processa a baixa de estoque para cada item
        for (const item of itensReq.rows) {
            // Só subtrai se a quantidade atual for suficiente (segurança extra)
            const resultBaixa = await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3 AND quantidade >= $1
                 RETURNING quantidade`,
                [item.quantidade, item.produto_id, item.tamanho]
            );

            if (resultBaixa.rowCount === 0) {
                throw new Error(`Estoque insuficiente para o item ID ${item.produto_id} tam ${item.tamanho}`);
            }
        }

        // 3. Atualiza o status para o próximo passo da logística
        await db.query(
            "UPDATE pedidos SET status = 'AGUARDANDO_SEPARACAO' WHERE id = $1",
            [pedidoId]
        );

        await db.query('COMMIT');
        res.json({ message: "Pedido autorizado. Status: AGUARDANDO_SEPARACAO" });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro na autorização:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/logistica/remessas-pendentes', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                pr.id AS remessa_id,
                p.id AS pedido_id,
                l.nome AS escola_nome,
                pr.data_criacao AS data_remessa,
                p.status AS status_pedido
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE pr.status = 'PRONTO'
            ORDER BY pr.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar remessas para transporte." });
    }
});

router.post('/pedidos/logistica/iniciar-transporte', verificarToken, async (req, res) => {
    const { remessaId } = req.body;
    try {
        // Atualiza a remessa específica
        await db.query("UPDATE pedido_remessas SET status = 'EM_TRANSPORTE' WHERE id = $1", [remessaId]);
        
        // Opcional: Se quiser que o pedido pai também mude para EM_TRANSPORTE
        const remessa = await db.query("SELECT pedido_id FROM pedido_remessas WHERE id = $1", [remessaId]);
        await db.query("UPDATE pedidos SET status = 'EM_TRANSPORTE' WHERE id = $1", [remessa.rows[0].pedido_id]);

        res.json({ message: "Transporte iniciado!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pedidos/logistica/entregas-pendentes', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                pr.id AS remessa_id,
                p.id AS pedido_id,
                l.nome AS escola_nome,
                pr.data_criacao,
                p.status AS status_pedido
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE pr.status = 'PRONTO' -- Mostra qualquer remessa que o estoque finalizou
            ORDER BY pr.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar remessas." });
    }
});

router.get('/pedidos/remessa/:id/detalhes', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT
                pr.id as remessa_id,
                pr.data_criacao,
                p.id as pedido_id,
                l.nome as escola_nome,
                -- l.endereco as escola_endereco, <-- REMOVIDO POIS A COLUNA NÃO EXISTE
                pri.tamanho,
                pri.quantidade_enviada,
                prod.nome as produto_nome
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            JOIN pedido_remessa_itens pri ON pr.id = pri.remessa_id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE pr.id = $1
        `;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Remessa não encontrada ou sem itens." });
        }

        res.json(result.rows);
    } catch (err) {
        console.error("Erro na consulta de detalhes:", err.message);
        res.status(500).json({ error: "Erro no banco de dados: " + err.message });
    }
});

router.get('/pedidos/escola/recebimentos-pendentes', verificarToken, async (req, res) => {
    // Pegamos o local_id do usuário logado (deve estar no seu Token)
    const local_id = req.localId; 

    try {
        const result = await db.query(`
            SELECT 
                pr.id AS remessa_id,
                p.id AS pedido_id,
                pr.data_criacao AS data_envio,
                u.nome AS quem_enviou
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN usuarios u ON p.usuario_separacao_id = u.id
            WHERE p.local_destino_id = $1 
            AND pr.status = 'EM_TRANSPORTE'
            ORDER BY pr.data_criacao DESC
        `, [local_id]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar entregas pendentes." });
    }
});

router.patch('/pedidos/remessa/:id/status', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { novoStatus } = req.body;

    try {
        // 1. Atualiza o status da remessa
        await db.query(
            "UPDATE pedido_remessas SET status = $1 WHERE id = $2",
            [novoStatus, id]
        );

        // 2. Opcional: Se for a última remessa, você pode querer atualizar o status do pedido pai também
        // Mas por enquanto, focar na remessa já resolve para a escola ver.

        res.json({ message: "Status atualizado com sucesso" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/escola/remessas-a-caminho', verificarToken, async (req, res) => {
    try {
        // Usamos o ID do usuário que o seu 'verificarToken' já valida com sucesso
        const usuarioId = req.usuario.id;

        // TÉCNICA DE JOIN: Buscamos a remessa partindo do ID do usuário logado
        // Relacionamos: Usuario -> Local -> Pedido -> Remessa
        const query = `
            SELECT 
                pr.id as remessa_id,
                pr.pedido_id,
                pr.data_criacao,
                l.nome as escola_nome
            FROM usuarios u
            JOIN locais l ON u.local_id = l.id
            JOIN pedidos p ON p.local_destino_id = l.id
            JOIN pedido_remessas pr ON pr.pedido_id = p.id
            WHERE u.id = $1 
            AND pr.status = 'EM_TRANSPORTE'
            ORDER BY pr.id DESC
        `;

        const { rows } = await db.query(query, [usuarioId]);
        
        // Se retornar vazio, enviamos [], o que fará o front mostrar "Nenhuma remessa"
        res.json(rows);

    } catch (err) {
        console.error("Erro na rota escola:", err.message);
        res.status(500).json({ error: "Erro no banco: " + err.message });
    }
});

router.patch('/escola/confirmar-recebimento/:id', verificarToken, async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            UPDATE pedido_remessas 
            SET status = 'ENTREGUE' 
            WHERE id = $1
        `;
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Remessa não encontrada." });
        }

        res.json({ message: "Recebimento confirmado com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/remessas/pendentes-transporte', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT r.*, l.nome as escola_nome 
            FROM pedido_remessas r
            JOIN pedidos p ON r.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE r.status = 'PRONTO' -- ELA SÓ APARECE SE ESTIVER PRONTA
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }

});

router.patch('/pedidos/remessa/:id/confirmar-recebimento', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Iniciamos uma transação para garantir que tudo ocorra bem
        await db.query('BEGIN');

        // 1. Atualiza a remessa para ENTREGUE
        await db.query(`
            UPDATE pedido_remessas 
            SET status = 'ENTREGUE', 
                data_recebimento = NOW() 
            WHERE id = $1`, [id]);

        // 2. Opcional: Aqui podes disparar uma função para somar essas quantidades 
        // no saldo atual da escola caso tenhas uma tabela de 'estoque_escolas'

        await db.query('COMMIT');
        res.json({ message: "Recebimento confirmado com sucesso!" });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Erro ao confirmar recebimento: " + err.message });
    }
});

router.patch('/logistica/iniciar-transporte/:id', verificarToken, async (req, res) => {
    const { id } = req.params;

    try {
        // Atualizamos APENAS o status, que sabemos que existe
        const query = `
            UPDATE pedido_remessas 
            SET status = 'EM_TRANSPORTE' 
            WHERE id = $1
        `;
        
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Remessa não encontrada." });
        }

        res.json({ message: "Transporte iniciado com sucesso!" });
    } catch (err) {
        // Isso vai imprimir o erro real no console do seu servidor Ubuntu
        console.error("ERRO NO BANCO:", err.message);
        res.status(500).json({ error: "Erro no banco de dados: " + err.message });
    }
});


router.get('/admin/dashboard-stats', verificarToken, async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM pedidos WHERE status = 'SOLICITADO') as total_solicitados,
                (SELECT COUNT(*) FROM pedidos WHERE status = 'AUTORIZADO') as total_autorizados,
                (SELECT COUNT(*) FROM pedido_remessas WHERE status = 'EM SEPARAÇÃO') as total_separacao,
                (SELECT COUNT(*) FROM pedido_remessas WHERE status = 'PRONTO') as total_prontos,
                (SELECT COUNT(*) FROM pedido_remessas WHERE status = 'EM_TRANSPORTE') as total_transporte,
                (SELECT COUNT(*) FROM pedido_remessas WHERE status = 'ENTREGUE') as total_entregues
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota dedicada para a Escola ver o que está a caminho
router.get('/escola/minhas-remessas-transporte', verificarToken, async (req, res) => {
    try {
        // 1. Buscamos o local_id atual do usuário direto no banco (Garante que não falte)
        const usuarioRes = await db.query(
            "SELECT local_id FROM usuarios WHERE id = $1", 
            [req.usuario.id]
        );

        const localId = usuarioRes.rows[0]?.local_id;

        if (!localId) {
            return res.status(400).json({ error: "Este usuário não possui uma escola vinculada no cadastro." });
        }

        // 2. Buscamos as remessas que são para este local e estão EM_TRANSPORTE
        const query = `
            SELECT 
                pr.id as remessa_id,
                pr.pedido_id,
                pr.data_criacao,
                l.nome as escola_nome
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.local_destino_id = $1 
            AND pr.status = 'EM_TRANSPORTE'
            ORDER BY pr.id DESC
        `;
        
        const { rows } = await db.query(query, [localId]);
        res.json(rows);

    } catch (err) {
        console.error("Erro na rota da escola:", err.message);
        res.status(500).json({ error: "Erro interno: " + err.message });
    }
});

module.exports = router;