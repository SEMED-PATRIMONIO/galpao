const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarPerfil } = require('../auth/auth.middleware');
const XLSX = require('xlsx');
const pdf = require('html-pdf'); // Instale com: npm install html-pdf
const path = require('path');
const fs = require('fs');
const EXCLUSIVOS_UNIFORME_MASCULINO = ['CALCA MAS', 'SHORT'];
const EXCLUSIVOS_UNIFORME_FEMININO  = ['CALCA FEM', 'SHORT SAIA', 'SAIA'];

// ALTERAR STATUS DO USUÁRIO (Ativar/Inativar)
router.patch('/usuarios/:id/status', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Recebe 'ativo' ou 'inativo'
    
    // Converte para o padrão de caractere se preferir ('A' ou 'I')
    const statusBanco = status === 'ativo' ? 'inativo' : 'ativo';

    try {
        await db.query("UPDATE usuarios SET status = $1 WHERE id = $2", [statusBanco, id]);
        res.json({ success: true, novoStatus: statusBanco });
    } catch (err) {
        res.status(500).json({ error: "Erro ao alterar status: " + err.message });
    }
});

router.post('/admin/salvar-romaneio-disco', verificarToken, (req, res) => {
    const { html, nomeArquivo } = req.body;
    
    // O caminho que você solicitou
    const diretorioDestino = '/var/www/patrimoniosemed/frontend/romaneios';
    const caminhoCompleto = path.join(diretorioDestino, nomeArquivo);

    // Garante que a pasta existe
    if (!fs.existsSync(diretorioDestino)){
        fs.mkdirSync(diretorioDestino, { recursive: true });
    }

    const options = { format: 'A4', border: '10mm' };

    pdf.create(html, options).toFile(caminhoCompleto, (err, result) => {
        if (err) {
            console.error("Erro ao gerar PDF:", err);
            return res.status(500).json({ error: "Erro ao salvar arquivo." });
        }
        res.json({ success: true, path: caminhoCompleto });
    });
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
                COALESCE(l.nome, '⚠️ LOCAL NÃO VINCULADO') as escola_nome,
                p.tipo_pedido -- Certifique-se de retornar este campo para o front
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'AGUARDANDO_AUTORIZACAO'
              AND p.tipo_pedido != 'INFRA_PATRIMONIO'  /* <--- ADICIONE ESTA LINHA */
            ORDER BY p.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DETALHES DO PEDIDO VS ESTOQUE ATUAL
router.get('/pedidos/detalhes-estoque/:id', async (req, res) => {
    try {
        const sql = `
            SELECT 
                ip.id as item_id, -- Importante para a edição
                ip.produto_id,
                p.nome AS produto,
                p.tipo,
                ip.tamanho,
                ip.quantidade AS solicitado,
                -- LÓGICA CORRIGIDA para buscar o estoque do lugar certo
                COALESCE((
                    SELECT epl.quantidade 
                    FROM estoque_por_local epl
                    WHERE epl.produto_id = ip.produto_id
                      AND epl.local_id = 37 -- Sempre do Almoxarifado Central
                      AND epl.tamanho IS NOT DISTINCT FROM ip.tamanho
                ), 0) AS em_estoque
            FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id
            WHERE ip.pedido_id = $1
        `;

        const { rows } = await db.query(sql, [req.params.id]);
        res.json(rows);
    } catch (err) {
        console.error("ERRO NA ANÁLISE DE ESTOQUE (v2):", err.message);
        res.status(500).json({ error: "Erro interno ao processar comparação." });
    }
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
        // A ÚNICA RESPONSABILIDADE DESTA ROTA AGORA É MUDAR O STATUS
        // A baixa de estoque foi movida para a finalização da remessa, o que é mais correto.
        const updateResult = await db.query(
            `UPDATE pedidos 
            SET status = 'APROVADO', 
                autorizado_por = $1, 
                data_autorizacao = NOW() 
            WHERE id = $2 AND status = 'AGUARDANDO_AUTORIZACAO'`, // Garante que não se aprove duas vezes
            [admin_id, pedidoId]
        );

        if (updateResult.rowCount === 0) {
            throw new Error("Pedido não encontrado ou já processado.");
        }

        res.json({ message: "Pedido autorizado e enviado para a fila de separação do estoque!" });

    } catch (err) {
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
    const client = await db.pool.connect(); // <--- SEMPRE use o client para transações

    try {
        await client.query('BEGIN');
        
        // 1. Pegamos o status atual (Usando o client!)
        const atual = await client.query("SELECT status FROM pedidos WHERE id = $1", [pedidoId]);
        if (atual.rows.length === 0) throw new Error("Pedido não encontrado");
        
        const statusAnterior = atual.rows[0].status;

        // 2. Atualizamos para 'SEPARACAO_INICIADA'
        await client.query("UPDATE pedidos SET status = 'SEPARACAO_INICIADA' WHERE id = $1", [pedidoId]);

        // 3. GRAVAMOS NO LOG 
        // Verifique se é req.user.id ou req.userId no seu sistema
        const usuarioId = req.user ? req.user.id : req.userId;

        await client.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) 
             VALUES ($1, $2, $3, 'SEPARACAO_INICIADA', 'Usuário iniciou a conferência dos itens')`,
            [pedidoId, usuarioId, statusAnterior]
        );

        await client.query('COMMIT');
        res.json({ message: "Iniciado com sucesso" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao iniciar separação:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release(); // <--- OBRIGATÓRIO soltar a conexão
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
        // 1. Adicionamos 'status' ao SELECT para podermos verificar abaixo
        const result = await db.query(
            "SELECT id, nome, perfil, local_id, status FROM usuarios WHERE UPPER(nome) = UPPER($1) AND UPPER(senha) = UPPER($2)",
            [usuario, senha]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            // 2. NOVA TRAVA DE SEGURANÇA: Verifica se o status é 'inativo'
            // Se for inativo, retorna 403 (Proibido) e interrompe o login
            if (user.status === 'inativo') {
                return res.status(403).json({ message: "Acesso negado. Este utilizador está inativo." });
            }

            // 3. Se passou pela trava, gera o token normalmente como você já faz
            const token = jwt.sign(
                { 
                    id: user.id, 
                    perfil: user.perfil, 
                    local_id: user.local_id
                }, 
                SECRET, 
                { expiresIn: '24h' }
            );

            res.json({
                token: token,
                perfil: user.perfil,
                nome: user.nome,
                local_id: user.local_id
            });
        } else {
            res.status(401).json({ message: "Utilizador ou senha inválidos." });
        }
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
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

router.post('/estoque/entrada-patrimonio', verificarToken, async (req, res) => {
    const { 
        tipo_doc, numero_doc, serie_doc, chave_nfe, 
        produto_id, series 
    } = req.body;

    const cliente = await db.connect();

    try {
        await cliente.query('BEGIN'); // Inicia transação para segurança total

        // 1. Insere o Documento Fiscal
        const resDoc = await cliente.query(
            `INSERT INTO documentos_fiscais (tipo_doc, numero_doc, serie_doc, chave_nfe, usuario_id) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [tipo_doc, numero_doc, serie_doc, chave_nfe, req.usuario.id]
        );
        const documento_id = resDoc.rows[0].id;

        // 2. Insere cada Patrimônio individualmente
        const local_central_id = 37; // Padrão solicitado
        
        for (let num_serie of series) {
            await cliente.query(
                `INSERT INTO patrimonios (produto_id, numero_serie, local_id, status, documento_id) 
                 VALUES ($1, $2, $3, 'ESTOQUE', $4)`,
                [produto_id, num_serie.toUpperCase().trim(), local_central_id, documento_id]
            );
        }

        await cliente.query('COMMIT');
        res.json({ message: `${series.length} itens de patrimônio registrados com sucesso!` });

    } catch (err) {
        await cliente.query('ROLLBACK'); // Se um falhar, cancela tudo
        res.status(500).json({ error: "Erro na entrada em lote: " + err.message });
    } finally {
        cliente.release();
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
    const { nome, tipo, categoria_id, alerta_minimo } = req.body;
    
    // Esta linha depende do que o middleware decodificou do Token
    const local_id = req.user.local_id; 

    if (!local_id) {
        return res.status(400).json({ error: "Erro: Seu usuário não possui um LOCAL_ID vinculado no banco de dados." });
    }

    const client = await db.pool.connect(); //
    try {
        await client.query('BEGIN');

        const resProd = await client.query(
            `INSERT INTO produtos (nome, tipo, categoria_id, alerta_minimo, quantidade_estoque, local_id) 
             VALUES ($1, $2, $3, $4, 0, $5) RETURNING id`,
            [nome.toUpperCase().trim(), tipo, categoria_id || null, parseInt(alerta_minimo) || 0, local_id]
        );
        
        const produto_id = resProd.rows[0].id;

        if (tipo === 'UNIFORMES') {
            const grade = (nome.includes('TENIS') || nome.includes('TÊNIS')) 
                ? ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43']
                : ['2','4','6','8','10','12','14','16','PP','P','M','G','GG','EGG'];

            for (let tam of grade) {
                await client.query("INSERT INTO estoque_tamanhos (produto_id, tamanho, quantidade) VALUES ($1, $2, 0)", [produto_id, tam]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Produto cadastrado com sucesso!", id: produto_id });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
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
    const usuarioId = req.userId;

    // Validação básica
    if (!pedidoId || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ 
            error: "Dados inválidos. pedidoId e itens são obrigatórios." 
        });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // ✅ BLINDAGEM: trava o pedido para evitar duplo processamento simultâneo
        const pedidoRes = await client.query(
            `SELECT status, tipo_pedido FROM pedidos WHERE id = $1 FOR UPDATE`,
            [pedidoId]
        );
        if (pedidoRes.rows.length === 0) {
            throw new Error(`Pedido #${pedidoId} não encontrado.`);
        }
        const { status: statusAtual, tipo_pedido } = pedidoRes.rows[0];

        // ✅ Impede reprocessamento de pedido já finalizado
        if (statusAtual === 'COLETA_LIBERADA' || statusAtual === 'ENTREGUE') {
            throw new Error(
                `Pedido #${pedidoId} já está com status "${statusAtual}" ` +
                `e não pode receber nova remessa.`
            );
        }

        // 1. Criar cabeçalho da remessa
        const remessaRes = await client.query(
            `INSERT INTO pedido_remessas (pedido_id, status, data_criacao) 
             VALUES ($1, 'PRONTO', NOW()) RETURNING id`,
            [pedidoId]
        );
        const remessaId = remessaRes.rows[0].id;

        // 2. Loop: registrar itens e baixar estoque
        for (const item of itens) {
            const { produto_id, quantidade_enviada } = item;

            // ✅ Normaliza tamanho — NULL para produtos sem tamanho (MATERIAL, PATRIMÔNIO)
            const tamanho = (item.tamanho === undefined || item.tamanho === '')
                ? null
                : item.tamanho;

            // Valida quantidade
            if (!quantidade_enviada || quantidade_enviada <= 0) {
                throw new Error(`Quantidade inválida para o produto ID ${produto_id}.`);
            }

            // Busca nome e tipo do produto para mensagens claras
            const produtoRes = await client.query(
                `SELECT nome, tipo FROM produtos WHERE id = $1`,
                [produto_id]
            );
            if (produtoRes.rows.length === 0) {
                throw new Error(`Produto ID ${produto_id} não encontrado.`);
            }
            const { nome: nomeProduto, tipo: tipoProduto } = produtoRes.rows[0];

            console.log(
                `[REMESSA #${remessaId}] Baixando: "${nomeProduto}" (${tipoProduto}) | ` +
                `Tam: ${tamanho ?? 'Único'} | Qtd: ${quantidade_enviada}`
            );

            // ✅ UPDATE blindado com LIMIT 1 via subquery
            // Resolve o problema de NULL duplicado caso ainda exista em outros ambientes
            // COALESCE garante que NULL e '' são tratados como a mesma chave
            const updateRes = await client.query(
                `UPDATE estoque_por_local
                 SET quantidade = quantidade - $1
                 WHERE id = (
                     SELECT id
                     FROM estoque_por_local
                     WHERE local_id = 37
                       AND produto_id = $2
                       AND COALESCE(tamanho, '') = COALESCE($3, '')
                       AND quantidade >= $1
                     ORDER BY id
                     LIMIT 1
                     FOR UPDATE
                 )
                 RETURNING id, quantidade`,
                [quantidade_enviada, produto_id, tamanho]
            );

            if (updateRes.rowCount === 0) {
                throw new Error(
                    `Estoque insuficiente no Almoxarifado Central para ` +
                    `"${nomeProduto}" (Tamanho: ${tamanho ?? 'Único'}).`
                );
            }

            const saldoRestante = updateRes.rows[0].quantidade;
            console.log(
                `[REMESSA #${remessaId}] ✅ "${nomeProduto}" (${tamanho ?? 'Único'}) ` +
                `→ Saldo restante: ${saldoRestante}`
            );

            // Registra o item na remessa
            await client.query(
                `INSERT INTO pedido_remessa_itens 
                    (remessa_id, produto_id, tamanho, quantidade_enviada) 
                 VALUES ($1, $2, $3, $4)`,
                [remessaId, produto_id, tamanho, quantidade_enviada]
            );
        }

        // 3. Calcula progresso para definir novo status do pedido
        const checkRes = await client.query(`
            SELECT
                COALESCE(
                    (SELECT SUM(quantidade)
                     FROM itens_pedido
                     WHERE pedido_id = $1), 0
                ) AS solicitado,
                COALESCE(
                    (SELECT SUM(pri.quantidade_enviada)
                     FROM pedido_remessa_itens pri
                     JOIN pedido_remessas pr ON pr.id = pri.remessa_id
                     WHERE pr.pedido_id = $1), 0
                ) AS enviado
        `, [pedidoId]);

        const solicitado = Number(checkRes.rows[0].solicitado);
        const enviado = Number(checkRes.rows[0].enviado);

        console.log(
            `[REMESSA #${remessaId}] Progresso pedido #${pedidoId}: ` +
            `${enviado}/${solicitado}`
        );

        const novoStatus = enviado >= solicitado ? 'COLETA_LIBERADA' : 'EM_SEPARACAO';

        // 4. Atualiza status do pedido
        await client.query(
            `UPDATE pedidos SET status = $1, data_saida = NOW() WHERE id = $2`,
            [novoStatus, pedidoId]
        );

        // 5. Registra log
        await client.query(
            `INSERT INTO log_status_pedidos 
                (pedido_id, usuario_id, status_anterior, status_novo, observacao)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                pedidoId,
                usuarioId,
                statusAtual,
                novoStatus,
                `Remessa #${remessaId} registrada. ` +
                `Progresso: ${enviado}/${solicitado} unidades.`
            ]
        );

        await client.query('COMMIT');

        console.log(`[REMESSA #${remessaId}] ✅ COMMIT realizado com sucesso.`);

        res.status(201).json({
            message: `Remessa #${remessaId} registrada e estoque atualizado com sucesso!`,
            remessaId,
            status: novoStatus,
            progresso: { enviado, solicitado }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[REMESSA] ❌ ROLLBACK — ${err.message}`);
        res.status(500).json({ 
            error: "Falha ao processar remessa: " + err.message 
        });
    } finally {
        client.release();
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

// ROTA: Confirmar Recebimento na Escola (Híbrida: Uniformes e Patrimônio)
router.post('/escola/confirmar-recebimento', verificarToken, async (req, res) => {
    const { remessaId, pedidoId, setorId } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Busca dados e valida se o pedido existe e o destino
        const pedidoCheck = await client.query(
            "SELECT tipo_pedido, local_destino_id, status FROM pedidos WHERE id = $1",
            [pedidoId]
        );

        if (pedidoCheck.rows.length === 0) throw new Error("Pedido não encontrado.");

        const { tipo_pedido, local_destino_id, status: statusAtual } = pedidoCheck.rows[0];

        if (statusAtual === 'RECEBIDO') {
            await client.query('ROLLBACK'); // Libera a transação
            client.release();
            // Retorna um status 200 para não assustar o usuário, mas com uma mensagem clara.
            return res.status(200).json({ success: true, message: "Este pedido já foi recebido anteriormente." });
        }

        // 2. LÓGICA CONDICIONAL DE ENTRADA EM ESTOQUE/MOVIMENTAÇÃO
        if (tipo_pedido === 'INFRA_PATRIMONIO') {
            // --- LÓGICA DE PATRIMÔNIO (INTOCADA) ---
            const resPat = await client.query(`
                UPDATE patrimonios
                SET
                    local_id = $1,
                    setor_id = $2,
                    em_transito = false,
                    data_atualizacao = NOW()
                WHERE pedido_id = $3 AND local_id = 51`,
                [local_destino_id, setorId, pedidoId]
            );
            if (resPat.rowCount === 0 && process.env.NODE_ENV !== 'development') {
                // Em desenvolvimento, podemos ignorar, mas em produção é um erro.
                // throw new Error("Patrimônios não localizados no trânsito (Local 51).");
                console.warn(`Aviso: Nenhum patrimônio encontrado para movimentar no pedido ${pedidoId}.`);
            }
        } else {
            // --- INÍCIO DA NOVA LÓGICA PARA UNIFORMES E MATERIAIS ---

            // 2.1. Buscar todos os itens da remessa que está sendo recebida
            const itensRes = await client.query(
                `SELECT produto_id, tamanho, quantidade_enviada FROM pedido_remessa_itens WHERE remessa_id = $1`,
                [remessaId]
            );

            if (itensRes.rows.length === 0) {
                // Isso pode acontecer se uma remessa vazia for gerada por engano.
                console.warn(`Aviso: Remessa ${remessaId} recebida sem itens. Nenhuma ação de estoque foi tomada.`);
            }

            // 2.2. Iterar sobre cada item e dar ENTRADA no estoque do local de destino
            for (const item of itensRes.rows) {
                // Usamos INSERT ON CONFLICT para criar ou somar ao estoque existente.
                // Isso é atômico e seguro.
                await client.query(
                    `INSERT INTO estoque_por_local (local_id, produto_id, tamanho, quantidade)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (local_id, produto_id, tamanho)
                     DO UPDATE SET quantidade = estoque_por_local.quantidade + EXCLUDED.quantidade`,
                    [local_destino_id, item.produto_id, item.tamanho, item.quantidade_enviada]
                );
            }
            // --- FIM DA NOVA LÓGICA ---
        }

        // 3. ATUALIZA STATUS (Lógica original, agora segura para todos os tipos)
        await client.query("UPDATE pedido_remessas SET status = 'RECEBIDO' WHERE id = $1", [remessaId]);
        await client.query("UPDATE pedidos SET status = 'RECEBIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);

        // 4. LOG DE SEGURANÇA (Lógica original)
        await client.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao)
             VALUES ($1, $2, $3, 'RECEBIDO', $4)`,
            [pedidoId, req.user.id, statusAtual, `Recebimento confirmado na unidade. Tipo: ${tipo_pedido}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Recebimento confirmado e estoque atualizado." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO CRÍTICO NO RECEBIMENTO:", err.message);
        res.status(500).json({ error: "Falha no banco de dados durante o recebimento: " + err.message });
    } finally {
        client.release();
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
    try {
        const userRes = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [req.userId]);
        const escolaId = userRes.rows[0]?.local_id;

        if (!escolaId) return res.status(404).json({ error: "Escola não vinculada." });

        const query = `
            SELECT 
                pri.produto_id, 
                prod.nome as produto_nome, 
                pri.tamanho, 
                SUM(pri.quantidade_enviada) as total_recebido
            FROM pedidos p
            JOIN pedido_remessas pr ON p.id = pr.pedido_id
            JOIN pedido_remessa_itens pri ON pr.id = pri.remessa_id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE p.local_destino_id = $1 
              AND (p.status = 'ENTREGUE' OR pr.status = 'ENTREGUE')
              AND pr.data_criacao >= NOW() - INTERVAL '30 days'
            GROUP BY pri.produto_id, prod.nome, pri.tamanho
            HAVING SUM(pri.quantidade_enviada) > 0
        `;

        const result = await db.query(query, [escolaId]);

        res.json({
            success: true,
            items: result.rows || [],
            message: result.rows.length === 0 ? "Nenhum material encontrado nas remessas entregues." : ""
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
                p.status AS status_pedido,
                p.tipo_pedido -- <--- O "CÉREBRO" PARA NÃO DAR NULL
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE pr.status = 'PRONTO'
            ORDER BY pr.data_criacao ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar remessas pendentes." });
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

router.post('/infra/aprovar-automatico', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;
    const usuarioId = req.user.id;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Pega os dados do pedido (Origem e Destino)
        const pedidoData = await client.query(`
            SELECT ip.produto_id, ip.quantidade, p.local_destino_id
            FROM itens_pedido ip
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE p.id = $1`, [pedidoId]);

        if (pedidoData.rows.length === 0) throw new Error("Pedido não encontrado.");
        const { produto_id, quantidade, local_destino_id } = pedidoData.rows[0];

        // 2. MOVE PARA O LOCAL 51 (Trânsito/Reserva)
        // Isso garante que o item saia do Local 37 e fique "bloqueado"
        const resPat = await client.query(`
            UPDATE patrimonios 
            SET 
                local_id = 51, 
                em_transito = true,
                pedido_id = $1,
                local_destino_id = $2,
                data_atualizacao = NOW()
            WHERE id IN (
                SELECT id FROM patrimonios 
                WHERE produto_id = $3 AND local_id = 37 AND status = 'ESTOQUE'
                ORDER BY id ASC
                LIMIT $4
            ) RETURNING id`, [pedidoId, local_destino_id, produto_id, quantidade]);

        if (resPat.rowCount < quantidade) {
            throw new Error("Saldo insuficiente no estoque central.");
        }

        // 3. STATUS COLETA_LIBERADA (A chave para a visibilidade na escola)
        // Conforme sua sugestão, mudamos para este status para o painel-v2 "enxergar"
        await client.query(`
            UPDATE pedidos 
            SET status = 'COLETA_LIBERADA', data_saida = NOW() 
            WHERE id = $1`, [pedidoId]);

        // 4. CRIA A REMESSA COM O MESMO STATUS
        await client.query(`
            INSERT INTO pedido_remessas (pedido_id, status, data_criacao) 
            VALUES ($1, 'COLETA_LIBERADA', NOW())`, [pedidoId]);

        // 5. REGISTRO NO LOG
        await client.query(`
            INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_novo, observacao) 
            VALUES ($1, $2, 'COLETA_LIBERADA', 'Saída autorizada. Bens movidos para Trânsito (51)')`, 
            [pedidoId, usuarioId]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Pedido liberado para coleta!" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro na aprovação:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
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
        // 1. Busca TODAS as informações globais do Pedido e da Remessa
        const queryGlobal = `
            SELECT 
                p.id as pedido_id, 
                pr.id as remessa_id,
                p.tipo_pedido, 
                l.nome as escola_nome,
                p.data_criacao as data_pedido,
                p.data_saida as data_envio,
                u.nome as solicitante,
                pr.status as status_remessa
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE pr.id = $1`;
            
        const infoRes = await db.query(queryGlobal, [id]);

        if (infoRes.rows.length === 0) {
            return res.status(404).json({ error: "Remessa não encontrada." });
        }

        const info = infoRes.rows[0];
        let itens = [];

        // 2. Busca os itens (Lógica Híbrida: Patrimônio vs Consumo)
        if (info.tipo_pedido === 'INFRA_PATRIMONIO') {
            const resPat = await db.query(`
                SELECT prod.nome as produto_nome, pat.numero_serie as detalhe, 1 as qtd
                FROM patrimonios pat
                JOIN produtos prod ON pat.produto_id = prod.id
                WHERE pat.pedido_id = $1`, [info.pedido_id]);
            itens = resPat.rows;
        } else {
            const resCons = await db.query(`
                SELECT prod.nome as produto_nome, COALESCE(pri.tamanho, '---') as detalhe, pri.quantidade_enviada as qtd
                FROM pedido_remessa_itens pri
                JOIN produtos prod ON pri.produto_id = prod.id
                WHERE pri.remessa_id = $1`, [id]);
            itens = resCons.rows;
        }

        // 3. Retorna o objeto completo para o Front
        res.json({
            ...info,
            itens
        });
    } catch (err) {
        console.error("Erro ao buscar super-detalhes:", err);
        res.status(500).json({ error: err.message });
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

// ARQUIVO: backend/routes/api.routes.js

// ADICIONE 'verificarToken' AQUI vvv
router.get('/escola/remessas-a-caminho', verificarToken, async (req, res) => {
    
    // Verificação de segurança para evitar que o servidor caia caso o token mude
    if (!req.user || !req.user.local_id) {
        return res.status(401).json({ error: "Sessão inválida ou local não identificado." });
    }

    const localId = req.user.local_id; 

    try {
        const sql = `
            SELECT 
                r.id AS remessa_id,
                p.id AS pedido_id,
                l.nome AS escola_nome
            FROM remessas r
            JOIN pedidos p ON r.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.local_destino_id = $1 
              AND p.status IN ('APROVADO', 'EM_TRANSPORTE')
            ORDER BY r.data_criacao DESC;
        `;

        const { rows } = await db.query(sql, [localId]);
        res.json(rows);
    } catch (err) {
        console.error("Erro SQL:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/escola/confirmar-recebimento2/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("UPDATE pedido_remessas SET status = 'ENTREGUE' WHERE id = $1", [id]);
        res.json({ message: "Recebimento confirmado!" });
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

// --- FLUXO 1: PATRIMÔNIO (INDEPENDENTE) ---

// Detalhes exclusivos para Patrimônio
router.get('/escola/remessa/:id/detalhes-patrimonio', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT prod.nome, pat.numero_serie, 1 as quantidade_enviada
            FROM pedido_remessas pr
            JOIN patrimonios pat ON pat.pedido_id = pr.pedido_id
            JOIN produtos prod ON pat.produto_id = prod.id
            WHERE pr.id = $1`;
        const { rows } = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Confirmação exclusiva para Patrimônio (Exige setorId)
router.post('/escola/recebimento/confirmar-patrimonio', verificarToken, async (req, res) => {
    const { remessaId, pedidoId, setorId } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        // Apenas atualiza o setor onde o bem foi guardado e os status
        await client.query("UPDATE patrimonios SET setor_id = $1 WHERE pedido_id = $2", [setorId, pedidoId]);
        await client.query("UPDATE pedido_remessas SET status = 'RECEBIDO' WHERE id = $1", [remessaId]);
        await client.query("UPDATE pedidos SET status = 'RECEBIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);
        
        // Log de Histórico
        await client.query("INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_novo, observacao) VALUES ($1, $2, 'RECEBIDO', 'Bens alocados no setor.')", [pedidoId, req.user.id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
    finally { client.release(); }
});

// --- FLUXO 2: CONSUMO (MATERIAL / UNIFORMES) ---

// Detalhes para Material e Uniforme
router.get('/escola/remessa/:id/detalhes-consumo', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT prod.nome, COALESCE(pri.tamanho, '---') as detalhe, pri.quantidade_enviada
            FROM pedido_remessa_itens pri
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE pri.remessa_id = $1`;
        const { rows } = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Confirmação para Consumo (Atualiza estoque da escola)
router.post('/escola/recebimento/confirmar-consumo', verificarToken, async (req, res) => {
    const { remessaId, pedidoId } = req.body;
    try {
        // Apenas encerra o fluxo, sem mexer em saldo (já feito anteriormente)
        await db.query("UPDATE pedido_remessas SET status = 'RECEBIDO' WHERE id = $1", [remessaId]);
        await db.query("UPDATE pedidos SET status = 'RECEBIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

router.post('/impressoras/chamado', verificarToken, async (req, res) => {
    const { impressora_id, tipo, motivo, observacoes } = req.body;
    try {
        // Valida se já existe chamado ABERTO para esta impressora e TIPO
        const check = await db.query(
            "SELECT id FROM chamados_impressora WHERE impressora_id = $1 AND tipo = $2 AND status = 'ABERTO'",
            [impressora_id, tipo]
        );

        if (check.rowCount > 0) {
            return res.status(400).json({ error: `Já existe um chamado de ${tipo} em aberto para esta impressora.` });
        }

        await db.query(
            "INSERT INTO chamados_impressora (impressora_id, tipo, motivo, observacoes) VALUES ($1, $2, $3, $4)",
            [impressora_id, tipo, motivo, observacoes]
        );
        res.json({ message: "Solicitação registrada com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fechar chamado com cálculo automático de tempo
router.patch('/impressoras/fechar-chamado/:id', verificarToken, async (req, res) => {
    try {
        const query = `
            UPDATE chamados_impressora 
            SET status = 'FECHADO', 
                data_fechamento = NOW(),
                tempo_decorrido = NOW() - data_abertura
            WHERE id = $1
        `;
        await db.query(query, [req.params.id]);
        res.json({ message: "Chamado finalizado com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/impressoras/chamados/abertos', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, 
                c.tipo, 
                c.motivo, 
                c.observacoes, 
                c.data_abertura,
                i.modelo,
                l.nome as escola_nome
            FROM chamados_impressora c
            JOIN impressoras i ON c.impressora_id = i.id
            JOIN locais l ON i.local_id = l.id
            WHERE c.status = 'ABERTO'
            ORDER BY c.data_abertura ASC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/impressoras', verificarToken, async (req, res) => {
    const { local_id, modelo } = req.body;
    
    try {
        // Validação simples
        if (!local_id || !modelo) {
            return res.status(400).json({ error: "Local e modelo são obrigatórios." });
        }

        const query = "INSERT INTO impressoras (local_id, modelo) VALUES ($1, $2)";
        await db.query(query, [local_id, modelo]);
        
        res.json({ message: "Impressora cadastrada com sucesso!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao cadastrar impressora: " + err.message });
    }
});

router.get('/impressoras/dashboard-stats', verificarToken, async (req, res) => {
    const { inicio, fim } = req.query;
    try {
        const stats = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'FECHADO') as total_recargas,
                COUNT(*) FILTER (WHERE status = 'ABERTO') as total_abertos
            FROM chamados_impressora
            WHERE data_abertura::date BETWEEN $1 AND $2
        `, [inicio, fim]);

        const lista = await db.query(`
            SELECT 
                c.data_abertura,
                c.data_fechamento,
                l.nome as unidade,
                i.modelo,
                u.nome as tecnico,
                c.contador_encerramento as contador,
                c.relatorio_tecnico as obs
            FROM chamados_impressora c
            JOIN impressoras i ON c.impressora_id = i.id
            JOIN locais l ON i.local_id = l.id
            LEFT JOIN usuarios u ON c.tecnico_id = u.id
            WHERE c.status = 'FECHADO' AND c.data_fechamento::date BETWEEN $1 AND $2
            ORDER BY c.data_fechamento DESC
        `, [inicio, fim]);

        res.json({ stats: stats.rows[0], atendimentos: lista.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/impressoras/relatorio-geral', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                i.id,
                i.modelo,
                l.nome as local_nome,
                (SELECT tipo FROM chamados_impressora 
                 WHERE impressora_id = i.id AND status = 'ABERTO' 
                 LIMIT 1) as status_chamado
            FROM impressoras i
            JOIN locais l ON i.local_id = l.id
            ORDER BY l.nome ASC, i.modelo ASC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin-direto', verificarToken, async (req, res) => {
    const { local_destino_id, itens } = req.body; // itens = [{produto_id, qtd}]
    const cliente = await db.connect(); // Usamos 'connect' para garantir uma transação segura

    try {
        await cliente.query('BEGIN'); // Início da transação

        // 1. Cria o Pedido já APROVADO
        const pedidoRes = await cliente.query(
            `INSERT INTO pedidos (local_destino_id, status, usuario_origem_id, data_criacao) 
             VALUES ($1, 'APROVADO', $2, NOW()) RETURNING id`,
            [local_destino_id, req.usuario.id]
        );
        const pedidoId = pedidoRes.rows[0].id;

        // 2. Processa cada item: Baixa no estoque + Vínculo ao pedido
        for (let item of itens) {
            // Verifica se tem estoque e já subtrai (Baixa automática)
            const estoqueRes = await cliente.query(
                `UPDATE produtos_estoque 
                 SET quantidade_estoque = quantidade_estoque - $1 
                 WHERE id = $2 AND quantidade_estoque >= $1
                 RETURNING nome`,
                [item.quantidade, item.produto_id]
            );

            if (estoqueRes.rowCount === 0) {
                throw new Error(`Estoque insuficiente ou produto ID ${item.produto_id} não encontrado.`);
            }

            // Insere na tabela de itens do pedido
            await cliente.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade) VALUES ($1, $2, $3)`,
                [pedidoId, item.produto_id, item.quantidade]
            );
        }

        await cliente.query('COMMIT'); // Grava tudo no banco
        res.json({ message: "Pedido criado e estoque atualizado!", pedido_id: pedidoId });

    } catch (err) {
        await cliente.query('ROLLBACK'); // Cancela tudo em caso de erro
        res.status(500).json({ error: err.message });
    } finally {
        cliente.release();
    }
});

router.post('/pedidos/admin-direto-final', verificarToken, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { local_id, itens } = req.body;

        for (const it of itens) {
            const tipoRes = await client.query('SELECT tipo FROM produtos WHERE id = $1', [it.produto_id]);
            const tipo = tipoRes.rows[0].tipo;

            if (tipo === 'PATRIMONIO') {
                // REGRA PATRIMÔNIO: Atualiza localização e status do item individual
                // it.tamanho aqui carrega o ID da tabela patrimonios
                await client.query(
                    `UPDATE patrimonios 
                     SET local_id = $1, status = 'ALOCADO', data_ultima_movimentacao = NOW() 
                     WHERE id = $2`,
                    [local_id, it.tamanho] 
                );
            } 
            else if (tipo === 'UNIFORMES') {
                // REGRA UNIFORME: Baixa na grade
                await client.query(
                    `UPDATE estoque_grades SET quantidade = quantidade - $1 
                     WHERE produto_id = $2 AND tamanho = $3`,
                    [it.quantidade, it.produto_id, it.tamanho]
                );
                // Opcional: Trigger no banco deve atualizar o total em 'produtos'
            } 
            else {
                // REGRA MATERIAL: Baixa na quantidade geral
                await client.query(
                    `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 
                     WHERE id = $2`,
                    [it.quantidade, it.produto_id]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Movimentação concluída com sucesso!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

router.get('/estoque/consulta-patrimonio/:serie', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                pa.numero_serie,
                pa.status,
                pr.nome AS produto_nome,
                df.numero_doc,
                df.chave_nfe,
                to_char(pa.data_atualizacao, 'DD/MM/YYYY HH24:MI') as data_formatada
            FROM patrimonios pa
            JOIN produtos pr ON pa.produto_id = pr.id
            LEFT JOIN documentos_fiscais df ON pa.documento_id = df.id
            WHERE pa.numero_serie = $1
        `;
        const { rows } = await db.query(query, [req.params.serie]);

        if (rows.length === 0) return res.status(404).json({ error: "Patrimônio não encontrado." });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/estoque/historico-movimentacoes', verificarToken, async (req, res) => {
    const { usuario_id } = req.query;
    
    try {
        let filtroUser = usuario_id && usuario_id !== 'TODOS' ? `AND hm.usuario_id = ${usuario_id}` : '';
        
        const query = `
            SELECT 
                hm.id,
                p.nome as produto_nome,
                hm.quantidade,
                hm.tipo_movimentacao, 
                u.nome as usuario_nome,
                to_char(hm.data_movimentacao, 'DD/MM/YYYY HH24:MI') as data_formatada,
                hm.observacao
            FROM historico_movimentacoes hm
            JOIN produtos p ON hm.produto_id = p.id
            JOIN usuarios u ON hm.usuario_id = u.id
            WHERE 1=1 ${filtroUser}
            ORDER BY hm.data_movimentacao DESC
            LIMIT 150
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar histórico: " + err.message });
    }
});

router.get('/auth/sincronizar-identidade', verificarToken, async (req, res) => {
    try {
        // Buscamos o usuário, o local dele e o perfil real gravado no banco
        const result = await db.query(`
            SELECT 
                u.id, 
                u.nome, 
                u.perfil, 
                u.local_id, 
                l.nome as local_nome 
            FROM usuarios u 
            LEFT JOIN locais l ON u.local_id = l.id
            WHERE u.id = $1
        `, [req.usuario.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // Retornamos um objeto completo para o frontend "se localizar"
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro na sincronização: " + err.message });
    }
});

// CADASTRO DE CATEGORIA
router.post('/categorias', verificarToken, verificarPerfil(['admin', 'dti']), async (req, res) => {
    const { nome } = req.body;
    try {
        await db.query("INSERT INTO categorias (nome) VALUES ($1)", [nome.toUpperCase()]);
        res.json({ message: "Categoria cadastrada com sucesso!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/categorias', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id, nome FROM categorias ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar categorias:", err);
        res.status(500).json({ error: "Erro ao listar categorias do banco de dados." });
    }
});

// CADASTRO DE LOCAL
router.post('/locais', verificarToken, async (req, res) => {
    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ error: "O nome do local é obrigatório." });
    }

    try {
        // Inserimos o nome sempre em MAIÚSCULAS para manter o padrão do banco
        await db.query("INSERT INTO locais (nome) VALUES ($1)", [nome.toUpperCase().trim()]);
        res.json({ message: "Local cadastrado com sucesso!" });
    } catch (err) {
        // Tratamento para o erro de Unique Constraint (Código 23505 no Postgres)
        if (err.code === '23505') {
            return res.status(400).json({ error: "Este local/escola já está cadastrado no sistema." });
        }
        res.status(500).json({ error: "Erro ao salvar no banco: " + err.message });
    }
});

// CADASTRO DE SETOR
router.post('/setores', verificarToken, verificarPerfil(['admin', 'dti']), async (req, res) => {
    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ error: "O nome do setor é obrigatório." });
    }

    try {
        // Padronização para evitar "Secretaria" e "SECRETARIA" como duplicados
        await db.query("INSERT INTO setores (nome) VALUES ($1)", [nome.toUpperCase().trim()]);
        res.json({ message: "Setor cadastrado com sucesso!" });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Este setor já existe no sistema." });
        }
        res.status(500).json({ error: "Erro ao salvar setor: " + err.message });
    }
});

router.get('/locais/lista-geral', verificarToken, async (req, res) => {
    try {
        // Buscamos apenas ID e NOME para ser leve e rápido
        const query = "SELECT id, nome FROM locais ORDER BY nome ASC";
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar locais:", err);
        res.status(500).json({ error: "Erro interno ao buscar locais" });
    }
});

router.get('/estoque/patrimonio/:serie', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                pa.*, 
                pr.nome as produto_nome, 
                l.nome as local_nome, 
                s.nome as setor_nome,
                df.numero_doc as nf_numero
            FROM patrimonios pa
            JOIN produtos pr ON pa.produto_id = pr.id
            LEFT JOIN locais l ON pa.local_id = l.id
            LEFT JOIN setores s ON pa.setor_id = s.id
            LEFT JOIN documentos_fiscais df ON pa.documento_id = df.id
            WHERE pa.numero_serie = $1
        `;
        const { rows } = await db.query(query, [req.params.serie.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ error: "Património não encontrado." });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/estoque/transferir-patrimonio', verificarToken, async (req, res) => {
    const { patrimonio_id, produto_id, novo_local_id, novo_setor_id, observacao } = req.body;
    const cliente = await db.connect();

    try {
        await cliente.query('BEGIN');

        // Atualiza a localização do item
        await cliente.query(
            "UPDATE patrimonios SET local_id = $1, setor_id = $2, data_atualizacao = now() WHERE id = $3",
            [novo_local_id, novo_setor_id, patrimonio_id]
        );

        // Grava no histórico de movimentações para auditoria
        await cliente.query(
            `INSERT INTO historico_movimentacoes (produto_id, quantidade, tipo_movimentacao, usuario_id, observacao) 
             VALUES ($1, 1, 'TRANSFERENCIA', $2, $3)`,
            [produto_id, req.usuario.id, observacao]
        );

        await cliente.query('COMMIT');
        res.json({ message: "Transferência concluída e registada no histórico!" });
    } catch (err) {
        await cliente.query('ROLLBACK');
        res.status(500).json({ error: "Erro na transferência: " + err.message });
    } finally { cliente.release(); }
});

router.get('/estoque/inventario/:local_id', verificarToken, async (req, res) => {
    const { local_id } = req.params;
    try {
        const query = `
            SELECT 
                p.nome as produto_nome,
                pa.numero_serie,
                s.nome as setor_nome,
                pa.status,
                to_char(pa.data_atualizacao, 'DD/MM/YYYY') as ultima_movimentacao
            FROM patrimonios pa
            JOIN produtos p ON pa.produto_id = p.id
            LEFT JOIN setores s ON pa.setor_id = s.id
            WHERE pa.local_id = $1
            ORDER BY s.nome ASC, p.nome ASC
        `;
        const { rows } = await db.query(query, [local_id]);
        
        // Buscamos o nome do local para o cabeçalho do relatório
        const localNome = await db.query("SELECT nome FROM locais WHERE id = $1", [local_id]);
        
        res.json({
            unidade: localNome.rows[0]?.nome || "Não Localizado",
            total_itens: rows.length,
            itens: rows
        });
    } catch (err) {
        res.status(500).json({ error: "Erro ao gerar inventário: " + err.message });
    }
});

router.post('/estoque/baixa-patrimonio', verificarToken, verificarPerfil(['admin', 'dti']), async (req, res) => {
    const { patrimonio_id, produto_id, motivo_especifico, observacao } = req.body;
    const cliente = await db.connect();

    try {
        await cliente.query('BEGIN');

        // 1. Atualiza o status para 'INSERVÍVEL'
        // Certifique-se de que o enum 'status_patrimonio_enum' aceita este valor
        await cliente.query(
            "UPDATE patrimonios SET status = 'INSERVÍVEL', data_atualizacao = now() WHERE id = $1",
            [patrimonio_id]
        );

        // 2. Regista a Baixa no Histórico para Auditoria
        const msgHistorico = `BAIXA POR MOTIVO: ${motivo_especifico}. OBS: ${observacao}`;
        await cliente.query(
            `INSERT INTO historico_movimentacoes (produto_id, quantidade, tipo_movimentacao, usuario_id, observacao) 
             VALUES ($1, 1, 'BAIXA', $2, $3)`,
            [produto_id, req.usuario.id, msgHistorico.toUpperCase()]
        );

        await cliente.query('COMMIT');
        res.json({ message: "O item foi marcado como INSERVÍVEL e retirado do inventário ativo." });
    } catch (err) {
        await cliente.query('ROLLBACK');
        res.status(500).json({ error: "Erro ao processar baixa: " + err.message });
    } finally {
        cliente.release();
    }
});

router.get('/estoque/baixas/resumo-anual', verificarToken, verificarPerfil(['admin', 'dti']), async (req, res) => {
    try {
        const query = `
            SELECT 
                c.nome as categoria,
                EXTRACT(YEAR FROM hm.data_movimentacao) as ano,
                COUNT(*) as total_itens,
                string_agg(DISTINCT hm.observacao, ' | ') as motivos_comuns
            FROM historico_movimentacoes hm
            JOIN produtos p ON hm.produto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            WHERE hm.tipo_movimentacao = 'BAIXA'
            GROUP BY c.nome, ano
            ORDER BY ano DESC, total_itens DESC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar resumo de baixas: " + err.message });
    }
});

router.get('/impressoras/estatisticas', verificarToken, async (req, res) => {
    const { inicio, fim } = req.query;

    try {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE tipo = 'RECARGA' AND data_abertura >= $1 AND data_abertura <= $2) as total_recargas,
                COUNT(*) FILTER (WHERE status = 'ABERTO') as total_abertos,
                AVG(data_conclusao - data_abertura) FILTER (WHERE status = 'CONCLUIDO' AND data_abertura >= $1 AND data_abertura <= $2) as tempo_medio
            FROM chamados_impressora
        `;
        
        const { rows } = await db.query(query, [inicio, fim]);
        
        // Formata o intervalo de tempo para algo legível (ex: "2 dias 04:30")
        const stats = rows[0];
        res.json({
            total_recargas: stats.total_recargas || 0,
            total_abertos: stats.total_abertos || 0,
            tempo_medio: stats.tempo_medio ? formatarIntervalo(stats.tempo_medio) : "N/A"
        });
    } catch (err) {
        res.status(500).json({ error: "Erro ao calcular estatísticas: " + err.message });
    }
});

router.patch('/impressoras/concluir-chamado/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { contador_encerramento, relatorio_tecnico } = req.body;

        // Tenta pegar o ID de várias formas comuns (id, userId, sub)
        const tecnicoId = req.user?.id || req.user?.userId || req.user?.sub;

        if (!tecnicoId) {
            console.error("DEBUG: Objeto req.user veio vazio ou sem ID:", req.user);
            return res.status(401).json({ error: "Sessão expirada ou usuário não identificado." });
        }

        const query = `
            UPDATE chamados_impressora 
            SET status = 'FECHADO', 
                data_fechamento = NOW(),
                contador_encerramento = $1,
                relatorio_tecnico = $2,
                tecnico_id = $3
            WHERE id = $4 AND status = 'ABERTO'
        `;
        
        const result = await db.query(query, [contador_encerramento, relatorio_tecnico, tecnicoId, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Chamado não encontrado ou já está fechado." });
        }
        
        res.json({ message: "Chamado finalizado com sucesso!" });
    } catch (err) {
        console.error("ERRO NO BACK-END:", err.message);
        res.status(500).json({ error: "Erro interno: " + err.message });
    }
});

router.patch('/impressoras/v2/finalizar-recarga/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { contador, relatorio, usuario_id } = req.body;

    try {
        // Prioridade para o ID que vem do Front-end, depois o do Token
        const tecnicoId = usuario_id || req.user?.id || req.usuario?.id;

        if (!tecnicoId) {
            return res.status(401).json({ error: "Identificação do técnico não encontrada." });
        }

        const query = `
            UPDATE chamados_impressora 
            SET status = 'FECHADO', 
                data_fechamento = NOW(),
                contador_encerramento = $1,
                relatorio_tecnico = $2,
                tecnico_id = $3
            WHERE id = $4 AND status = 'ABERTO'
        `;
        
        const result = await db.query(query, [
            parseInt(contador), 
            relatorio || 'Recarga realizada.', 
            tecnicoId, 
            id
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Chamado não encontrado ou já fechado." });
        }

        res.json({ message: "Recarga registrada com sucesso!" });
    } catch (err) {
        console.error("Erro ao gravar recarga:", err.message);
        res.status(500).json({ error: "Erro no banco: " + err.message });
    }
});

router.get('/impressoras/comparativo-rendimento', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                l.nome as unidade,
                COUNT(c.id) as total_atendimentos,
                SUM(c.contador_encerramento) as volume_total
            FROM chamados_impressora c
            JOIN impressoras i ON c.impressora_id = i.id
            JOIN locais l ON i.local_id = l.id
            WHERE c.status = 'FECHADO'
            GROUP BY l.nome
            ORDER BY total_atendimentos DESC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar comparativo: " + err.message });
    }
});

router.get('/impressoras/local/:localId', verificarToken, async (req, res) => {
    try {
        const { localId } = req.params;
        console.log(`[SQL Query] Buscando impressoras para local_id: ${localId}`);

        const result = await db.query(
            "SELECT id, modelo, local_id FROM impressoras WHERE local_id = $1", 
            [parseInt(localId)]
        );

        console.log(`[SQL Result] Encontradas ${result.rowCount} impressoras.`);
        res.json(result.rows);
    } catch (err) {
        console.error("ERRO CRÍTICO NA ROTA:", err.message);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

router.get('/impressoras/fila-atendimento', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, 
                c.tipo, 
                c.motivo, 
                c.observacoes, 
                TO_CHAR(c.data_abertura, 'DD/MM/YY HH24:MI') as data_formatada,
                i.modelo as impressora_modelo,
                l.nome as unidade_nome,
                u.nome as solicitado_por
            FROM chamados_impressora c
            JOIN impressoras i ON c.impressora_id = i.id
            JOIN locais l ON i.local_id = l.id
            -- Usando tecnico_id para identificar o solicitante, conforme sua estrutura
            LEFT JOIN usuarios u ON c.tecnico_id = u.id
            WHERE c.status = 'ABERTO'
            ORDER BY c.data_abertura ASC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar fila:", err);
        res.status(500).json({ error: "Erro interno ao carregar a fila." });
    }
});

router.get('/impressoras/relatorio-consumo', verificarToken, async (req, res) => {
    try {
        const query = `
            WITH UltimasLeituras AS (
                SELECT 
                    c.impressora_id,
                    c.contador_encerramento,
                    c.data_fechamento,
                    ROW_NUMBER() OVER (PARTITION BY c.impressora_id ORDER BY c.data_fechamento DESC) as ordem
                FROM chamados_impressora c
                WHERE c.status = 'FECHADO' AND c.contador_encerramento > 0
            )
            SELECT 
                l.nome as unidade,
                i.modelo,
                u1.contador_encerramento as ultima_leitura,
                u1.data_fechamento as data_ultima,
                u2.contador_encerramento as penultima_leitura,
                u2.data_fechamento as data_penultima
            FROM UltimasLeituras u1
            JOIN UltimasLeituras u2 ON u1.impressora_id = u2.impressora_id 
                                   AND u2.ordem = u1.ordem + 1
            JOIN impressoras i ON u1.impressora_id = i.id
            JOIN locais l ON i.local_id = l.id
            ORDER BY u1.data_fechamento DESC;
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao gerar relatório de consumo." });
    }
});

router.get('/estoque/materiais-e-patrimonios', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                id, 
                nome, 
                tipo, 
                COALESCE(quantidade_estoque, 0) as saldo, 
                COALESCE(alerta_minimo, 0) as minimo
            FROM produtos 
            WHERE tipo IN ('MATERIAL', 'PATRIMONIO')
            ORDER BY tipo DESC, nome ASC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar materiais: " + err.message });
    }
});

router.get('/estoque/historico/lista', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                h.id, h.data, h.acao, h.quantidade_total, h.tipo, h.observacoes,
                u.nome as usuario_nome,
                l.nome as local_nome
            FROM historico h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            LEFT JOIN locais l ON h.local_id = l.id
            ORDER BY h.data DESC LIMIT 100
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar lista de histórico." });
    }
});

router.get('/estoque/historico/detalhes/:id', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                hd.quantidade, hd.tamanho, hd.tipo_produto,
                p.nome as produto_nome
            FROM historico_detalhes hd
            JOIN produtos p ON hd.produto_id = p.id
            WHERE hd.historico_id = $1
        `;
        const { rows } = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar detalhes do histórico." });
    }
});

router.get('/admin/dashboard/stats', verificarToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                COUNT(*) FILTER (WHERE status = 'AGUARDANDO_AUTORIZACAO') as solicitado,
                COUNT(*) FILTER (WHERE status = 'APROVADO') as autorizado,
                COUNT(*) FILTER (WHERE status = 'EM_SEPARACAO') as separacao,
                COUNT(*) FILTER (WHERE status = 'COLETA_LIBERADA') as pronto,
                COUNT(*) FILTER (WHERE status = 'EM_TRANSPORTE') as transporte,
                -- Consolidação de Entregue + Recebido
                COUNT(*) FILTER (WHERE status IN ('ENTREGUE', 'RECEBIDO')) as entregue,
                -- Contagem individual de bens (Patrimônios) nos estados de trânsito
                (SELECT COUNT(*) FROM patrimonios WHERE local_id = 50) as transferencia_50,
                (SELECT COUNT(*) FROM patrimonios WHERE local_id = 51) as transito_51
            FROM pedidos;
        `;
        const { rows } = await db.query(sql);
        const s = rows[0];

        res.json({
            qtd_solicitado: s.solicitado,
            qtd_autorizado: s.autorizado,
            qtd_separacao: s.separacao,
            qtd_pronto: s.pronto,
            qtd_transporte: s.transporte,
            qtd_entregue: s.entregue,
            qtd_transferencia: s.transferencia_50,
            qtd_limbo: s.transito_51
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/estoque/produto/:id/grades', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT tamanho, quantidade 
            FROM estoque_grades 
            WHERE produto_id = $1 AND quantidade > 0
            ORDER BY tamanho ASC
        `;
        const { rows } = await db.query(query, [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar grade: " + err.message });
    }
});

router.get('/estoque/produtos-por-tipo/:tipo', verificarToken, async (req, res) => {
    try {
        const { tipo } = req.params;
        // Se for UNIFORME, verificamos se há saldo em QUALQUER grade. 
        // Se for MATERIAL/PATRIMONIO, olhamos a quantidade_estoque direta.
        const query = tipo === 'UNIFORMES' 
            ? `SELECT DISTINCT p.id, p.nome, p.tipo 
               FROM produtos p 
               JOIN estoque_grades eg ON p.id = eg.produto_id 
               WHERE p.tipo = 'UNIFORMES' AND eg.quantidade > 0 
               ORDER BY p.nome ASC`
            : `SELECT id, nome, tipo, quantidade_estoque as saldo 
               FROM produtos 
               WHERE tipo = $1 AND quantidade_estoque > 0 
               ORDER BY nome ASC`;

        const { rows } = await db.query(query, tipo === 'UNIFORMES' ? [] : [tipo]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/estoque/patrimonios-disponiveis/:produto_id', verificarToken, async (req, res) => {
    try {
        const { produto_id } = req.params;
        const query = `
            SELECT id, plaqueta, numero_serie 
            FROM patrimonios 
            WHERE produto_id = $1 AND status = 'DISPONIVEL'
            ORDER BY plaqueta ASC
        `;
        const { rows } = await db.query(query, [produto_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao procurar plaquetas." });
    }
});

router.post('/pedidos/admin/finalizar/uniformes', verificarToken, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { local_id, itens } = req.body;
        const usuario_id = req.user.id;

        // 1. Cria o Pedido Mestre
        const resPed = await client.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
             VALUES ($1, $2, 'AUTORIZADO', 'UNIFORMES') RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        // 2. Processa cada item do carrinho
        for (const it of itens) {
            // Insere o item vinculado ao pedido
            await client.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, tamanho) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );

            // Baixa no estoque da grade específica
            const resUpdate = await client.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3 AND quantidade >= $1`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            if (resUpdate.rowCount === 0) {
                throw new Error(`Estoque insuficiente para o produto ID ${it.produto_id} tamanho ${it.tamanho}`);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Pedido de Uniformes finalizado!", id: pedidoId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post('/pedidos/admin/finalizar/materiais', verificarToken, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { local_id, itens } = req.body;
        const resPed = await client.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
             VALUES ($1, $2, 'AUTORIZADO', 'MATERIAL') RETURNING id`, [req.user.id, local_id]
        );
        for (const it of itens) {
            await client.query(`UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2`, [it.quantidade, it.produto_id]);
        }
        await client.query('COMMIT');
        res.json({ message: "Sucesso" });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).send(err.message); } finally { client.release(); }
});

router.post('/pedidos/admin/finalizar/patrimonios', verificarToken, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { local_id, itens } = req.body;
        const resPed = await client.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
             VALUES ($1, $2, 'RECEBIDO', 'PATRIMONIO') RETURNING id`, [req.user.id, local_id]
        );
        for (const it of itens) {
            await client.query(`UPDATE patrimonios SET local_id = $1, status = 'ALOCADO' WHERE id = $2`, [local_id, it.patrimonio_id]);
        }
        await client.query('COMMIT');
        res.json({ message: "Sucesso" });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).send(err.message); } finally { client.release(); }
});

router.get('/estoque/produtos-por-tipo/UNIFORMES', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT p.id, p.nome 
            FROM produtos p
            INNER JOIN estoque_grades eg ON p.id = eg.produto_id
            WHERE p.tipo = 'UNIFORMES' AND eg.quantidade > 0
            ORDER BY p.nome ASC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao filtrar uniformes." });
    }
});

router.post('/pedidos/admin/v2/uniformes', verificarToken, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { local_id, itens } = req.body;
        const usuario_id = req.user.id; // Certifique-se que o token está enviando o ID

        console.log("LOG: Iniciando pedido para local:", local_id);

        // 1. Inserir na tabela pedidos
        // Verificamos os nomes das colunas conforme seu \d pedidos
        const queryPedido = `
            INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
            VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'UNIFORMES') 
            RETURNING id
        `;
        const resPed = await client.query(queryPedido, [usuario_id, local_id]);
        const pedidoId = resPed.rows[0].id;
        console.log("LOG: Pedido criado ID:", pedidoId);

        for (const it of itens) {
            console.log(`LOG: Processando item ${it.produto_id} tam ${it.tamanho}`);

            // 2. Inserir em pedido_itens (conforme seu \d pedido_itens)
            await client.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, tamanho) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );

            // 3. Baixa na Grade (conforme seu \d estoque_grades)
            const resGrade = await client.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3 AND quantidade >= $1`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            if (resGrade.rowCount === 0) {
                throw new Error(`Estoque insuficiente na grade para o item ${it.nome} (${it.tamanho})`);
            }

            // 4. Baixa no Total (conforme seu \d produtos)
            await client.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2`,
                [it.quantidade, it.produto_id]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Sucesso!" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NO BANCO:", err.message);
        // Enviamos o erro real como JSON para o frontend ler
        res.status(500).json({ error: err.message }); 
    } finally {
        client.release();
    }
});

router.post('/pedidos/admin/uniformes/finalizar', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        const usuario_id = req.user.id;

        // 1. Inicia a transação
        await db.query('BEGIN');

        // 2. Criar o cabeçalho do pedido
        const queryPedido = `
            INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido) 
            VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'UNIFORMES') 
            RETURNING id
        `;
        const resPed = await db.query(queryPedido, [usuario_id, local_id]);
        const pedidoId = resPed.rows[0].id;

        // 3. Processar os itens
        for (const it of itens) {
            // Grava o item no pedido
            await db.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, tamanho) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );

            // Baixa na Grade (estoque_grades)
            await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            // Baixa no Saldo Geral (produtos)
            await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = quantidade_estoque - $1 
                 WHERE id = $2`,
                [it.quantidade, it.produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Pedido gravado!" });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("ERRO NO BANCO:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/uniformes/direto', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        const usuario_id = (req.user && req.user.id) ? req.user.id : 1; 

        await db.query('BEGIN');

        // 1. Criar o Pedido com status 'AGUARDANDO_SEPARACAO'
        // Este é o status que faz o pedido aparecer na tua lista de separação
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_SEPARACAO', 'UNIFORMES', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        for (const it of itens) {
            // 2. REGISTRO DE ITENS: Crucial para a tela de Conferência
            // quantidade_solicitada = Total do Admin / quantidade (já enviado) = 0
            await db.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, quantidade, tamanho) 
                 VALUES ($1, $2, $3, 0, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );

            // 3. BAIXA NO ESTOQUE: Exatamente como na tua função 'finalizarAutorizacao'
            await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            // 4. ATUALIZA TOTAL GERAL
            await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = (SELECT SUM(quantidade) FROM estoque_grades WHERE produto_id = $1)
                 WHERE id = $1`,
                [it.produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Pedido criado e autorizado!" });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO NO FLUXO ADMIN:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/uniformes/finalizar-v3', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        
        // CORREÇÃO DO ERRO 'undefined id':
        // Se o req.user falhar, pegamos o ID 1 (Admin padrão) para não travar o processo
        const usuario_id = (req.user && req.user.id) ? req.user.id : 1; 

        console.log("LOG: Iniciando gravação para local:", local_id, "Usuário:", usuario_id);

        // Iniciamos a transação usando db.query direto (sem .connect())
        await db.query('BEGIN');

        // 1. Criar o Pedido com status 'SEPARACAO_INICIADA'
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_SEPARACAO', 'UNIFORMES', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        for (const it of itens) {
            // 2. Inserir em pedido_itens (usando colunas confirmadas: quantidade_solicitada e quantidade)
            await db.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, quantidade, tamanho) 
                 VALUES ($1, $2, $3, $3, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );

            // 3. Baixa na Grade (estoque_grades)
            await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            // 4. Baixa no Total (produtos)
            await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = quantidade_estoque - $1 
                 WHERE id = $2`,
                [it.quantidade, it.produto_id]
            );
        }

        await db.query('COMMIT');
        console.log("LOG: Pedido gravado com sucesso. ID:", pedidoId);
        res.json({ success: true, message: "Pedido enviado para separação!" });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO FINAL NO BANCO:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/gerar-solicitacao', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        const usuario_id = req.user.id;

        await db.query('BEGIN');

        // 1. Cria o Pedido (Status: AGUARDANDO_AUTORIZACAO)
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'UNIFORMES', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        // 2. Insere os itens (Obrigatório para a tela de análise/separação ler)
        for (const it of itens) {
            await db.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, quantidade, tamanho) 
                 VALUES ($1, $2, $3, 0, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, pedidoId }); // Retorna o ID para o front autorizar

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/direto/uniformes-exclusivo', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        
        // Proteção contra o erro de 'undefined id' que vimos no log
        const usuario_id = (req.user && req.user.id) ? req.user.id : 1; 

        await db.query('BEGIN');

        // 1. Cria o registro na tabela pedidos
        // Status 'AGUARDANDO_SEPARACAO' faz ele aparecer na lista do estoque
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_SEPARACAO', 'UNIFORMES', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        for (const it of itens) {
            // 2. GRAVAÇÃO NA pedido_itens: Isso é o que faz os produtos aparecerem na tela de separação
            // quantidade_solicitada recebe o valor, e quantidade (enviada) começa em 0
            await db.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada, quantidade, tamanho) 
                 VALUES ($1, $2, $3, 0, $4)`,
                [pedidoId, it.produto_id, it.quantidade, it.tamanho]
            );

            // 3. BAIXA NA GRADE: Atualiza o saldo real da grade (estoque_grades)
            await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            // 4. SINCRONIZAÇÃO: Atualiza o total na tabela produtos
            await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = (SELECT SUM(quantidade) FROM estoque_grades WHERE produto_id = $1)
                 WHERE id = $1`,
                [it.produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Pedido direto criado com sucesso!" });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO ROTA EXCLUSIVA:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/uniformes/concluir-direto', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        const usuario_id = (req.user && req.user.id) ? req.user.id : 1; 

        await db.query('BEGIN');

        // 1. Criar o Pedido (Status AGUARDANDO_SEPARACAO para cair na lista do estoque)
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_SEPARACAO', 'UNIFORMES', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        for (const it of itens) {
            // 2. O PONTO CHAVE: Gravar na itens_pedido (a tabela que você confirmou que funciona)
            await db.query(
                `INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, it.produto_id, it.tamanho, it.quantidade]
            );

            // 3. BAIXA NA GRADE: Atualiza o saldo real da grade
            await db.query(
                `UPDATE estoque_grades 
                 SET quantidade = quantidade - $1 
                 WHERE produto_id = $2 AND tamanho = $3`,
                [it.quantidade, it.produto_id, it.tamanho]
            );

            // 4. SINCRONIZAÇÃO: Atualiza o total na tabela produtos (já que o sistema não faz sozinho)
            await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = (SELECT SUM(quantidade) FROM estoque_grades WHERE produto_id = $1)
                 WHERE id = $1`,
                [it.produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Pedido criado e estoque atualizado!" });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO NO BANCO:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/materiais/concluir-direto', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        const usuario_id = (req.user && req.user.id) ? req.user.id : 1; 

        await db.query('BEGIN');

        // 1. Criar o Pedido
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_SEPARACAO', 'MATERIAL', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        for (const it of itens) {
            // 2. Gravar na itens_pedido (Para o estoque conseguir visualizar na separação)
            // Usamos 'UNICO' no tamanho para não deixar o campo vazio
            await db.query(
                `INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) 
                 VALUES ($1, $2, 'UNICO', $3)`,
                [pedidoId, it.produto_id, it.quantidade]
            );

            // 3. BAIXA DIRETA NO ESTOQUE: Como não há grade, alteramos direto na tabela produtos
            const resBaixa = await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = quantidade_estoque - $1 
                 WHERE id = $2 AND quantidade_estoque >= $1`,
                [it.quantidade, it.produto_id]
            );

            if (resBaixa.rowCount === 0) {
                throw new Error(`Estoque insuficiente para o produto ID ${it.produto_id}`);
            }
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Pedido de materiais criado com sucesso!" });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO MATERIAIS:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/patrimonio/concluir-direto', verificarToken, async (req, res) => {
    try {
        const { local_id, itens } = req.body;
        const usuario_id = (req.user && req.user.id) ? req.user.id : 1; 

        await db.query('BEGIN');

        // 1. Criar o Pedido Mestre
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_SEPARACAO', 'PATRIMONIO', NOW()) 
             RETURNING id`,
            [usuario_id, local_id]
        );
        const pedidoId = resPed.rows[0].id;

        for (const it of itens) {
            // 2. Gravar na itens_pedido (Necessário para a tela de separação)
            // Vinculamos o patrimonio_id para que o estoquista saiba qual plaqueta pegar
            await db.query(
                `INSERT INTO itens_pedido (pedido_id, produto_id, patrimonio_id, quantidade, tamanho) 
                 VALUES ($1, $2, $3, 1, 'TAG')`,
                [pedidoId, it.produto_id, it.patrimonio_id]
            );

            // 3. ATUALIZAR STATUS DO BEM: Marca como 'EM_TRANSFERENCIA' ou similar
            // Impede que o mesmo item seja pedido por outra pessoa
            await db.query(
                `UPDATE patrimonios 
                 SET status = 'EM_TRANSFERENCIA', 
                     data_ultima_movimentacao = NOW() 
                 WHERE id = $1`,
                [it.patrimonio_id]
            );

            // 4. BAIXA NO SALDO GERAL: Diminui 1 unidade do total do produto
            await db.query(
                `UPDATE produtos 
                 SET quantidade_estoque = quantidade_estoque - 1 
                 WHERE id = $1`,
                [it.produto_id]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Pedido de Patrimônio registrado e bens reservados!" });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO PATRIMONIO:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/admin/devolucoes/pendentes', verificarToken, async (req, res) => {
    try {
        const resList = await db.query(`
            SELECT p.*, l.nome as escola_nome, u.nome as solicitante 
            FROM pedidos p
            JOIN locais l ON p.usuario_origem_id = l.id
            JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE p.tipo_pedido = 'DEVOLUCAO' AND p.status = 'DEVOLUCAO_PENDENTE'
            ORDER BY p.data_criacao DESC`);
        res.json(resList.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pedidos/estoque/devolucoes/para-receber', verificarToken, async (req, res) => {
    try {
        const resList = await db.query(`
            SELECT p.*, l.nome as escola_nome 
            FROM pedidos p
            JOIN locais l ON p.usuario_origem_id = l.id
            WHERE p.tipo_pedido = 'DEVOLUCAO' AND p.status = 'DEVOLUCAO_EM_TRANSITO'
            ORDER BY p.data_criacao ASC`);
        res.json(resList.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pedidos/logistica/devolucoes/para-coletar', verificarToken, async (req, res) => {
    try {
        const resList = await db.query(`
            SELECT p.*, l.nome as escola_nome 
            FROM pedidos p
            JOIN locais l ON p.usuario_origem_id = l.id
            WHERE p.tipo_pedido = 'DEVOLUCAO' AND p.status = 'DEVOLUCAO_AUTORIZADA'
            ORDER BY p.data_criacao ASC`);
        res.json(resList.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pedidos/admin/devolucoes/confirmar', verificarToken, async (req, res) => {
    try {
        const { pedidoId } = req.body;
        await db.query('BEGIN');

        // 1. Busca os itens da devolução na tabela que confirmamos (itens_pedido)
        const itens = await db.query('SELECT * FROM itens_pedido WHERE pedido_id = $1', [pedidoId]);

        for (const it of itens.rows) {
            // 2. Se for Uniforme (tem tamanho específico), aumenta na grade
            if (it.tamanho && it.tamanho !== 'UNICO' && it.tamanho !== 'TAG') {
                await db.query(
                    `UPDATE estoque_grades SET quantidade = quantidade + $1 
                     WHERE produto_id = $2 AND tamanho = $3`,
                    [it.quantidade, it.produto_id, it.tamanho]
                );
            }

            // 3. Em todos os casos, aumenta o saldo global na tabela produtos
            await db.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 
                 WHERE id = $2`,
                [it.quantidade, it.produto_id]
            );
        }

        // 4. Finaliza o status do pedido
        await db.query("UPDATE pedidos SET status = 'CONCLUIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);

        await db.query('COMMIT');
        res.json({ success: true, message: "Itens incorporados ao estoque com sucesso!" });
    } catch (err) {
        if (db) await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/estoque/devolucao/detalhes/:pedidoId', verificarToken, async (req, res) => {
    try {
        const { pedidoId } = params;
        const query = `
            SELECT i.*, p.nome as produto_nome 
            FROM itens_pedido i
            JOIN produtos p ON i.produto_id = p.id
            WHERE i.pedido_id = $1`;
        const result = await db.query(query, [pedidoId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/estoque/devolucao/confirmar-final', verificarToken, async (req, res) => {
    try {
        const { pedidoId, itensConferidos } = req.body; // itensConferidos: [{id, quantidade_real}]
        await db.query('BEGIN');

        for (const it of itensConferidos) {
            // 1. Busca os dados originais do item para saber produto e tamanho
            const resItem = await db.query('SELECT * FROM itens_pedido WHERE id = $1', [it.id]);
            const original = resItem.rows[0];

            // 2. Atualiza a quantidade na itens_pedido para o que foi realmente recebido
            await db.query('UPDATE itens_pedido SET quantidade = $1 WHERE id = $2', [it.quantidade_real, it.id]);

            // 3. Atualiza o ESTOQUE REAL (Grade e Global)
            if (original.tamanho && original.tamanho !== 'UNICO' && original.tamanho !== 'TAG') {
                await db.query(
                    `UPDATE estoque_grades SET quantidade = quantidade + $1 
                     WHERE produto_id = $2 AND tamanho = $3`,
                    [it.quantidade_real, original.produto_id, original.tamanho]
                );
            }

            await db.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2`,
                [it.quantidade_real, original.produto_id]
            );
        }

        // 4. Finaliza o status do pedido
        await db.query("UPDATE pedidos SET status = 'CONCLUIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);

        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        if (db) await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/devolucoes/autorizar', verificarToken, async (req, res) => {
    try {
        const { pedidoId } = req.body;
        // Usando o status permitido: DEVOLUCAO_AUTORIZADA
        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_AUTORIZADA' WHERE id = $1", [pedidoId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pedidos/logistica/devolucoes/coletar', verificarToken, async (req, res) => {
    try {
        const { pedidoId } = req.body;
        // Usando o status permitido: DEVOLUCAO_EM_TRANSITO
        await db.query("UPDATE pedidos SET status = 'DEVOLUCAO_EM_TRANSITO' WHERE id = $1", [pedidoId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pedidos/estoque/devolucoes/finalizar-recebimento', verificarToken, async (req, res) => {
    try {
        const { pedidoId, itensConferidos } = req.body; 
        await db.query('BEGIN');

        for (const it of itensConferidos) {
            // 1. Atualiza a itens_pedido com a quantidade REAL contada pelo estoquista
            await db.query('UPDATE itens_pedido SET quantidade = $1 WHERE id = $2', [it.quantidade_real, it.id]);

            // 2. Incrementa o estoque na grade (se houver tamanho)
            if (it.tamanho && it.tamanho !== 'UNICO' && it.tamanho !== 'TAG') {
                await db.query(
                    `UPDATE estoque_grades SET quantidade = quantidade + $1 
                     WHERE produto_id = $2 AND tamanho = $3`,
                    [it.quantidade_real, it.produto_id, it.tamanho]
                );
            }

            // 3. Incrementa o saldo global do produto
            await db.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 
                 WHERE id = $2`,
                [it.quantidade_real, it.produto_id]
            );
        }

        // 4. Finaliza com o status permitido: DEVOLVIDO
        await db.query("UPDATE pedidos SET status = 'DEVOLVIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);

        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) { if (db) await db.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

router.post('/pedidos/escola/solicitar-devolucao', verificarToken, async (req, res) => {
    try {
        const { itens } = req.body;
        const escolaId = req.user.local_id || req.user.id;
        const usuarioId = req.user.id;

        await db.query('BEGIN');

        // 1. Cria o registro na tabela pedidos com o status que o banco exige
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'DEVOLUCAO_PENDENTE', 'DEVOLUCAO', NOW()) 
             RETURNING id`,
            [usuarioId, escolaId]
        );
        
        const pedidoId = resPed.rows[0].id;

        // 2. Insere os itens na tabela VIVA (itens_pedido)
        for (const it of itens) {
            await db.query(
                `INSERT INTO itens_pedido (pedido_id, produto_id, tamanho, quantidade) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, it.produto_id, it.tamanho, it.quantidade]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, pedidoId });

    } catch (err) {
        if (db) await db.query('ROLLBACK');
        console.error("ERRO AO SOLICITAR DEVOLUCAO:", err.message);
        res.status(500).json({ error: "Erro ao gravar solicitação: " + err.message });
    }
});

router.get('/pedidos/admin/devolucoes-pendentes', verificarToken, async (req, res) => {
    try {
        // 1. Segurança: Verifica se é Admin (ajuste conforme seu padrão de perfil)
        // Se o seu sistema usa req.user.perfil, adicione a trava aqui.

        const query = `
            SELECT 
                p.id, 
                l.nome as escola_nome, 
                p.data_criacao, 
                p.status
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.tipo_pedido = 'DEVOLUCAO' 
              AND p.status = 'DEVOLUCAO_PENDENTE'
            ORDER BY p.data_criacao DESC
        `;

        const result = await db.query(query);
        
        // Sempre retorna JSON, mesmo que vazio, para evitar o erro "Unexpected token <"
        res.json(result.rows || []);

    } catch (err) {
        console.error("ERRO ADMIN DEVOLUCOES:", err.message);
        res.status(500).json({ error: "Erro interno ao buscar devoluções." });
    }
});

router.get('/pedidos/admin/detalhes-devolucao/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                ip.id as item_id,
                p.nome as produto_nome, 
                ip.tamanho, 
                ip.quantidade
            FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id
            WHERE ip.pedido_id = $1
        `;
        const result = await db.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/admin/processar-devolucao', verificarToken, async (req, res) => {
    try {
        const { pedidoId, acao } = req.body; // acao: 'AUTORIZAR' ou 'RECUSAR'
        const novoStatus = acao === 'AUTORIZAR' ? 'DEVOLUCAO_AUTORIZADA' : 'DEVOLUCAO_RECUSADA';
        const autorizadorId = req.userId;

        await db.query(
            `UPDATE pedidos 
             SET status = $1, autorizado_por = $2, data_autorizacao = NOW() 
             WHERE id = $3`,
            [novoStatus, autorizadorId, pedidoId]
        );

        res.json({ success: true, status: novoStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/admin/conferir-devolucao-remessa/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params; // ID do Pedido Pai

        const query = `
            SELECT 
                pri.id,
                prod.nome as produto_nome, 
                pri.tamanho, 
                pri.quantidade_enviada as quantidade
            FROM pedido_remessas pr
            JOIN pedido_remessa_itens pri ON pr.id = pri.remessa_id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE pr.pedido_id = $1
        `;
        
        const result = await db.query(query, [id]);
        
        // Garantimos o envio de JSON
        res.json(result.rows || []);

    } catch (err) {
        console.error("Erro na rota exclusiva de devolução:", err.message);
        res.status(500).json({ error: "Erro interno ao processar a conferência." });
    }
});

router.post('/pedidos/escola/nova-devolucao-isolada', verificarToken, async (req, res) => {
    const { itens } = req.body;
    const usuarioId = req.userId;

    try {
        await db.query('BEGIN');
        const userRes = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [usuarioId]);
        const escolaId = userRes.rows[0]?.local_id;

        // Cria o Pedido (Cabeçalho)
        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'DEVOLUCAO_PENDENTE', 'DEVOLUCAO', NOW()) RETURNING id`,
            [usuarioId, escolaId]
        );
        const pedidoId = resPed.rows[0].id;

        // Cria a Remessa (O vínculo que o Admin precisa)
        const resRem = await db.query(
            `INSERT INTO pedido_remessas (pedido_id, status, data_criacao) 
             VALUES ($1, 'PENDENTE', NOW()) RETURNING id`,
            [pedidoId]
        );
        const remessaId = resRem.rows[0].id;

        // Insere os itens na tabela de remessa (onde o sistema já busca)
        for (const it of itens) {
            await db.query(
                `INSERT INTO pedido_remessa_itens (remessa_id, produto_id, tamanho, quantidade_enviada) 
                 VALUES ($1, $2, $3, $4)`,
                [remessaId, it.produto_id, it.tamanho, it.quantidade]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, pedidoId });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "Erro na nova rota de devolução." });
    }
});

router.post('/pedidos/admin/decisao-devolucao', verificarToken, async (req, res) => {
    try {
        const { pedidoId, status } = req.body; 
        await db.query("UPDATE pedidos SET status = $1 WHERE id = $2", [status, pedidoId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar decisão." });
    }
});

router.post('/pedidos/escola/solicitacao-devolucao-v2', verificarToken, async (req, res) => {
    const { itens } = req.body;
    const usuarioId = req.userId;

    try {
        await db.query('BEGIN');
        const userRes = await db.query('SELECT local_id FROM usuarios WHERE id = $1', [usuarioId]);
        const escolaId = userRes.rows[0]?.local_id;

        const resPed = await db.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'DEVOLUCAO_PENDENTE', 'DEVOLUCAO', NOW()) RETURNING id`,
            [usuarioId, escolaId]
        );
        const pedidoId = resPed.rows[0].id;

        const resRem = await db.query(
            `INSERT INTO pedido_remessas (pedido_id, status, data_criacao) 
             VALUES ($1, 'PENDENTE', NOW()) RETURNING id`,
            [pedidoId]
        );
        const remessaId = resRem.rows[0].id;

        for (const it of itens) {
            // USANDO A COLUNA EXATA: quantidade_enviada
            await db.query(
                `INSERT INTO pedido_remessa_itens (remessa_id, produto_id, tamanho, quantidade_enviada) 
                 VALUES ($1, $2, $3, $4)`,
                [remessaId, it.produto_id, it.tamanho, it.quantidade]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, pedidoId });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/pedidos/admin/visualizar-itens-devolucao/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                pi.produto_id, -- ADICIONADO: Agora o frontend saberá quem é o produto
                prod.nome, 
                pi.tamanho, 
                pi.quantidade_solicitada as quantidade
            FROM pedido_itens pi
            JOIN produtos prod ON pi.produto_id = prod.id
            WHERE pi.pedido_id = $1
        `;

        const result = await db.query(query, [id]);
        res.json(result.rows || []);

    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar itens." });
    }
});

router.get('/pedidos/admin/conferir-devolucao-v2/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params; // ID do Pedido
        const query = `
            SELECT 
                prod.nome, 
                pri.tamanho, 
                pri.quantidade_enviada as quantidade
            FROM pedido_remessas pr
            JOIN pedido_remessa_itens pri ON pr.id = pri.remessa_id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE pr.pedido_id = $1
        `;
        const result = await db.query(query, [id]);
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar itens da remessa." });
    }
});

router.post('/pedidos/admin/decisao-devolucao-v2', verificarToken, async (req, res) => {
    const { pedidoId, status } = req.body;
    try {
        await db.query("UPDATE pedidos SET status = $1 WHERE id = $2", [status, pedidoId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar status." });
    }
});

router.put('/pedidos/logistica/confirmar-coleta/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        // O status muda para EM_TRANSITO. O estoque só verá pedidos com este status.
        await db.query(
            "UPDATE pedidos SET status = 'DEVOLUCAO_EM_TRANSITO', data_saida = NOW() WHERE id = $1",
            [id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pedidos/estoque/finalizar-devolucao-v2', verificarToken, async (req, res) => {
    const { pedidoId, itens } = req.body;
    try {
        await db.query('BEGIN');
        for (const item of itens) {
            // Soma na grade (estoque_grades) e no total (produtos)
            await db.query("UPDATE estoque_grades SET quantidade = quantidade + $1 WHERE produto_id = $2 AND tamanho = $3", [item.quantidade, item.produto_id, item.tamanho]);
            await db.query("UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2", [item.quantidade, item.produto_id]);
        }
        await db.query("UPDATE pedidos SET status = 'DEVOLVIDO', data_recebimento = NOW() WHERE id = $1", [pedidoId]);
        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/devolucoes/logistica/coletas-pendentes', verificarToken, async (req, res) => {
    try {
        // Esta query busca o local (escola) vinculado ao usuário que iniciou a devolução
        const query = `
            SELECT 
                p.id, 
                l.nome as escola_nome, 
                p.data_criacao,
                p.status
            FROM pedidos p
            JOIN usuarios u ON p.usuario_origem_id = u.id
            JOIN locais l ON u.local_id = l.id
            WHERE p.status = 'DEVOLUCAO_AUTORIZADA'
            ORDER BY p.data_criacao ASC
        `;
        const result = await db.query(query);
        
        // Log para você ver no terminal do VSCode/PM2 se o banco retornou algo
        console.log(`[LOGÍSTICA] Pedidos encontrados: ${result.rowCount}`);
        
        res.json(result.rows);
    } catch (err) {
        console.error("Erro na rota de logística:", err.message);
        res.status(500).json({ error: "Erro ao carregar lista de coletas." });
    }
});

// 2. Confirmar coleta de DEVOLUÇÃO
router.put('/devolucoes/logistica/confirmar-coleta/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            "UPDATE pedidos SET status = 'DEVOLUCAO_EM_TRANSITO', data_saida = NOW() WHERE id = $1",
            [id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar coleta." });
    }
});

router.get('/devolucoes/estoque/recebimentos-pendentes', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT p.id, l.nome as escola_nome, p.data_saida as data_coleta
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = 'DEVOLUCAO_EM_TRANSITO'
            ORDER BY p.data_saida ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar recebimentos." });
    }
});

router.post('/devolucoes/estoque/finalizar-entrada', verificarToken, async (req, res) => {
  const { pedidoId, itens } = req.body;

  if (!pedidoId || !Array.isArray(itens)) {
    return res.status(400).json({
      error: "Dados incompletos ou formato inválido.",
      recebido: { pedidoId, itens }
    });
  }

  const LOCAL_ALMOX = 37;

  try {
    await db.query('BEGIN');

    for (const item of itens) {
      const qtd = parseInt(item.quantidade, 10) || 0;
      const pId = parseInt(item.produto_id, 10);
      const tam = (item.tamanho && String(item.tamanho).trim()) ? String(item.tamanho).trim() : 'UNICO';

      if (!Number.isFinite(pId)) throw new Error(`produto_id inválido: ${item.produto_id}`);
      if (qtd <= 0) continue;

      await db.query(`
        INSERT INTO estoque_por_local (local_id, produto_id, tamanho, quantidade)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (local_id, produto_id, tamanho)
        DO UPDATE SET quantidade = estoque_por_local.quantidade + EXCLUDED.quantidade
      `, [LOCAL_ALMOX, pId, tam, qtd]);
    }

    await db.query(
      "UPDATE pedidos SET status = $1::status_pedido, data_recebimento = NOW() WHERE id = $2",
      ['DEVOLVIDO', parseInt(pedidoId, 10)]
    );

    await db.query('COMMIT');
    res.json({ success: true });

  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: "Falha no Banco de Dados", message: err.message });
  }
});

// ROTA EXCLUSIVA: Criar Solicitação de Patrimônio
router.post('/patrimonio/solicitar', verificarToken, async (req, res) => {
    const { local_destino_id, itens, observacao } = req.body;
    const usuario_origem_id = req.user.id; // Pego o ID de quem está logado

    try {
        await db.query('BEGIN');

        // 1. Cria o registro principal na tabela pedidos
        // Usamos status 'AGUARDANDO_AUTORIZACAO' e tipo 'PATRIMONIO'
        const pedidoRes = await db.query(
            `INSERT INTO pedidos 
             (usuario_origem_id, local_destino_id, status, tipo_pedido, motivo_recusa) 
             VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'PATRIMONIO', $3) 
             RETURNING id`,
            [usuario_origem_id, local_destino_id, observacao]
        );

        const pedidoId = pedidoRes.rows[0].id;

        // 2. Insere os itens solicitados (apenas quantidade neste momento)
        for (const item of itens) {
            await db.query(
                `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada) 
                 VALUES ($1, $2, $3)`,
                [pedidoId, item.produto_id, item.quantidade]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, pedidoId });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro ao solicitar patrimônio:", err.message);
        res.status(500).json({ error: "Erro interno ao processar solicitação." });
    }
});

// ROTA: Entrada de Novos Patrimônios
router.post('/patrimonio/entrada', verificarToken, async (req, res) => {
    const { produto_id, quantidade, nota_fiscal, local_id, setor_id } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Validação de Segurança: O produto é realmente do tipo PATRIMONIO?
        const checkProd = await db.query(
            "SELECT tipo FROM produtos WHERE id = $1", [produto_id]
        );

        if (checkProd.rows[0].tipo !== 'PATRIMONIO') {
            throw new Error("Este produto não está catalogado como Patrimônio.");
        }

        // 2. Loop de Individualização: Cria X registros na tabela 'patrimonios'
        // Note que numero_serie e outros campos ficam nulos para preenchimento tardio
        for (let i = 0; i < quantidade; i++) {
            await db.query(
                `INSERT INTO patrimonios (produto_id, local_id, setor_id, nota_fiscal, status) 
                 VALUES ($1, $2, $3, $4, 'ESTOQUE')`,
                [produto_id, local_id, setor_id, nota_fiscal]
            );
        }

        // 3. Sincronização: Atualiza a contagem global na tabela 'produtos'
        await db.query(
            "UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2",
            [quantidade, produto_id]
        );

        await db.query('COMMIT');
        res.json({ success: true, message: `${quantidade} itens individualizados com sucesso.` });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro na entrada de patrimônio:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 1. Listar solicitações de patrimônio pendentes
router.get('/patrimonio/solicitacoes-pendentes', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.data_criacao, l.nome as escola_nome, u.nome as solicitante,
            (SELECT COUNT(*) FROM pedido_itens WHERE pedido_id = p.id) as total_itens
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE p.tipo_pedido = 'PATRIMONIO' AND p.status = 'AGUARDANDO_AUTORIZACAO'
            ORDER BY p.data_criacao DESC`;
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Aprovar Solicitação (Transformar em Pedido Oficial)
router.post('/patrimonio/aprovar', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;
    try {
        await db.query("UPDATE pedidos SET status = 'APROVADO', autorizado_por = $1, data_autorizacao = NOW() WHERE id = $2", 
        [req.user.id, pedidoId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Listar itens físicos disponíveis para um determinado produto
router.get('/patrimonio/disponiveis/:produtoId', verificarToken, async (req, res) => {
    try {
        const { produtoId } = req.params;
        const query = `
            SELECT id, numero_serie, nota_fiscal 
            FROM patrimonios 
            WHERE produto_id = $1 AND status = 'ESTOQUE'
            ORDER BY id ASC`;
        const result = await db.query(query, [produtoId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Gerar Remessa de Património (Vinculando IDs individuais)
router.post('/patrimonio/gerar-remessa', verificarToken, async (req, res) => {
    const { pedidoId, itensSelecionados } = req.body; // itensSelecionados: [id1, id2, id3...]

    try {
        await db.query('BEGIN');

        // A. Cria a Remessa principal (status: AGUARDANDO_COLETA)
        const remessaRes = await db.query(
            `INSERT INTO remessas (pedido_id, usuario_id, status) 
             VALUES ($1, $2, 'AGUARDANDO_COLETA') RETURNING id`,
            [pedidoId, req.user.id]
        );
        const remessaId = remessaRes.rows[0].id;

        // B. Vincula cada património à remessa e muda o status do item
        for (const patId of itensSelecionados) {
            // Atualiza o património para indicar que está em processo de envio
            await db.query(
                `UPDATE patrimonios SET 
                 status = 'EM_TRANSITO', 
                 pedido_id = $1 
                 WHERE id = $2`,
                [pedidoId, patId]
            );

            // Se você tiver uma tabela de itens da remessa, insira aqui:
            await db.query(
                `INSERT INTO remessa_itens (remessa_id, patrimonio_id) VALUES ($1, $2)`,
                [remessaId, patId]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Remessa gerada com sucesso!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 1. Listar remessas de património aguardando coleta
router.get('/patrimonio/logistica/pendentes', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                r.id as remessa_id, 
                r.data_criacao, 
                p.id as pedido_id, 
                l.nome as local_destino,
                (SELECT COUNT(*) FROM remessa_itens WHERE remessa_id = r.id) as total_itens
            FROM remessas r
            JOIN pedidos p ON r.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.tipo_pedido = 'PATRIMONIO' AND r.status = 'AGUARDANDO_COLETA'
            ORDER BY r.data_criacao ASC`;
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Confirmar Coleta (Mudar status para EM_TRANSPORTE)
router.post('/patrimonio/logistica/confirmar-coleta', verificarToken, async (req, res) => {
    const { remessaId } = req.body;
    try {
        await db.query(
            "UPDATE remessas SET status = 'EM_TRANSPORTE', data_saida = NOW() WHERE id = $1",
            [remessaId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: Confirmar Recebimento de Património no Destino
router.post('/patrimonio/confirmar-recebimento', verificarToken, async (req, res) => {
    const { remessaId } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Procuramos o local de destino e os itens desta remessa
        const infoRes = await db.query(`
            SELECT p.local_destino_id, ri.patrimonio_id 
            FROM remessas r
            JOIN pedidos p ON r.pedido_id = p.id
            JOIN remessa_itens ri ON ri.remessa_id = r.id
            WHERE r.id = $1`, [remessaId]);

        if (infoRes.rows.length === 0) throw new Error("Remessa não encontrada.");

        const localDestinoId = infoRes.rows[0].local_destino_id;
        const itens = infoRes.rows.map(r => r.patrimonio_id);

        // 2. Atualizamos cada item na tabela 'patrimonios'
        // O local_id muda para a escola e o status volta para 'ATIVO' (ou 'ALOCADO')
        await db.query(`
            UPDATE patrimonios 
            SET local_id = $1, 
                status = 'ATIVO', 
                data_atualizacao = NOW() 
            WHERE id = ANY($2)`, 
            [localDestinoId, itens]);

        // 3. Finalizamos a remessa
        await db.query("UPDATE remessas SET status = 'ENTREGUE', data_chegada = NOW() WHERE id = $1", [remessaId]);

        await db.query('COMMIT');
        res.json({ success: true, message: "Património recebido e inventário atualizado!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ROTA: Consultar Detalhes e Histórico de um Patrimônio
router.get('/patrimonio/historico/:identificador', verificarToken, async (req, res) => {
    const { identificador } = req.params; // Pode ser o ID ou o Número de Série

    try {
        // 1. Busca os dados atuais do item
        const itemRes = await db.query(`
            SELECT p.*, pr.nome as produto_nome, l.nome as local_atual, s.nome as setor_nome
            FROM patrimonios p
            JOIN produtos pr ON p.produto_id = pr.id
            JOIN locais l ON p.local_id = l.id
            LEFT JOIN setores s ON p.setor_id = s.id
            WHERE p.id::text = $1 OR p.numero_serie = $1`, [identificador]);

        if (itemRes.rows.length === 0) {
            return res.status(404).json({ error: "Patrimônio não localizado." });
        }

        const patrimonio = itemRes.rows[0];

        // 2. Busca o rastro de movimentação (Remessas por onde passou)
        const trilhaRes = await db.query(`
            SELECT 
                r.data_saida, r.data_chegada, r.status,
                l_dest.nome as destino,
                u_envio.nome as quem_enviou
            FROM remessa_itens ri
            JOIN remessas r ON ri.remessa_id = r.id
            JOIN pedidos ped ON r.pedido_id = ped.id
            JOIN locais l_dest ON ped.local_destino_id = l_dest.id
            JOIN usuarios u_envio ON r.usuario_id = u_envio.id
            WHERE ri.patrimonio_id = $1
            ORDER BY r.data_criacao DESC`, [patrimonio.id]);

        res.json({
            detalhes: patrimonio,
            historico: trilhaRes.rows
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/produtos', verificarToken, async (req, res) => {
    try {
        // Note: usei os nomes 'nome' e 'quantidade_estoque' que seu script.js espera
        const result = await db.query(`
            SELECT id, item as nome, quantidade as quantidade_estoque 
            FROM produtos 
            WHERE tipo = 'PATRIMONIO' 
            ORDER BY item ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const multer = require('multer');

// Configuração de Armazenamento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Como o script roda na raiz do backend, o caminho é relativo a ele
        cb(null, 'uploads/notas_fiscais/'); 
    },
    filename: (req, file, cb) => {
        // Geramos um nome único: Prefixo + Timestamp + Número Aleatório + Extensão
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'NF-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro de Segurança (Apenas PDF)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB por arquivo
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Formato inválido! Envie apenas arquivos PDF.'));
        }
    }
});

// ROTA ATUALIZADA (Recebe arquivo e dados)
router.post('/patrimonio/escola/registrar', verificarToken, upload.single('arquivo_nf'), async (req, res) => {
    const { nome, setor_id, quantidade, numero_serie, nota_fiscal, adquirido_pos_2025 } = req.body;
    const usuario_id = req.userId;

    try {
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_usuario = userRes.rows[0]?.local_id;

        // 1. Garante que o produto existe e é do tipo PATRIMONIO
        let produtoRes = await db.query("SELECT id FROM produtos WHERE nome = $1", [nome.trim().toUpperCase()]);
        let produto_id;

        if (produtoRes.rows.length > 0) {
            produto_id = produtoRes.rows[0].id;
            await db.query("UPDATE produtos SET tipo = 'PATRIMONIO' WHERE id = $1", [produto_id]);
        } else {
            const novoProduto = await db.query(
                "INSERT INTO produtos (nome, local_id, tipo) VALUES ($1, $2, 'PATRIMONIO') RETURNING id",
                [nome.trim().toUpperCase(), local_id_usuario]
            );
            produto_id = novoProduto.rows[0].id;
        }

        // 2. TRATAMENTO DA SÉRIE: Se estiver vazio, vira NULL para não violar a UNIQUE CONSTRAINT
        const serie_final = (numero_serie && numero_serie.trim() !== "") ? numero_serie.trim().toUpperCase() : null;

        const queryPatrimonio = `
            INSERT INTO patrimonios (
                produto_id, local_id, setor_id, numero_serie, 
                nota_fiscal, adquirido_pos_2025, url_nota_fiscal, status, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ESTOQUE', 'BOM')
        `;

        const qtd = parseInt(quantidade) || 1;

        for (let i = 0; i < qtd; i++) {
            await db.query(queryPatrimonio, [
                produto_id,
                local_id_usuario,
                setor_id,
                // Se for mais de 1 item (lote), a série PRECISA ser nula para não dar erro de duplicidade
                qtd > 1 ? null : serie_final, 
                nota_fiscal || null,
                adquirido_pos_2025 === 'true',
                req.file ? req.file.filename : null
            ]);
        }

        res.json({ success: true });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Este Número de Série ou Plaqueta já existe no sistema." });
        }
        console.error("Erro no cadastro:", err.message);
        res.status(500).json({ error: "Erro interno ao gravar patrimônio." });
    }
});

router.get('/patrimonio/meu-inventario', verificarToken, async (req, res) => {
    // Usamos o req.userId (padrão das suas outras rotas) para buscar o local_id oficial
    const usuario_id = req.userId; 

    try {
        // 1. Busca o local_id do usuário logado para garantir segurança
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const localIdOficial = userRes.rows[0]?.local_id;

        if (!localIdOficial) {
            return res.status(400).json({ error: "Usuário sem local vinculado." });
        }

        const { setor_id } = req.query;

        // 2. Query com JOIN para trazer o nome do produto e do setor
        // O segredo está no 'prod.nome AS produto_nome'
        let sql = `
            SELECT 
                p.id, 
                p.numero_serie, 
                p.nota_fiscal, 
                p.estado, 
                p.url_nota_fiscal,
                p.adquirido_pos_2025,
                p.data_atualizacao,
                s.nome as setor_nome,
                prod.nome as produto_nome
            FROM patrimonios p
            JOIN setores s ON p.setor_id = s.id
            JOIN produtos prod ON p.produto_id = prod.id
            WHERE p.local_id = $1
        `;
        
        const params = [localIdOficial];

        // 3. Aplica o filtro de setor se não for "todos"
        if (setor_id && setor_id !== 'todos' && setor_id !== '') {
            sql += ` AND p.setor_id = $2`;
            params.push(setor_id);
        }

        // Ordenação por nome do setor e depois nome do produto
        sql += ` ORDER BY s.nome ASC, prod.nome ASC`;

        const result = await db.query(sql, params);
        
        // Retorna a lista para o Frontend
        res.json(result.rows);

    } catch (err) {
        console.error("Erro na query de inventário:", err.message);
        res.status(500).json({ error: "Erro interno ao buscar inventário." });
    }
});

router.put('/patrimonio/itens/baixa/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { motivo, observacao } = req.body; // Motivos: 'QUEBRADO', 'FURTADO', 'OBSOLETO'
    const local_id = req.user.local_id;

    try {
        // Validação de propriedade
        const check = await db.query(
            "SELECT id FROM patrimonios WHERE id = $1 AND local_id = $2",
            [id, local_id]
        );

        if (check.rows.length === 0) return res.status(403).json({ error: "Acesso negado." });

        await db.query(
            `UPDATE patrimonios SET 
                status = $1, 
                observacao_baixa = $2, 
                data_baixa = NOW() 
             WHERE id = $3`,
            [motivo, observacao, id]
        );

        res.json({ success: true, message: "Baixa registrada com sucesso." });
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar baixa." });
    }
});

router.put('/patrimonio/itens/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { setor_id, numero_serie, nota_fiscal, estado } = req.body;
    const local_id = req.user.local_id;

    try {
        const query = `
            UPDATE patrimonios 
            SET 
                setor_id = $1, 
                numero_serie = $2, 
                nota_fiscal = $3, 
                estado = $4,
                data_atualizacao = NOW()
            WHERE id = $5 AND local_id = $6
            RETURNING *
        `;
        
        const result = await db.query(query, [setor_id, numero_serie, nota_fiscal, estado, id, local_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Item não encontrado para atualização." });
        }

        res.json({ success: true, message: "Item atualizado com sucesso!" });
    } catch (err) {
        console.error("Erro ao atualizar item:", err);
        res.status(500).json({ error: "Erro ao atualizar dados." });
    }
});

// ROTA: Registar um novo item de património na unidade
router.post('/patrimonio/itens', verificarToken, async (req, res) => {
    const { produto_id, setor_id, numero_serie, nota_fiscal } = req.body;
    const local_id = req.user.local_id; // Segurança: extraído diretamente do Token

    try {
        await db.query('BEGIN');

        // 1. Validamos se o setor pertence realmente a esta escola
        const checkSetor = await db.query(
            "SELECT id FROM setores WHERE id = $1 AND local_id = $2",
            [setor_id, local_id]
        );

        if (checkSetor.rows.length === 0) {
            throw new Error("Setor inválido ou não pertence a esta unidade.");
        }

        // 2. Inserimos o item na tabela de patrimónios
        const result = await db.query(
            `INSERT INTO patrimonios (produto_id, local_id, setor_id, numero_serie, nota_fiscal, status, data_atualizacao) 
             VALUES ($1, $2, $3, $4, $5, 'ATIVO', NOW()) RETURNING id`,
            [produto_id, local_id, setor_id, numero_serie || null, nota_fiscal || null]
        );

        // 3. Atualizamos o saldo global na tabela de produtos (opcional, dependendo da sua regra de negócio)
        await db.query(
            "UPDATE produtos SET quantidade_estoque = quantidade_estoque + 1 WHERE id = $1",
            [produto_id]
        );

        await db.query('COMMIT');
        res.json({ success: true, id: result.rows[0].id });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro ao registar património:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/patrimonio/setores', verificarToken, async (req, res) => {
    const { nome } = req.body;
    const usuario_id = req.userId; 

    try {
        // Busca o local_id oficial do utilizador na tabela 'usuarios'
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_usuario = userRes.rows[0]?.local_id;

        if (!local_id_usuario) {
            return res.status(400).json({ 
                error: "Utilizador sem local vinculado no cadastro de usuários." 
            });
        }

        // Insere o setor garantindo que o local_id seja o mesmo do utilizador logado
        await db.query(
            "INSERT INTO setores (nome, local_id) VALUES ($1, $2)",
            [nome.toUpperCase(), local_id_usuario]
        );

        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Este setor já está cadastrado nesta escola." });
        }
        res.status(500).json({ error: "Erro ao salvar setor no banco de dados." });
    }
});

router.get('/patrimonio/setores/meus', verificarToken, async (req, res) => {
    const usuario_id = req.userId; // ID garantido pelo middleware

    try {
        // Busca o local_id atualizado direto na tabela de usuários
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const localId = userRes.rows[0]?.local_id;

        if (!localId) {
            return res.status(404).json({ error: "Local não identificado para este usuário." });
        }

        const result = await db.query(
            "SELECT id, nome FROM setores WHERE local_id = $1 ORDER BY nome ASC",
            [localId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao listar setores:", err.message);
        res.status(500).json({ error: "Erro ao carregar lista de setores." });
    }
});

router.delete('/patrimonio/itens/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const local_id = req.user.local_id;

    try {
        // Segurança: Só permite deletar se o item pertencer à escola do usuário
        const deleteRes = await db.query(
            "DELETE FROM patrimonios WHERE id = $1 AND local_id = $2 RETURNING *",
            [id, local_id]
        );

        if (deleteRes.rowCount === 0) {
            return res.status(404).json({ error: "Item não encontrado ou acesso negado." });
        }

        res.json({ success: true, message: "Item removido com sucesso." });
    } catch (err) {
        res.status(500).json({ error: "Erro ao excluir item." });
    }
});

router.get('/patrimonio/ver-nota/:filename', verificarToken, (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'notas_fiscais', filename);

    // Verifica se o arquivo existe fisicamente
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: "Arquivo não encontrado." });
    }
});

router.get('/patrimonio/item-detalhes/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const local_id = req.user.local_id; // Segurança: Filtra pela escola do usuário

    try {
        const query = `
            SELECT 
                p.id, 
                p.numero_serie, 
                p.nota_fiscal, 
                p.estado, 
                p.setor_id,
                p.url_nota_fiscal,
                prod.nome as produto_nome
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            WHERE p.id = $1 AND p.local_id = $2
        `;
        
        const result = await db.query(query, [id, local_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Item não encontrado." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erro ao buscar detalhes do item:", err);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

router.use('/uploads', express.static('uploads'));

router.get('/patrimonio/escola/resumo', verificarToken, async (req, res) => {
    const local_id = req.user.local_id;

    try {
        // Promessas paralelas para ganhar velocidade
        const [totalItens, totalSetores, semPlaqueta, estadoPessimo, porSetor] = await Promise.all([
            db.query("SELECT COUNT(*) FROM patrimonios WHERE local_id = $1", [local_id]),
            db.query("SELECT COUNT(*) FROM setores WHERE local_id = $1", [local_id]),
            db.query("SELECT COUNT(*) FROM patrimonios WHERE local_id = $1 AND (numero_serie IS NULL OR numero_serie = '')", [local_id]),
            db.query("SELECT COUNT(*) FROM patrimonios WHERE local_id = $1 AND estado = 'PÉSSIMO'", [local_id]),
            db.query(`
                SELECT s.nome as setor, COUNT(p.id) as total 
                FROM setores s 
                LEFT JOIN patrimonios p ON s.id = p.setor_id 
                WHERE s.local_id = $1 
                GROUP BY s.nome 
                ORDER BY total DESC`, [local_id])
        ]);

        res.json({
            totalItens: totalItens.rows[0].count,
            totalSetores: totalSetores.rows[0].count,
            semPlaqueta: semPlaqueta.rows[0].count,
            estadoPessimo: estadoPessimo.rows[0].count,
            distribuicao: porSetor.rows
        });
    } catch (err) {
        res.status(500).json({ error: "Erro ao gerar resumo." });
    }
});

router.post('/computadores/chamados/abrir', verificarToken, async (req, res) => {
    const { tipo_defeito, motivo } = req.body;
    const usuario_id = req.userId; // ID obtido do token pelo middleware verificarToken

    try {
        // 1. Procura o local_id do utilizador logado diretamente na tabela 'usuarios'
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_usuario = userRes.rows[0]?.local_id;

        // 2. Verifica se o utilizador tem um local atribuído
        if (!local_id_usuario) {
            return res.status(400).json({ 
                error: "Utilizador sem local vinculado. Verifique o cadastro na tabela 'usuarios'." 
            });
        }

        // 3. Insere o chamado utilizando o local_id recuperado na consulta anterior
        await db.query(
            `INSERT INTO chamados_computador (local_id, usuario_origem_id, tipo_defeito, motivo, status, data_abertura) 
             VALUES ($1, $2, $3, $4, 'ABERTO', NOW())`,
            [local_id_usuario, usuario_id, tipo_defeito, motivo]
        );

        res.json({ success: true, message: "Chamado de manutenção registado!" });

    } catch (err) {
        console.error("Erro ao abrir chamado PC:", err.message);
        res.status(500).json({ error: "Erro interno no servidor: " + err.message });
    }
});

router.get('/computadores/chamados/lista-abertos', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.*, l.nome as escola_nome, u.nome as solicitante
            FROM chamados_computador c
            JOIN locais l ON c.local_id = l.id
            JOIN usuarios u ON c.usuario_origem_id = u.id
            WHERE c.status = 'ABERTO'
            ORDER BY c.data_abertura ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar chamados: " + err.message });
    }
});

router.get('/computadores/chamados/lista', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.*, l.nome as escola_nome, u.nome as solicitante
            FROM chamados_computador c
            JOIN locais l ON c.local_id = l.id
            JOIN usuarios u ON c.usuario_origem_id = u.id
            WHERE c.status = 'ABERTO'
            ORDER BY c.data_abertura ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/computadores/chamados/lista', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.*, l.nome as escola_nome, u.nome as solicitante
            FROM chamados_computador c
            JOIN locais l ON c.local_id = l.id
            JOIN usuarios u ON c.usuario_origem_id = u.id
            WHERE c.status = 'ABERTO'
            ORDER BY c.data_abertura ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/computadores/chamados/fechar/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { observacoes_tecnicas } = req.body;
    const tecnico_id = req.userId;

    try {
        await db.query(
            `UPDATE chamados_computador 
             SET status = 'FECHADO', 
                 data_fechamento = NOW(), 
                 tecnico_id = $1, 
                 observacoes_tecnicas = $2
             WHERE id = $3`,
            [tecnico_id, observacoes_tecnicas, id]
        );
        res.json({ success: true, message: "Chamado finalizado com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao fechar chamado: " + err.message });
    }
});

router.get('/computadores/stats', verificarToken, async (req, res) => {
    const { inicio, fim } = req.query;

    try {
        // 1. Todos os registros no período
        const chamados = await db.query(`
            SELECT c.*, l.nome as local_nome, u.nome as solicitante, t.nome as tecnico
            FROM chamados_computador c
            JOIN locais l ON c.local_id = l.id
            JOIN usuarios u ON c.usuario_origem_id = u.id
            LEFT JOIN usuarios t ON c.tecnico_id = t.id
            WHERE c.data_abertura::date BETWEEN $1 AND $2
            ORDER BY c.data_abertura DESC
        `, [inicio, fim]);

        // 2. Totais por Local (Ordem Alfabética)
        const porLocal = await db.query(`
            SELECT l.nome, COUNT(*) as total
            FROM chamados_computador c
            JOIN locais l ON c.local_id = l.id
            WHERE c.data_abertura::date BETWEEN $1 AND $2
            GROUP BY l.nome ORDER BY l.nome ASC
        `, [inicio, fim]);

        // 3. Totais por Tipo de Defeito
        const porDefeito = await db.query(`
            SELECT tipo_defeito, COUNT(*) as total
            FROM chamados_computador c
            WHERE c.data_abertura::date BETWEEN $1 AND $2
            GROUP BY tipo_defeito ORDER BY total DESC
        `, [inicio, fim]);

        res.json({
            registros: chamados.rows,
            statsLocal: porLocal.rows,
            statsDefeito: porDefeito.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/modulo-patrimonio/setores/novo', verificarToken, async (req, res) => {
    const { nome_setor } = req.body;
    const id_usuario_logado = req.userId; // Vem do token pelo middleware

    try {
        // Busca o local_id direto na tabela de usuários para não ter erro
        const consultaUser = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [id_usuario_logado]);
        const local_id_real = consultaUser.rows[0]?.local_id;

        if (!local_id_real) {
            return res.status(400).json({ error: "Sua conta não tem um local vinculado." });
        }

        // Insere na tabela setores usando o local_id recuperado
        await db.query(
            "INSERT INTO setores (nome, local_id) VALUES ($1, $2)",
            [nome_setor.trim().toUpperCase(), local_id_real]
        );

        res.json({ success: true, message: "Setor salvo com sucesso!" });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Este setor já existe na sua unidade." });
        }
        console.error("Erro Patrimônio:", err.message);
        res.status(500).json({ error: "Erro ao processar setor." });
    }
});

router.get('/modulo-patrimonio/setores/lista', verificarToken, async (req, res) => {
    const id_usuario_logado = req.userId;

    try {
        const consultaUser = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [id_usuario_logado]);
        const local_id_real = consultaUser.rows[0]?.local_id;

        const result = await db.query(
            "SELECT id, nome FROM setores WHERE local_id = $1 ORDER BY nome ASC",
            [local_id_real]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Falha ao listar setores." });
    }
});

// =========================================================
// MÓDULO PATRIMÔNIO: GESTÃO DE SETORES (ISOLADO)
// =========================================================
router.post('/patrimonio/setores/registrar', verificarToken, async (req, res) => {
    const { nome } = req.body;
    const usuario_id = req.userId; // Extraído com segurança pelo middleware

    try {
        // Lógica idêntica à Manutenção: busca o local_id direto na fonte
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_real = userRes.rows[0]?.local_id;

        if (!local_id_real) {
            return res.status(400).json({ error: "Usuário não possui unidade vinculada no banco." });
        }

        // Gravação garantida com o local_id correto
        await db.query(
            "INSERT INTO setores (nome, local_id) VALUES ($1, $2)",
            [nome.trim().toUpperCase(), local_id_real]
        );

        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Setor já cadastrado nesta unidade." });
        }
        res.status(500).json({ error: "Erro interno: " + err.message });
    }
});

router.get('/patrimonio/setores/listar', verificarToken, async (req, res) => {
    const usuario_id = req.userId;
    try {
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_real = userRes.rows[0]?.local_id;

        const result = await db.query(
            "SELECT id, nome FROM setores WHERE local_id = $1 ORDER BY nome ASC",
            [local_id_real]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA PARA LISTAR ITENS DE UM SETOR ESPECÍFICO (INVENTÁRIO)
router.get('/patrimonio/inventario/setor/:setor_id', verificarToken, async (req, res) => {
    const { setor_id } = req.params;
    const usuario_id = req.userId;

    try {
        // 1. Confirma o local_id do usuário (Segurança)
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_usuario = userRes.rows[0]?.local_id;

        // 2. Busca os itens cruzando com a tabela de produtos para pegar o nome
        const result = await db.query(`
            SELECT p.*, prod.nome as nome_produto 
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            WHERE p.setor_id = $1 AND p.local_id = $2
            ORDER BY prod.nome ASC
        `, [setor_id, local_id_usuario]);

        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao consultar inventário:", err.message);
        res.status(500).json({ error: "Erro ao carregar itens do setor." });
    }
});

router.get('/patrimonio/detalhes/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const usuario_id = req.userId; // ID vindo do middleware verificarToken

    try {
        // 1. Busca o local_id do usuário logado (Segurança)
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const local_id_usuario = userRes.rows[0]?.local_id;

        // 2. Busca o bem garantindo que pertença à mesma escola
        const result = await db.query(`
            SELECT p.*, prod.nome as nome_produto, s.nome as nome_setor
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            JOIN setores s ON p.setor_id = s.id
            WHERE p.id = $1 AND p.local_id = $2
        `, [id, local_id_usuario]);

        if (result.rows.length === 0) {
            // Se não encontrar, retorna JSON de erro em vez de HTML
            return res.status(404).json({ error: "Item não encontrado nesta unidade." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erro detalhes patrimônio:", err.message);
        res.status(500).json({ error: "Erro interno ao carregar detalhes." });
    }
});

// 1. Listar todos os locais cadastrados
router.get('/patrimonio/global/locais', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id, nome FROM locais ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar locais." });
    }
});

// 2. Listar setores de um local selecionado
router.get('/patrimonio/global/setores/:local_id', verificarToken, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, nome FROM setores WHERE local_id = $1 ORDER BY nome ASC",
            [req.params.local_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar setores." });
    }
});

// 3. Listar bens de um setor selecionado (com JOIN para obter nomes)
router.get('/patrimonio/global/bens/:setor_id', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, prod.nome as nome_produto, s.nome as nome_setor, l.nome as nome_local
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            JOIN setores s ON p.setor_id = s.id
            JOIN locais l ON p.local_id = l.id
            WHERE p.setor_id = $1
            ORDER BY prod.nome ASC
        `, [req.params.setor_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar bens." });
    }
});

// 4. Rota para Relatório Consolidado (PDF/Excel)
router.get('/patrimonio/global/relatorio/:local_id', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.nome as setor, prod.nome as produto, p.numero_serie, p.estado, p.nota_fiscal, p.data_atualizacao
            FROM patrimonios p
            JOIN setores s ON p.setor_id = s.id
            JOIN produtos prod ON p.produto_id = prod.id
            WHERE p.local_id = $1
            ORDER BY s.nome ASC, prod.nome ASC
        `, [req.params.local_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao gerar dados do relatório." });
    }
});

router.patch('/patrimonio/item/:id/estado', verificarToken, async (req, res) => {
    const { estado } = req.body;
    try {
        await db.query(
            "UPDATE patrimonios SET estado = $1, data_atualizacao = NOW() WHERE id = $2",
            [estado, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar estado." });
    }
});

router.get('/patrimonio/item/:id', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, prod.nome as produto_nome 
            FROM patrimonios p 
            JOIN produtos prod ON p.produto_id = prod.id 
            WHERE p.id = $1`, 
            [req.params.id]
        );
        
        if (result.rows.length === 0) return res.status(404).json({ error: "Item não encontrado." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar detalhes do item." });
    }
});

router.patch('/patrimonio/transferir/interno', verificarToken, async (req, res) => {
    const { patrimonio_id, novo_setor_id } = req.body;
    const usuario_id = req.userId;

    try {
        // Busca o local_id do usuário para segurança
        const userRes = await db.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const localId = userRes.rows[0]?.local_id;

        // Executa a atualização garantindo que o bem pertence ao local do usuário
        const result = await db.query(
            "UPDATE patrimonios SET setor_id = $1, data_atualizacao = NOW() WHERE id = $2 AND local_id = $3 RETURNING *",
            [novo_setor_id, patrimonio_id, localId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Item não encontrado ou permissão negada." });
        }

        res.json({ success: true, message: "Transferência concluída." });
    } catch (err) {
        console.error("Erro na transferência interna:", err);
        res.status(500).json({ error: "Erro ao processar transferência no banco." });
    }
});

router.post('/patrimonio/transferir/externo', verificarToken, async (req, res) => {
    const { patrimonio_id, local_destino_id } = req.body;
    try {
        await db.query(`
            UPDATE patrimonios 
            SET em_transito = true, local_destino_id = $1, data_atualizacao = NOW() 
            WHERE id = $2 AND local_id = (SELECT local_id FROM usuarios WHERE id = $3)`,
            [local_destino_id, patrimonio_id, req.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao iniciar transferência externa." });
    }
});

router.get('/patrimonio/pendencias-recebimento', verificarToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, prod.nome as produto_nome, l_origem.nome as local_origem
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            JOIN locais l_origem ON p.local_id = l_origem.id
            WHERE p.local_destino_id = (SELECT local_id FROM usuarios WHERE id = $1) 
            AND p.em_transito = true`, [req.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar pendências." });
    }
});

router.post('/patrimonio/responder-transferencia', verificarToken, async (req, res) => {
    const { patrimonio_id, decisao, setor_id, motivo_recusa } = req.body;
    try {
        if (decisao === 'ACEITAR') {
            // Se aceitou: Muda o local_id para o novo local, define o setor e desativa o trânsito
            await db.query(`
                UPDATE patrimonios 
                SET local_id = local_destino_id, 
                    setor_id = $1, 
                    em_transito = false, 
                    local_destino_id = NULL, 
                    data_atualizacao = NOW() 
                WHERE id = $2`, [setor_id, patrimonio_id]);
        } else {
            // Se recusou: Apenas desativa o trânsito e limpa o destino (o bem volta a ficar livre na origem)
            await db.query(`
                UPDATE patrimonios 
                SET em_transito = false, 
                    local_destino_id = NULL, 
                    data_atualizacao = NOW() 
                WHERE id = $1`, [patrimonio_id]);
            
            // Aqui você pode inserir no histórico o motivo_recusa se desejar
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar resposta: " + err.message });
    }
});

router.post('/patrimonio/importar-excel', verificarToken, async (req, res) => {
    const { base64File } = req.body;
    const usuario_id = req.userId;
    
    let processados = 0;
    let novosProdutosCriados = 0;
    let erros = [];
    
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const userRes = await client.query("SELECT local_id FROM usuarios WHERE id = $1", [usuario_id]);
        const localId = userRes.rows[0]?.local_id;

        const buffer = Buffer.from(base64File, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (const row of rows) {
            const { produto_nome, setor_nome, numero_serie, nota_fiscal, estado } = row;

            // 1. VALIDAÇÃO DE SÉRIE DUPLICADA (A "Cereja do Bolo")
            // Só validamos se o número de série for preenchido na planilha
            if (numero_serie && String(numero_serie).trim() !== '') {
                const serieExiste = await client.query(
                    "SELECT id FROM patrimonios WHERE LOWER(numero_serie) = LOWER($1)",
                    [String(numero_serie).trim()]
                );

                if (serieExiste.rowCount > 0) {
                    erros.push({ 
                        item: produto_nome, 
                        motivo: `O número de série '${numero_serie}' já existe no banco de dados.` 
                    });
                    continue; // Pula para o próximo item sem importar este
                }
            }

            // 2. VALIDAÇÃO DE SETOR
            const setorRes = await client.query(
                "SELECT id FROM setores WHERE LOWER(nome) = LOWER($1) AND local_id = $2",
                [String(setor_nome).trim(), localId]
            );

            if (setorRes.rowCount === 0) {
                erros.push({ item: produto_nome, motivo: `Setor '${setor_nome}' não encontrado.` });
                continue;
            }
            const setorId = setorRes.rows[0].id;

            // 3. BUSCA OU CRIAÇÃO DE PRODUTO
            let produtoId;
            const buscaProd = await client.query("SELECT id FROM produtos WHERE LOWER(nome) = LOWER($1)", [String(produto_nome).trim()]);
            
            if (buscaProd.rowCount > 0) {
                produtoId = buscaProd.rows[0].id;
            } else {
                const novoProd = await client.query(
                    "INSERT INTO produtos (nome, data_cadastro) VALUES ($1, NOW()) RETURNING id",
                    [String(produto_nome).trim().toUpperCase()]
                );
                produtoId = novoProd.rows[0].id;
                novosProdutosCriados++;
            }

            // 4. INSERÇÃO FINAL
            await client.query(
                `INSERT INTO patrimonios (produto_id, setor_id, local_id, numero_serie, nota_fiscal, estado, data_atualizacao) 
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [produtoId, setorId, localId, numero_serie, nota_fiscal, String(estado).toUpperCase()]
            );
            processados++;
        }

        await client.query('COMMIT');
        res.json({ 
            success: true, 
            importados: processados, 
            novos_produtos: novosProdutosCriados, 
            falhas: erros 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro crítico na importação:", err);
        res.status(500).json({ error: "Falha técnica ao processar planilha." });
    } finally {
        client.release();
    }
});

// 1. ROTA ESPECÍFICA PARA LISTAR LOCAIS NO MODAL (GET)
// Criamos um caminho novo: /locais/lista-para-transferencia
router.get('/locais/lista-para-transferencia', verificarToken, async (req, res) => {
    try {
        const result = await db.query("SELECT id, nome FROM locais ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar locais para transferência: " + err.message });
    }
});

// 2. ROTA ESPECÍFICA PARA EXECUTAR A TRANSFERÊNCIA (POST/PATCH)
// Já utiliza os campos 'em_transito' e 'local_destino_id' da sua tabela 'patrimonios'
router.post('/patrimonio/executar-transferencia-externa', verificarToken, async (req, res) => {
    const { patrimonio_id, local_destino_id } = req.body;
    
    try {
        await db.query(`
            UPDATE patrimonios 
            SET em_transito = true, 
                local_destino_id = $1, 
                data_atualizacao = NOW() 
            WHERE id = $2`, 
            [local_destino_id, patrimonio_id]
        );
        res.json({ success: true, message: "Bem colocado em trânsito com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao processar transferência externa: " + err.message });
    }
});

router.get('/patrimonio/verificar-pendencias', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.user ? req.user.id : req.userId;

        // Filtro Triplo de Isolamento:
        // 1. p.local_id != 51 -> Ignora itens no "Limbo" da Infra
        // 2. ped.status != 'AGUARDANDO_AUTORIZACAO' -> Apenas itens já aprovados
        // 3. ped.tipo_pedido != 'INFRA_PATRIMONIO' -> Ignora o fluxo de Logística Centralizada
        const result = await db.query(`
            SELECT p.id, prod.nome as produto_nome, l_origem.nome as local_origem, p.local_id as local_origem_id
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            JOIN locais l_origem ON p.local_id = l_origem.id
            JOIN pedidos ped ON p.pedido_id = ped.id
            WHERE p.local_destino_id = (SELECT local_id FROM usuarios WHERE id = $1) 
            AND p.em_transito = true
            AND p.local_id != 51
            AND ped.status != 'AGUARDANDO_AUTORIZACAO'
            AND ped.tipo_pedido != 'INFRA_PATRIMONIO'`, [usuarioId]);

        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar pendências:", err.message);
        res.status(500).json({ error: "Erro ao buscar pendências: " + err.message });
    }
});

router.get('/admin/auditoria-acessos', verificarToken, async (req, res) => {
    try {
        // Query que traz os contadores e os últimos 100 registos
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM ir_auditoria_acessos WHERE resultado = 'VISITA') as visitas,
                (SELECT COUNT(*) FROM ir_auditoria_acessos WHERE resultado = 'SUCESSO') as sucessos,
                (SELECT COUNT(*) FROM ir_auditoria_acessos WHERE resultado = 'FALHA') as falhas,
                (SELECT json_agg(t) FROM (
                    SELECT id, cpf_tentativa, ip_origem, data_hora, user_agent, resultado 
                    FROM ir_auditoria_acessos 
                    ORDER BY data_hora DESC 
                    LIMIT 100
                ) t) as logs
        `;
        
        const result = await db.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar auditoria: " + err.message });
    }
});

router.get('/patrimonio/proximo-numero/:prefixo', verificarToken, async (req, res) => {
    const { prefixo } = req.params;

    try {
        // Busca o maior número de série que comece com o prefixo da unidade
        const result = await db.query(
            "SELECT numero_serie FROM patrimonios WHERE numero_serie LIKE $1 ORDER BY id DESC LIMIT 1",
            [`${prefixo}-%`]
        );

        let proximoNumero = 1;

        if (result.rows.length > 0) {
            const ultimoSerie = result.rows[0].numero_serie;
            const partes = ultimoSerie.split('-');
            if (partes.length > 1) {
                proximoNumero = parseInt(partes[1]) + 1;
            }
        }

        res.json({ proximo: proximoNumero });
    } catch (err) {
        console.error("Erro ao calcular próximo número:", err.message);
        res.status(500).json({ error: "Erro interno ao gerar numeração." });
    }
});

router.put('/patrimonio/auditoria/vincular-etiqueta', verificarToken, async (req, res) => {
    const { id, patrimonio } = req.body;

    try {
        // Verifica se o número de patrimônio já existe em outro registro (Unicidade)
        const check = await db.query("SELECT id FROM patrimonios WHERE patrimonio = $1 AND id <> $2", [patrimonio, id]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: "Este número de patrimônio já está vinculado a outro bem." });
        }

        const result = await db.query(
            "UPDATE patrimonios SET patrimonio = $1, data_atualizacao = NOW() WHERE id = $2 RETURNING *",
            [patrimonio, id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: "Bem não encontrado." });

        res.json({ message: "Patrimônio vinculado com sucesso!", bem: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Erro ao salvar patrimônio." });
    }
});

router.get('/patrimonio/proximo-numero/:prefixo/:ano', verificarToken, async (req, res) => {
    const { prefixo, ano } = req.params;
    try {
        // Buscamos o último número de série gerado para este local e ano
        const result = await db.query(
            "SELECT numero_serie FROM patrimonios WHERE numero_serie LIKE $1 ORDER BY numero_serie DESC LIMIT 1",
            [`${prefixo}-${ano}-%`]
        );

        let proximoNumero = 1;
        if (result.rows.length > 0) {
            const ultimoSerie = result.rows[0].numero_serie;
            const partes = ultimoSerie.split('-'); 
            if (partes.length === 3) {
                // Pega a parte numérica e soma 1
                proximoNumero = parseInt(partes[2], 10) + 1;
            }
        }
        res.json({ proximo: proximoNumero });
    } catch (err) {
        console.error("Erro ao gerar sequência:", err.message);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

// Rota no seu arquivo de patrimônio (Backend)
// Supondo que você usa multer com: upload.single('arquivo')
// Rota de Cadastro Completa (Sem reticências, com todas as colunas)
router.post('/patrimonio/cadastrar', verificarToken, upload.single('arquivo'), async (req, res) => {
    const { 
        nome_produto, // Nome vindo do campo "cat-nome"
        quantidade, 
        serie_base, 
        setor_id, 
        local_id, 
        nota_fiscal, 
        adquirido_pos_2025 
    } = req.body;

    const url_nota_fiscal = req.file ? req.file.filename : null;
    const qtd = parseInt(quantidade, 10) || 1;

    try {
        await db.query('BEGIN'); // Inicia transação para segurança total

        // 1. RESOLVER O PRODUTO (Busca pelo nome ou cria um novo)
        let resProd = await db.query("SELECT id FROM produtos WHERE nome = $1 LIMIT 1", [nome_produto.toUpperCase()]);
        let produtoId;

        if (resProd.rows.length > 0) {
            produtoId = resProd.rows[0].id;
        } else {
            // Se o produto não existe, criamos um registro básico na tabela produtos
            const novoProd = await db.query(
                "INSERT INTO produtos (nome, local_id, tipo) VALUES ($1, $2, 'PATRIMONIO') RETURNING id",
                [nome_produto.toUpperCase(), local_id]
            );
            produtoId = novoProd.rows[0].id;
        }

        // 2. TRATAR A SÉRIE (Ex: "CL-25-0001 a 0005")
        const parteInicial = serie_base.split(' ')[0]; 
        const segmentos = parteInicial.split('-'); 
        const prefixo = segmentos[0];
        const ano = segmentos[1];
        let numSequencial = parseInt(segmentos[2], 10);

        // 3. LOOP DE INSERÇÃO NA TABELA PATRIMONIOS
        for (let i = 0; i < qtd; i++) {
            const serieUnica = `${prefixo}-${ano}-${String(numSequencial).padStart(4, '0')}`;
            
            await db.query(
                `INSERT INTO patrimonios (
                    produto_id, 
                    numero_serie, 
                    setor_id, 
                    local_id, 
                    nota_fiscal, 
                    url_nota_fiscal, 
                    estado, 
                    adquirido_pos_2025,
                    data_atualizacao,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'ESTOQUE')`,
                [
                    produtoId, 
                    serieUnica, 
                    setor_id, 
                    local_id, 
                    nota_fiscal || null, 
                    url_nota_fiscal, 
                    'BOM', 
                    adquirido_pos_2025 === 'true'
                ]
            );
            numSequencial++; 
        }

        await db.query('COMMIT');
        res.json({ success: true, message: `${qtd} item(ns) registrado(s) com sucesso!` });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erro no cadastro:", err);
        res.status(500).json({ error: "Falha ao gravar: " + err.message });
    }
});

router.get('/patrimonio/recentes/:local_id', verificarToken, async (req, res) => {
    const { local_id } = req.params;
    try {
        const result = await db.query(
            `SELECT p.nome AS nome_produto, pa.numero_serie, pa.data_atualizacao 
             FROM patrimonios pa
             JOIN produtos p ON pa.produto_id = p.id
             WHERE pa.local_id = $1 
             ORDER BY pa.id DESC LIMIT 15`, 
            [local_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para listar estoque disponível para transferência no local 37
router.get('/transferencia/disponivel', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, 
                p.nome, 
                COUNT(pa.id) AS quantidade_estoque
            FROM produtos p
            JOIN patrimonios pa ON p.id = pa.produto_id
            WHERE pa.local_id = 37 
              AND p.tipo = 'PATRIMONIO'
              AND pa.em_transito = false
            GROUP BY p.id, p.nome
            HAVING COUNT(pa.id) > 0
            ORDER BY p.nome ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar estoque: " + err.message });
    }
});

router.post('/transferencia/iniciar', verificarToken, async (req, res) => {
    const { produto_id, quantidade, local_destino_id } = req.body;
    const qtd = parseInt(quantidade);

    try {
        await db.query('BEGIN');

        // 1. Busca o ID do local virtual "TRANSFERÊNCIA"
        const resLocal = await db.query("SELECT id FROM locais WHERE nome = 'TRANSFERÊNCIA' LIMIT 1");
        if (resLocal.rows.length === 0) throw new Error("Local 'TRANSFERÊNCIA' não encontrado no sistema.");
        const idVirtual = resLocal.rows[0].id;

        // 2. Seleciona os IDs específicos dos patrimônios que serão movidos
        const resItens = await db.query(
            "SELECT id FROM patrimonios WHERE produto_id = $1 AND local_id = 37 AND em_transito = false LIMIT $2",
            [produto_id, qtd]
        );

        if (resItens.rows.length < qtd) throw new Error("Quantidade insuficiente em estoque.");

        // 3. Move cada item para o local virtual e marca como em trânsito
        for (let item of resItens.rows) {
            await db.query(
                `UPDATE patrimonios SET 
                    local_id = $1, 
                    local_destino_id = $2, 
                    em_transito = true,
                    data_atualizacao = NOW()
                 WHERE id = $3`,
                [idVirtual, local_destino_id, item.id]
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, message: "Transferência iniciada com sucesso!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Rota para listar produtos do tipo PATRIMONIO no Local 37
router.get('/transferencia/estoque-fonte', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, 
                p.nome, 
                COUNT(pa.id)::int AS quantidade_estoque
            FROM produtos p
            JOIN patrimonios pa ON p.id = pa.produto_id
            WHERE pa.local_id = 37 
              AND p.tipo = 'PATRIMONIO'
              AND pa.em_transito = false
            GROUP BY p.id, p.nome
            HAVING COUNT(pa.id) > 0
            ORDER BY p.nome ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar estoque: " + err.message });
    }
});

// Rota para iniciar a transferência (Move para local virtual 'TRANSFERÊNCIA')
router.post('/transferencia/enviar-itens', verificarToken, async (req, res) => {
    const { produto_id, quantidade, local_destino_id } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Localiza o ID do local virtual "TRANSFERÊNCIA"
        const resLocal = await db.query("SELECT id FROM locais WHERE nome = 'TRANSFERÊNCIA' LIMIT 1");
        if (resLocal.rows.length === 0) throw new Error("Local 'TRANSFERÊNCIA' não cadastrado.");
        const idTransferencia = resLocal.rows[0].id;

        // 2. Seleciona os itens específicos que serão transferidos
        const itensParaMover = await db.query(
            `SELECT id FROM patrimonios 
             WHERE produto_id = $1 AND local_id = 37 AND em_transito = false 
             LIMIT $2`,
            [produto_id, quantidade]
        );

        if (itensParaMover.rows.length < quantidade) {
            throw new Error("Quantidade insuficiente em estoque no momento.");
        }

        // 3. Atualiza os itens: mudam para o local virtual e ficam em trânsito
        const ids = itensParaMover.rows.map(i => i.id);
        await db.query(
            `UPDATE patrimonios SET 
                local_id = $1, 
                local_destino_id = $2, 
                em_transito = true,
                data_atualizacao = NOW()
             WHERE id = ANY($3)`,
            [idTransferencia, local_destino_id, ids]
        );

        await db.query('COMMIT');
        res.json({ success: true, message: "Itens enviados para transferência!" });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// A. Listar solicitações pendentes (agrupadas por produto e destino)
router.get('/transferencia/pendentes-infra', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id AS produto_id,
                p.nome AS produto_nome,
                l.id AS destino_id,
                l.nome AS destino_nome,
                COUNT(pa.id)::int AS quantidade,
                MIN(pa.data_atualizacao) as data_solicitacao
            FROM patrimonios pa
            JOIN produtos p ON pa.produto_id = p.id
            JOIN locais l ON pa.local_destino_id = l.id
            WHERE pa.em_transito = true 
              AND pa.local_id = (SELECT id FROM locais WHERE nome = 'TRANSFERÊNCIA' LIMIT 1)
            GROUP BY p.id, p.nome, l.id, l.nome
            ORDER BY p.nome ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B. Rejeitar Transferência (Devolve para o local 37)
router.post('/transferencia/rejeitar', verificarToken, async (req, res) => {
    const { produto_id, destino_id } = req.body;
    try {
        await db.query(
            `UPDATE patrimonios SET 
                local_id = 37, 
                local_destino_id = NULL, 
                em_transito = false 
             WHERE produto_id = $1 AND local_destino_id = $2 AND em_transito = true`,
            [produto_id, destino_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// C. Finalizar Transferência (Move itens selecionados para o destino final)
router.post('/transferencia/finalizar', verificarToken, async (req, res) => {
    const { patrimonio_ids, destino_id } = req.body;
    try {
        await db.query(
            `UPDATE patrimonios SET 
                local_id = $1, 
                local_destino_id = NULL, 
                em_transito = false,
                data_atualizacao = NOW()
             WHERE id = ANY($2)`,
            [destino_id, patrimonio_ids]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/transferencia/contagem-infra', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT COUNT(*) as total
            FROM (
                SELECT produto_id, local_destino_id
                FROM patrimonios
                WHERE em_transito = true 
                AND local_id = (SELECT id FROM locais WHERE nome = 'TRANSFERÊNCIA' LIMIT 1)
                GROUP BY produto_id, local_destino_id
            ) AS pendencias
        `;
        const result = await db.query(query);
        res.json({ total: parseInt(result.rows[0].total) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exemplo usando pg-pool ou similar
router.post('/entrada', async (req, res) => {
    const { itens } = req.body; // Array de objetos {produto_id, tipo, qtd_total, grades: [{tamanho, qtd}]}
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        for (const item of itens) {
            // 1. Atualiza a tabela principal 'produtos'
            await client.query(
                'UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2',
                [item.qtd_total, item.produto_id]
            );

            // 2. Se for UNIFORME, atualiza a grade 'estoque_tamanhos'
            if (item.tipo === 'UNIFORMES' && item.grades) {
                for (const grade of item.grades) {
                    await client.query(
                        `INSERT INTO estoque_tamanhos (produto_id, tamanho, quantidade) 
                         VALUES ($1, $2, $3)
                         ON CONFLICT (produto_id, tamanho) 
                         DO UPDATE SET quantidade = estoque_tamanhos.quantidade + EXCLUDED.quantidade`,
                        [item.produto_id, grade.tamanho, grade.qtd]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Estoque atualizado com sucesso!' });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Sugestão de implementação (Node.js/Express)
router.post('/estoque/entrada-lote', async (req, res) => {
    const { itens, usuario_id, observacoes } = req.body;
    const client = await db.pool.connect(); 

    try {
        await client.query('BEGIN');

        const totalGeral = itens.reduce((acc, item) => acc + (parseInt(item.qtd_total) || 0), 0);

        const resMaster = await client.query(
            `INSERT INTO historico (usuario_id, acao, quantidade_total, observacoes, local_id, tipo) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [usuario_id, 'ENTRADA DE ESTOQUE', totalGeral, observacoes || '', 37, 'ENTRADA']
        );
        const historicoId = resMaster.rows[0].id;

        for (const item of itens) {
            if (item.tipo === 'MATERIAL') {
                await client.query(
                    `INSERT INTO estoque_por_local (local_id, produto_id, tamanho, quantidade)
                     VALUES (37, $1, NULL, $2)
                     ON CONFLICT (local_id, produto_id, tamanho) 
                     DO UPDATE SET quantidade = estoque_por_local.quantidade + EXCLUDED.quantidade;`,
                    [item.produto_id, item.qtd_total]
                );
                
                await client.query(
                    `INSERT INTO historico_detalhes (historico_id, produto_id, quantidade, tipo_produto) VALUES ($1, $2, $3, 'MATERIAL')`,
                    [historicoId, item.produto_id, item.qtd_total]
                );

            } else if (item.tipo === 'UNIFORMES') {
                for (const [tamanho, qtd] of Object.entries(item.grade)) {
                    if (qtd > 0) {
                        await client.query(
                            `INSERT INTO estoque_por_local (local_id, produto_id, tamanho, quantidade)
                             VALUES (37, $1, $2, $3)
                             ON CONFLICT (local_id, produto_id, tamanho) 
                             DO UPDATE SET quantidade = estoque_por_local.quantidade + EXCLUDED.quantidade;`,
                            [item.produto_id, tamanho, qtd]
                        );

                        await client.query(
                            `INSERT INTO historico_detalhes (historico_id, produto_id, quantidade, tamanho, tipo_produto) VALUES ($1, $2, $3, $4, 'UNIFORMES')`,
                            [historicoId, item.produto_id, qtd, tamanho]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Estoque de consumo atualizado com sucesso." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO CRÍTICO NA ENTRADA EM LOTE (v2):", err.message);
        res.status(500).json({ success: false, error: "Erro ao processar entrada no banco de dados." });
    } finally {
        client.release();
    }
});

router.get('/estoque/consulta-geral', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id, p.nome, p.tipo, p.quantidade_estoque,
                COALESCE(
                    (SELECT json_agg(json_build_object('tamanho', et.tamanho, 'quantidade', et.quantidade) ORDER BY et.id)
                     FROM estoque_tamanhos et 
                     WHERE et.produto_id = p.id), 
                    '[]'
                ) AS grade
            FROM produtos p
            WHERE p.tipo IN ('MATERIAL', 'UNIFORMES')
              AND p.local_id = 37
            ORDER BY 
                CASE WHEN p.tipo = 'UNIFORMES' THEN 1 ELSE 2 END, 
                p.nome ASC;
        `;

        // Se o seu arquivo usa 'db', mude para db.query
        const { rows } = await pool.query(sql); 
        res.json(rows);
    } catch (err) {
        console.error("ERRO NA ROTA:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// ROTA EXCLUSIVA PARA CONSULTA UNIFICADA (ESTOQUE + GRADE)
router.get('/estoque/consulta-exclusiva', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id, 
                p.nome, 
                p.tipo, 
                p.alerta_minimo,
                -- Busca o estoque TOTAL do produto somando todas as grades/quantidades no local 37
                COALESCE((SELECT SUM(quantidade) FROM estoque_por_local WHERE produto_id = p.id AND local_id = 37), 0) as quantidade_estoque,
                -- Monta a grade de tamanhos buscando diretamente da nova tabela de estoque por local
                COALESCE(
                    (SELECT json_agg(
                        json_build_object('tamanho', epl.tamanho, 'quantidade', epl.quantidade) 
                    )
                     FROM estoque_por_local epl
                     WHERE epl.produto_id = p.id AND epl.local_id = 37 AND epl.tamanho IS NOT NULL), 
                    '[]'::json
                ) AS grade
            FROM produtos p
            WHERE p.local_id = 37 -- Busca apenas o catálogo de produtos do Almoxarifado Central
              AND p.tipo != 'PATRIMONIO'
            ORDER BY 
                CASE WHEN p.tipo = 'MATERIAL' THEN 1 ELSE 2 END, 
                p.nome ASC;
        `;

        const { rows } = await db.query(sql); 
        res.json(rows);
    } catch (err) {
        console.error("ERRO NA ROTA EXCLUSIVA (v2):", err.message);
        res.status(500).json({ error: "Erro ao processar consulta de estoque no banco." });
    }
});

// Rota para buscar o histórico detalhado
router.get('/estoque/historico-completo', async (req, res) => {
    try {
        const sql = `
            SELECT 
                h.id, 
                h.data AS data_hora, 
                h.observacoes, 
                u.nome AS nome_usuario,
                json_agg(
                    json_build_object(
                        'nome_produto', p.nome,
                        'quantidade', hd.quantidade,
                        'tamanho', hd.tamanho
                    )
                ) AS itens
            FROM historico h
            JOIN usuarios u ON h.usuario_id = u.id
            JOIN historico_detalhes hd ON h.id = hd.historico_id
            JOIN produtos p ON hd.produto_id = p.id
            WHERE h.local_id = 37
            GROUP BY h.id, u.nome
            ORDER BY h.data DESC
            LIMIT 50;
        `;

        const { rows } = await db.query(sql); // Usando db.query do seu db.js
        res.json(rows);
    } catch (err) {
        console.error("ERRO AO BUSCAR HISTÓRICO:", err.message);
        res.status(500).json({ error: "Erro ao carregar histórico no banco de dados." });
    }
});

// backend/routes/api.routes.js
router.post('/estoque/saida-pedido', async (req, res) => {
    const { itens, local_destino_id, usuario_id } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Criar o Pedido com status APROVADO
        // O status permanece APROVADO conforme seu código, para que o outro usuário o processe.
        const resPedido = await client.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, data_criacao, data_autorizacao, autorizado_por, tipo_pedido) 
             VALUES ($1, $2, 'APROVADO', NOW(), NOW(), $1, 'SAIDA_DIRETA') 
             RETURNING id`,
            [usuario_id, local_destino_id]
        );
        const pedidoId = resPedido.rows[0].id;

        // 2. Registro Mestre no Histórico
        const totalGeral = itens.reduce((acc, item) => acc + Number(item.qtd_total), 0);
        const resHist = await client.query(
            `INSERT INTO historico (usuario_id, acao, quantidade_total, local_id, tipo, observacoes) 
             VALUES ($1, $2, $3, $4, 'SAIDA', $5) RETURNING id`,
            [usuario_id, 'PEDIDO', totalGeral, 37, `Pedido de Saída Gerado #${pedidoId}`]
        );
        const historicoId = resHist.rows[0].id;

        for (const item of itens) {
            if (item.tipo === 'MATERIAL') {
                // APENAS INSERE O ITEM NO PEDIDO E NO HISTÓRICO
                // A atualização de saldo (UPDATE estoque_por_local) foi removida daqui.
                await client.query(
                    `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade) VALUES ($1, $2, $3)`,
                    [pedidoId, item.produto_id, item.qtd_total]
                );

                await client.query(
                    `INSERT INTO historico_detalhes (historico_id, produto_id, quantidade, tipo_produto) VALUES ($1, $2, $3, 'MATERIAL')`,
                    [historicoId, item.produto_id, item.qtd_total]
                );

            } else if (item.tipo === 'UNIFORMES') {
                for (const [tamanho, qtd] of Object.entries(item.grade)) {
                    if (qtd > 0) {
                        // APENAS INSERE O ITEM NO PEDIDO E NO HISTÓRICO
                        // A atualização de saldo (UPDATE estoque_por_local) foi removida daqui.
                        await client.query(
                            `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, tamanho) VALUES ($1, $2, $3, $4)`,
                            [pedidoId, item.produto_id, qtd, tamanho]
                        );

                        await client.query(
                            `INSERT INTO historico_detalhes (historico_id, produto_id, quantidade, tamanho, tipo_produto) VALUES ($1, $2, $3, $4, 'UNIFORMES')`,
                            [historicoId, item.produto_id, qtd, tamanho]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, pedidoId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO AO REGISTRAR PEDIDO:", err.message);
        res.status(500).json({ error: "Erro ao processar registro do pedido: " + err.message });
    } finally {
        client.release();
    }
});

// Rota para listar todos os locais (Unidades)
router.get('/locais', async (req, res) => {
    try {
        // Busca id e nome da tabela locais
        const sql = 'SELECT id, nome FROM locais ORDER BY nome ASC';
        const { rows } = await db.query(sql); // Usando db.query conforme seu db.js
        
        res.json(rows);
    } catch (err) {
        console.error("ERRO AO BUSCAR LOCAIS:", err.message);
        res.status(500).json({ 
            error: "Erro interno ao buscar a lista de unidades no banco de dados." 
        });
    }
});

// Rota exclusiva para autorizar pedido com baixa de estoque e histórico
router.post('/estoque/confirmar-autorizacao', async (req, res) => {
    const { pedido_id, itens, usuario_id } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        const resStatusAnt = await client.query(`SELECT status FROM pedidos WHERE id = $1`, [pedido_id]);
        const statusAnterior = resStatusAnt.rows[0]?.status || 'DESCONHECIDO';        

        // 1. Atualiza o Pedido: Status para 'AUTORIZADO', data e quem autorizou
        await client.query(
            `UPDATE pedidos 
             SET status = 'APROVADO', 
                 data_autorizacao = NOW(), 
                 autorizado_por = $1 
             WHERE id = $2`,
            [usuario_id, pedido_id]
        );
        await client.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) 
            VALUES ($1, $2, $3, $4, $5)`,
            [pedido_id, usuario_id, statusAnterior, 'APROVADO', 'Saída confirmada pelo Almoxarifado Central com baixa automática.']
        );
        // 2. Criar registro Mestre no Histórico (Saída do Almoxarifado 37)
        const totalGeral = itens.reduce((acc, item) => acc + Number(item.quantidade), 0);
        const resHist = await client.query(
            `INSERT INTO historico (usuario_id, acao, quantidade_total, local_id, tipo, observacoes) 
             VALUES ($1, $2, $3, $4, 'SAIDA', $5) RETURNING id`,
            [usuario_id, 'AUTORIZACAO PEDIDO', totalGeral, 37, `Saída autorizada para Pedido #${pedido_id}`]
        );
        const historicoId = resHist.rows[0].id;

        for (const item of itens) {
            // 3. Atualiza as quantidades no Pedido (caso tenham sido editadas no modal)
            await client.query(
                `UPDATE itens_pedido SET quantidade = $1 WHERE pedido_id = $2 AND produto_id = $3 AND (tamanho = $4 OR (tamanho IS NULL AND $4 IS NULL))`,
                [item.quantidade, pedido_id, item.produto_id, item.tamanho || null]
            );

            // 4. Baixa no Estoque Global (Tabela produtos)
            await client.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2`,
                [item.quantidade, item.produto_id]
            );

            // 5. Registros detalhados e baixas específicas (Uniformes)
            if (item.tipo === 'UNIFORMES') {
                // Baixa na Grade
                await client.query(
                    `UPDATE estoque_tamanhos SET quantidade = quantidade - $1 
                     WHERE produto_id = $2 AND tamanho = $3`,
                    [item.quantidade, item.produto_id, item.tamanho]
                );
                // Histórico Detalhado
                await client.query(
                    `INSERT INTO historico_detalhes (historico_id, produto_id, quantidade, tamanho, tipo_produto) 
                     VALUES ($1, $2, $3, $4, 'UNIFORMES')`,
                    [historicoId, item.produto_id, item.quantidade, item.tamanho]
                );
            } else {
                // Material: Histórico Detalhado
                await client.query(
                    `INSERT INTO historico_detalhes (historico_id, produto_id, quantidade, tipo_produto) 
                     VALUES ($1, $2, $3, 'MATERIAL')`,
                    [historicoId, item.produto_id, item.quantidade]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Pedido autorizado e estoque atualizado!" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NA AUTORIZAÇÃO:", err.message);
        res.status(500).json({ error: "Erro ao processar autorização: " + err.message });
    } finally {
        client.release();
    }
});

// ROTA CIRÚRGICA: Baseada no seu backup funcional
router.get('/escola/painel-v2', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.user.id; // Padronizado para req.user.id

        const query = `
            SELECT 
                pr.id as remessa_id,
                pr.pedido_id,
                pr.data_criacao,
                l.nome as escola_nome,
                p.status as status_pedido,
                p.tipo_pedido -- Fundamental para o Frontend saber o que exibir
            FROM usuarios u
            JOIN locais l ON u.local_id = l.id
            JOIN pedidos p ON p.local_destino_id = l.id
            JOIN pedido_remessas pr ON pr.pedido_id = p.id
            WHERE u.id = $1 
            AND (pr.status IN ('EM_TRANSPORTE', 'APROVADO') OR p.status = 'COLETA_LIBERADA') 
            ORDER BY pr.id DESC
        `;

        const { rows } = await db.query(query, [usuarioId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/escola/confirmar-recebimento-exclusivo', verificarToken, async (req, res) => {
    const { remessaId } = req.body;
    const idUsuarioLogado = req.userId; // Vem do middleware verificarToken
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Busca o local_id do técnico e valida o vínculo
        const resUser = await client.query("SELECT local_id FROM usuarios WHERE id = $1", [idUsuarioLogado]);
        const localIdTecnico = resUser.rows[0]?.local_id;

        if (!localIdTecnico) throw new Error("Usuário não vinculado a uma unidade escolar.");

        // 2. Busca o Pedido, o Status Atual e o Destino para validar a posse
        const resRem = await client.query(`
            SELECT p.id, p.local_destino_id, p.status 
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            WHERE pr.id = $1`, [remessaId]);

        if (resRem.rows.length === 0) throw new Error("Remessa não localizada.");
        
        const pedido = resRem.rows[0];

        // Validação cirúrgica: a escola só recebe o que é dela
        if (pedido.local_destino_id !== localIdTecnico) {
            throw new Error("Acesso negado. Esta carga é destinada a outra unidade.");
        }

        // 3. Atualiza o Pedido para 'ENTREGUE'
        await client.query(
            "UPDATE pedidos SET status = 'ENTREGUE', data_recebimento = NOW() WHERE id = $1",
            [pedido.id]
        );

        // 4. REGISTRO NO LOG DE STATUS (Auditoria completa)
        await client.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
                pedido.id, 
                idUsuarioLogado, 
                pedido.status,      // Status que estava no banco (ex: EM_TRANSPORTE)
                'ENTREGUE',         // Novo status
                'Carga recebida e conferida pela unidade escolar via Painel de Recebimento.'
            ]
        );

        // 5. Atualiza o estoque da unidade (Upsert)
        const resItens = await client.query(
            "SELECT produto_id, tamanho, quantidade FROM itens_pedido WHERE pedido_id = $1",
            [pedido.id]
        );

        for (const item of resItens.rows) {
            await client.query(`
                INSERT INTO estoque_individual (local_id, produto_id, tamanho, quantidade)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (local_id, produto_id, COALESCE(tamanho, '')) 
                DO UPDATE SET quantidade = estoque_individual.quantidade + EXCLUDED.quantidade`,
                [localIdTecnico, item.produto_id, item.tamanho, item.quantidade]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Recebimento registrado com sucesso!" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NO RECEBIMENTO:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post('/estoque/confirmar-inicio-transporte', verificarToken, async (req, res) => {
    const { remessaId } = req.body;
    const usuarioId = req.userId; // ID do técnico que está enviando
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Localiza o pedido e o status atual para o LOG
        const resDados = await client.query(`
            SELECT p.id as pedido_id, p.status as status_atual 
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            WHERE pr.id = $1`, [remessaId]);

        if (resDados.rows.length === 0) throw new Error("Remessa não encontrada.");
        const { pedido_id, status_atual } = resDados.rows[0];

        // 2. Atualiza o status do PEDIDO
        await client.query(
            "UPDATE pedidos SET status = 'EM_TRANSPORTE' WHERE id = $1",
            [pedido_id]
        );

        // 3. Atualiza o status da REMESSA
        await client.query(
            "UPDATE pedido_remessas SET status = 'EM_TRANSPORTE' WHERE id = $1",
            [remessaId]
        );

        // 4. REGISTRO NO LOG (Seguindo seu padrão exato)
        await client.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao) 
             VALUES ($1, $2, $3, 'EM_TRANSPORTE', $4)`,
            [
                pedido_id, 
                usuarioId, 
                status_atual, 
                `Transporte iniciado. Romaneio gerado para a Remessa #${remessaId}.`
            ]
        );

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO AO INICIAR TRANSPORTE:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ROTA EXCLUSIVA: Resumo para o Painel Gerencial
router.get('/gerencial/resumo-status', verificarToken, async (req, res) => {
    try {
        const sql = `
            SELECT status, COUNT(*) as quantidade 
            FROM pedidos 
            GROUP BY status;
        `;
        const { rows } = await db.query(sql);
        
        // Formata os dados para facilitar o frontend
        const resumo = rows.reduce((acc, row) => {
            acc[row.status] = row.quantidade;
            return acc;
        }, {});

        res.json(resumo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA EXCLUSIVA: Lista pedidos por status específico
router.get('/gerencial/lista-por-status/:status', verificarToken, async (req, res) => {
    try {
        const { status } = req.params;
        const sql = `
            SELECT p.id, p.data_criacao, l.nome as destino, p.status
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            WHERE p.status = $1
            ORDER BY p.data_criacao DESC;
        `;
        const { rows } = await db.query(sql, [status]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/admin/dashboard/detalhes/:fase', verificarToken, async (req, res) => {
    const { fase } = req.params;

    try {
        let sql = "";
        let params = [];

        if (fase === 'TRANSFERÊNCIA (50)' || fase === 'TRÂNSITO (51)') {
            const localAlvo = fase.includes('50') ? 50 : 51;
            sql = `
                SELECT p.id, l.nome as escola, p.numero_serie as info_extra
                FROM patrimonios p 
                LEFT JOIN locais l ON p.local_destino_id = l.id 
                WHERE p.local_id = $1
                ORDER BY p.data_atualizacao DESC;
            `;
            params = [localAlvo];
        } else if (fase === 'ENTREGUE') {
            sql = `
                SELECT p.id, l.nome as escola, p.status 
                FROM pedidos p 
                JOIN locais l ON p.local_destino_id = l.id 
                WHERE p.status IN ('ENTREGUE', 'RECEBIDO')
                ORDER BY p.id DESC;
            `;
        } else {
            const mapaStatus = {
                'SOLICITADO': 'AGUARDANDO_AUTORIZACAO',
                'AUTORIZADO': 'APROVADO',
                'EM SEPARAÇÃO': 'EM_SEPARACAO',
                'PRONTO PARA ENTREGA': 'COLETA_LIBERADA',
                'A CAMINHO': 'EM_TRANSPORTE'
            };
            sql = `
                SELECT p.id, l.nome as escola, p.status 
                FROM pedidos p 
                JOIN locais l ON p.local_destino_id = l.id 
                WHERE p.status = $1
                ORDER BY p.id DESC;
            `;
            params = [mapaStatus[fase] || fase];
        }

        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA: Buscar itens detalhados de um pedido para o Modal
router.get('/admin/dashboard/itens/:pedidoId', verificarToken, async (req, res) => {
    const { pedidoId } = req.params;

    try {
        const sql = `
            SELECT 
                p.nome as produto,
                ip.tamanho,
                ip.quantidade as solicitado
            FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id
            WHERE ip.pedido_id = $1
            ORDER BY p.nome ASC;
        `;
        const { rows } = await db.query(sql, [pedidoId]);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar itens do pedido:", err.message);
        res.status(500).json({ error: "Erro ao carregar itens: " + err.message });
    }
});

// ROTA: Buscar estoque exclusivo da unidade escolar
router.get('/escola/meu-estoque', verificarToken, async (req, res) => {
    const localId = req.query.localId || req.user?.local_id;
    if (!localId) {
        return res.status(400).json({ error: "Identificação da unidade não fornecida." });
    }

    try {
        const sql = `
            SELECT
                p.id,
                p.tipo as tipo_item,
                p.nome as produto,
                SUM(epl.quantidade) as quantidade,
                CASE WHEN SUM(epl.quantidade) > 0 THEN 'DISPONIVEL' ELSE 'ESGOTADO' END as status,
                json_agg(
                    json_build_object('tamanho', epl.tamanho, 'quantidade', epl.quantidade)
                ) AS grade
            FROM estoque_por_local epl
            JOIN produtos p ON epl.produto_id = p.id
            WHERE epl.local_id = $1 AND epl.quantidade > 0
            GROUP BY p.id, p.nome, p.tipo
            ORDER BY produto;
        `;
        const { rows } = await db.query(sql, [localId]);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao consultar estoque local:", err.message);
        res.status(500).json({ error: "Erro interno ao buscar estoque." });
    }
});

// ROTA: Listar Etapas de Ensino (Para preencher o Select no formulário)
router.get('/escola/etapas', verificarToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM etapas_ensino ORDER BY id ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar etapas: " + err.message });
    }
});

// ROTA: Listar Turmas da Unidade (Isolado por local_id)
router.get('/escola/turmas', verificarToken, async (req, res) => {
    const localId = req.user.local_id; // Pegamos do Token para total segurança
    try {
        const sql = `
            SELECT t.*, e.nome as etapa_nome 
            FROM turmas t
            JOIN etapas_ensino e ON t.etapa_id = e.id
            WHERE t.local_id = $1
            ORDER BY e.id ASC, t.nome ASC
        `;
        const { rows } = await db.query(sql, [localId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar turmas: " + err.message });
    }
});

// ROTA: Cadastrar Nova Turma
router.post('/escola/turmas', verificarToken, async (req, res) => {
    const { nome, etapaId, anoLetivo } = req.body;
    const localId = req.user.local_id;

    try {
        const sql = `
            INSERT INTO turmas (nome, etapa_id, local_id, ano_letivo) 
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const { rows } = await db.query(sql, [nome.toUpperCase(), etapaId, localId, anoLetivo || 2026]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Já existe uma turma com este nome na sua escola." });
        }
        res.status(500).json({ error: "Erro ao salvar turma: " + err.message });
    }
});

// ROTA: Listar Alunos da Unidade (com filtro de turma opcional)
router.get('/escola/alunos', verificarToken, async (req, res) => {
    const localId = req.user.local_id;
    try {
        const sql = `
            SELECT a.*, t.nome as turma_nome, e.nome as etapa_nome
            FROM alunos a
            LEFT JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN etapas_ensino e ON t.etapa_id = e.id
            WHERE a.local_id = $1
            ORDER BY a.nome ASC
        `;
        const { rows } = await db.query(sql, [localId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar alunos: " + err.message });
    }
});

// ROTA: Cadastrar Novo Aluno
router.post('/escola/alunos', verificarToken, async (req, res) => {
    const { nome, matricula, turmaId } = req.body;
    const localId = req.user.local_id;

    try {
        const sql = `
            INSERT INTO alunos (nome, matricula, turma_id, local_id) 
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const { rows } = await db.query(sql, [nome.toUpperCase(), matricula, turmaId, localId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Erro de matrícula duplicada
            return res.status(400).json({ error: "Esta matrícula já está cadastrada no sistema." });
        }
        res.status(500).json({ error: "Erro ao salvar aluno: " + err.message });
    }
});

// ROTA: Realizar a entrega de um item para o aluno
router.post('/escola/entregar-item', verificarToken, async (req, res) => {
    const { alunoId, estoqueId, observacao } = req.body;
    const usuarioId = req.user.id;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verificar se o item ainda está disponível
        const checkItem = await client.query(
            "SELECT status FROM estoque_individual WHERE id = $1 AND status = 'DISPONIVEL' FOR UPDATE",
            [estoqueId]
        );

        if (checkItem.rows.length === 0) {
            throw new Error("Este item já foi entregue ou não está disponível.");
        }

        // 2. Registrar a entrega na tabela de histórico
        await client.query(
            `INSERT INTO entregas_alunos (aluno_id, estoque_id, usuario_id, observacao) 
             VALUES ($1, $2, $3, $4)`,
            [alunoId, estoqueId, usuarioId, observacao || 'Entrega de uniforme/material regular.']
        );

        // 3. Mudar o status no estoque para 'ENTREGUE'
        await client.query(
            "UPDATE estoque_individual SET status = 'ENTREGUE' WHERE id = $1",
            [estoqueId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Entrega realizada com sucesso!" });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ROTA: Buscar alunos ativos que ainda não receberam uniforme
router.get('/escola/alunos-pendentes', verificarToken, async (req, res) => {
    const localId = req.user.local_id; // Pegamos do token para total segurança

    try {
        const sql = `
            SELECT 
                a.matricula,
                a.nome as aluno_nome,
                t.nome as turma_nome,
                e.nome as etapa_nome
            FROM alunos a
            JOIN turmas t ON a.turma_id = t.id
            JOIN etapas_ensino e ON t.etapa_id = e.id
            WHERE a.local_id = $1 
              AND a.status = 'ATIVO'
              AND NOT EXISTS (
                  SELECT 1 
                  FROM entregas_alunos ea
                  JOIN estoque_individual ei ON ea.estoque_id = ei.id
                  JOIN produtos p ON ei.produto_id = p.id
                  WHERE ea.aluno_id = a.id
                  -- Opcional: Filtrar apenas por categoria 'UNIFORME' no futuro
              )
            ORDER BY e.id ASC, t.nome ASC, a.nome ASC;
        `;
        const { rows } = await db.query(sql, [localId]);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar alunos pendentes:", err.message);
        res.status(500).json({ error: "Erro interno ao gerar listagem de pendências." });
    }
});

// ROTA: Buscar logs de alteração de status com filtros de data
router.get('/admin/relatorios/log-status', verificarToken, async (req, res) => {
    const { inicio, fim } = req.query;

    try {
        const sql = `
            SELECT 
                l.id,
                l.data_hora,
                l.pedido_id,
                u.nome as usuario_nome,
                l.status_anterior,
                l.status_novo,
                l.observacao,
                loc.nome as unidade_destino
            FROM log_status_pedidos l
            JOIN usuarios u ON l.usuario_id = u.id
            JOIN pedidos p ON l.pedido_id = p.id
            JOIN locais loc ON p.local_destino_id = loc.id
            WHERE l.data_hora::date BETWEEN $1 AND $2
            ORDER BY l.data_hora DESC;
        `;
        const { rows } = await db.query(sql, [inicio, fim]);

        // Estatísticas para os cards
        const stats = {
            total: rows.length,
            porUsuario: {},
            porStatus: {}
        };

        rows.forEach(r => {
            stats.porUsuario[r.usuario_nome] = (stats.porUsuario[r.usuario_nome] || 0) + 1;
            stats.porStatus[r.status_novo] = (stats.porStatus[r.status_novo] || 0) + 1;
        });

        res.json({ registros: rows, stats });
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar log: " + err.message });
    }
});

// ROTA: Buscar inventário de patrimônio por local
router.get('/admin/relatorios/patrimonio-local', verificarToken, async (req, res) => {
    const { localId } = req.query;

    if (!localId) return res.status(400).json({ error: "Selecione um local." });

    try {
        const sql = `
            SELECT 
                p.id,
                p.patrimonio as tag,
                prod.nome as produto_nome,
                p.numero_serie,
                s.nome as setor_nome,
                p.estado,
                p.status,
                p.nota_fiscal,
                p.adquirido_pos_2025
            FROM patrimonios p
            JOIN produtos prod ON p.produto_id = prod.id
            LEFT JOIN setores s ON p.setor_id = s.id
            WHERE p.local_id = $1
            ORDER BY s.nome ASC, prod.nome ASC;
        `;
        const { rows } = await db.query(sql, [localId]);

        // Estatísticas para os cards
        const stats = {
            total: rows.length,
            bomEstado: rows.filter(r => r.estado === 'BOM').length,
            emUso: rows.filter(r => r.status === 'EM_USO' || r.status === 'ATIVO').length
        };

        res.json({ registros: rows, stats });
    } catch (err) {
        res.status(500).json({ error: "Erro ao gerar inventário: " + err.message });
    }
});

// ROTA: Relatório de Transferências Externas (Entre Unidades)
router.get('/admin/relatorios/transferencias-externas', verificarToken, async (req, res) => {
    const { inicio, fim } = req.query;

    try {
        const sql = `
            SELECT 
                h.id,
                h.data_movimentacao,
                p.patrimonio as tag,
                prod.nome as produto,
                l_origem.nome as origem,
                l_destino.nome as destino,
                u.nome as operador,
                h.status, -- 'CONCLUIDO', 'RECUSADO', 'PENDENTE'
                h.observacao as motivo
            FROM historico_movimentacoes h
            JOIN patrimonios p ON h.patrimonio_id = p.id
            JOIN produtos prod ON p.produto_id = prod.id
            JOIN locais l_origem ON h.local_origem_id = l_origem.id
            JOIN locais l_destino ON h.local_destino_id = l_destino.id
            JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.data_movimentacao::date BETWEEN $1 AND $2
              AND h.local_origem_id <> h.local_destino_id -- SOMENTE EXTERNAS
            ORDER BY h.data_movimentacao DESC;
        `;
        const { rows } = await db.query(sql, [inicio, fim]);

        const stats = {
            total: rows.length,
            concluidas: rows.filter(r => r.status === 'CONCLUIDO' || r.status === 'ACEITO').length,
            recusadas: rows.filter(r => r.status === 'RECUSADO').length
        };

        res.json({ registros: rows, stats });
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar transferências: " + err.message });
    }
});

// ROTA: Buscar todos os pedidos com status COLETA_LIBERADA (Prontos para sair)
router.get('/admin/relatorios/coleta-liberada', verificarToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id,
                p.data_criacao,
                p.data_separacao,
                l.nome as unidade_destino,
                u.nome as solicitante,
                p.volumes,
                p.tipo_pedido
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE p.status = 'COLETA_LIBERADA'
            ORDER BY p.data_separacao ASC NULLS LAST, p.data_criacao ASC;
        `;
        const { rows } = await db.query(sql);

        const registros = rows.map(r => {
            // Preferir data_separacao; se nula, usar data_criacao
            const pronto_desde = r.data_separacao || r.data_criacao;
            return {
                ...r,
                pronto_desde
            };
        });

        const stats = {
            totalPedidos: registros.length,
            totalVolumes: rows.reduce((acc, curr) => acc + (curr.volumes || 0), 0)
        };

        res.json({ registros, stats });
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar mapa de coleta: " + err.message });
    }
});

// 1. ROTA: Listar solicitações pendentes (Exclusiva)
router.get('/infra/solicitacoes', verificarToken, async (req, res) => {
    try {
        // Assume-se que você tenha uma tabela 'solicitacoes_infra' ou similar
        // que o perfil logistica preenche.
        const sql = `
            SELECT s.*, p.nome as produto_nome, l.nome as destino_nome
            FROM solicitacoes_infra s
            JOIN produtos p ON s.produto_id = p.id
            JOIN locais l ON s.local_destino_id = l.id
            WHERE s.status = 'PENDENTE'
            ORDER BY s.data_solicitacao ASC;
        `;
        const { rows } = await db.query(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar solicitações: " + err.message });
    }
});

// 2. ROTA: Buscar Tags (Patrimônios) disponíveis no Local 37
router.get('/infra/tags-disponiveis', verificarToken, async (req, res) => {
    const { prodId } = req.query;
    try {
        const sql = `
            SELECT id, patrimonio 
            FROM patrimonios 
            WHERE produto_id = $1 AND local_id = 37 
              AND em_transito = false AND status = 'ESTOQUE'
            ORDER BY patrimonio ASC;
        `;
        const { rows } = await db.query(sql, [prodId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. ROTA MESTRE: Processar Envio (Cria Pedido + Remessa + Coleta Liberada)
router.post('/infra/processar-envio', verificarToken, async (req, res) => {
    const { solicitacaoId, patrimoniosIds, localDestinoId, produtoId } = req.body;
    const usuarioId = req.user.id;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // A. Criar o Pedido direto em COLETA_LIBERADA
        const resPed = await client.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'COLETA_LIBERADA', 'INFRA_PATRIMONIO', NOW()) RETURNING id`,
            [usuarioId, localDestinoId]
        );
        const pedidoId = resPed.rows[0].id;

        // B. Criar a Remessa vinculada (Status COLETA_LIBERADA)
        const resRem = await client.query(
            `INSERT INTO pedido_remessas (pedido_id, status, data_criacao) 
             VALUES ($1, 'COLETA_LIBERADA', NOW()) RETURNING id`,
            [pedidoId]
        );
        const remessaId = resRem.rows[0].id;

        // C. Atualizar os Patrimônios (Bloqueio e Vínculo)
        await client.query(
            `UPDATE patrimonios 
             SET em_transito = true, 
                 local_destino_id = $1, 
                 pedido_id = $2,
                 status = 'EM_TRANSITO'
             WHERE id = ANY($3)`,
            [localDestinoId, pedidoId, patrimoniosIds]
        );

        // D. Atualizar status da solicitação original
        await client.query("UPDATE solicitacoes_infra SET status = 'PROCESSADO' WHERE id = $1", [solicitacaoId]);

        // E. Log de Auditoria
        await client.query(
            `INSERT INTO log_status_pedidos (pedido_id, usuario_id, status_anterior, status_novo, observacao)
             VALUES ($1, $2, 'SOLICITACAO', 'COLETA_LIBERADA', 'Envio de patrimônio via Módulo Infra')`,
            [pedidoId, usuarioId]
        );

        await client.query('COMMIT');
        res.json({ success: true, pedidoId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Falha na transação infra: " + err.message });
    } finally {
        client.release();
    }
});

// =========================================================================
// MÓDULO INFRA: GESTÃO DE PATRIMÔNIO (INDEPENDENTE)
// =========================================================================

// 1. Iniciar Solicitação (Executada na telaSaidaTransferencia37)
// Substitui a sua antiga '/transferencia/enviar-itens'
router.post('/infra/iniciar-solicitacao', verificarToken, async (req, res) => {
    const { produto_id, quantidade, local_destino_id } = req.body;
    const usuarioId = req.user.id;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Criar o Pedido com o status correto do seu ENUM
        const resPed = await client.query(
            `INSERT INTO pedidos (usuario_origem_id, local_destino_id, status, tipo_pedido, data_criacao) 
             VALUES ($1, $2, 'AGUARDANDO_AUTORIZACAO', 'INFRA_PATRIMONIO', NOW()) RETURNING id`,
            [usuarioId, local_destino_id]
        );
        const pedidoId = resPed.rows[0].id;

        // 2. Registrar o item solicitado
        await client.query(
            `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade) VALUES ($1, $2, $3)`,
            [pedidoId, produto_id, quantidade]
        );

        // 3. Reserva os primeiros itens encontrados (para que sumam do estoque fonte)
        await client.query(`
            UPDATE patrimonios SET em_transito = true, local_destino_id = $1, pedido_id = $2 
            WHERE id IN (
                SELECT id FROM patrimonios 
                WHERE produto_id = $3 AND local_id = 37 AND em_transito = false 
                LIMIT $4
            )
        `, [local_destino_id, pedidoId, produto_id, quantidade]);

        await client.query('COMMIT');
        res.json({ success: true, pedidoId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post('/infra/finalizar-envio', verificarToken, async (req, res) => {
    const { pedidoId, tagsIds, localDestinoId } = req.body;
    const usuarioId = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. BUSCA O TIPO DO PEDIDO ANTES DE TUDO
        const resTipo = await client.query("SELECT tipo_pedido FROM pedidos WHERE id = $1", [pedidoId]);
        const tipoPedido = resTipo.rows[0]?.tipo_pedido;

        // 2. CRIA O ROMANEIO (Isso serve para os dois fluxos)
        const resRom = await client.query(
            `INSERT INTO romaneios (usuario_estoque_id, data_saida, status) 
             VALUES ($1, NOW(), 'EM_TRANSPORTE') RETURNING id`,
            [usuarioId]
        );
        const romaneioId = resRom.rows[0].id;

        if (tipoPedido === 'INFRA_PATRIMONIO') {
            // === LÓGICA ESPECÍFICA PARA PATRIMÔNIO ===
            
            // Atualiza Pedido para COLETA_LIBERADA (Conforme sua regra de autorização rápida)
            await client.query(
                `UPDATE pedidos SET status = 'COLETA_LIBERADA', romaneio_id = $1, autorizado_por = $2, data_autorizacao = NOW() WHERE id = $3`,
                [romaneioId, usuarioId, pedidoId]
            );

            // Vincula as Etiquetas (Tags) selecionadas
            await client.query(
                `UPDATE patrimonios SET pedido_id = $1, em_transito = true, local_destino_id = $2 WHERE id = ANY($3)`,
                [pedidoId, localDestinoId, tagsIds]
            );

        } else {
            // === LÓGICA ORIGINAL PARA UNIFORMES / OUTROS ===
            // Aqui você mantém EXATAMENTE o que já tinha antes para não quebrar nada
            await client.query(
                `UPDATE pedidos SET status = 'EM_TRANSPORTE', romaneio_id = $1 WHERE id = $2`,
                [romaneioId, pedidoId]
            );
            // ... (sua lógica antiga de baixas de estoque de uniformes entraria aqui)
        }

        await client.query('COMMIT');
        res.json({ success: true, romaneioId, tipoPedido });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/patrimonio/meus-produtos-unicos', verificarToken, async (req, res) => {
    const localId = req.user.local_id;
    try {
        const sql = `
            SELECT DISTINCT p.nome 
            FROM patrimonios pa
            JOIN produtos p ON pa.produto_id = p.id
            WHERE pa.local_id = $1
            ORDER BY p.nome ASC;
        `;
        const { rows } = await db.query(sql, [localId]);
        // Retornamos apenas um array de strings para facilitar o .map() no frontend
        res.json(rows.map(r => r.nome));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/patrimonio/meus-produtos-nomes', verificarToken, async (req, res) => {
    // O seu middleware de token deve injetar o local_id do usuário no req.user
    const localId = req.user.local_id; 

    try {
        const sql = `
            SELECT DISTINCT nome 
            FROM produtos 
            WHERE local_id = $1 AND tipo = 'PATRIMONIO' 
            ORDER BY nome ASC;
        `;
        const { rows } = await db.query(sql, [localId]);
        // Retorna apenas um array simples de strings para o frontend
        res.json(rows.map(r => r.nome));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/patrimonio/nomes-existentes', verificarToken, async (req, res) => {
    const localId = req.user.local_id; // Pega o ID do local do usuário logado
    try {
        const result = await db.query(
            "SELECT DISTINCT nome FROM produtos WHERE local_id = $1 AND tipo = 'PATRIMONIO' ORDER BY nome ASC",
            [localId]
        );
        // Retorna apenas a lista de nomes: ["CADEIRA ERGOPLAX", "MESA PE PAINEL", ...]
        res.json(result.rows.map(r => r.nome));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Listar solicitações aguardando separação de tags
router.get('/infra/pendentes', verificarToken, async (req, res) => {
    try {
        const sql = `
            SELECT p.id, p.local_destino_id, l.nome as destino_nome, 
                   ip.produto_id, prod.nome as produto_nome, ip.quantidade
            FROM pedidos p
            JOIN itens_pedido ip ON p.id = ip.pedido_id
            JOIN locais l ON p.local_destino_id = l.id
            JOIN produtos prod ON ip.produto_id = prod.id
            WHERE p.status = 'AGUARDANDO_AUTORIZACAO' AND p.tipo_pedido = 'INFRA_PATRIMONIO'
            ORDER BY p.data_criacao ASC`;
        const { rows } = await db.query(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Executar o Envio Real (Cria Remessa + Atribui Tags + COLETA_LIBERADA)


router.get('/patrimonio/listar-produtos-locais', verificarToken, async (req, res) => {
    // Pegamos o local do usuário. Se por algum motivo estiver nulo, usamos o 26 como fallback para teste
    const localId = req.user.local_id || 26; 

    try {
        const sql = `
            SELECT id, nome 
            FROM produtos 
            WHERE local_id = $1 
              AND tipo = 'PATRIMONIO' 
            ORDER BY nome ASC
        `;
        const { rows } = await db.query(sql, [localId]);
        
        // Se ainda assim vier vazio, vamos buscar TODOS os patrimônios do sistema apenas para conferência no console
        if (rows.length === 0) {
            console.log(`AVISO: Nenhum patrimônio encontrado para o local ${localId}. Verifique a tabela produtos.`);
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/patrimonio/vincular-nf-massa', verificarToken, upload.single('arquivo_nf'), async (req, res) => {
    const { patrimoniosIds, numeroNF } = req.body; // patrimoniosIds vem como string "1,2,3"
    const idsArray = patrimoniosIds.split(',').map(Number);
    const arquivo = req.file;
    const usuarioId = req.user.id;

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Salva o documento uma única vez
        const resDoc = await client.query(
            `INSERT INTO documentos_fiscais (numero, url, usuario_id, data_upload) 
             VALUES ($1, $2, $3, NOW()) RETURNING id`,
            [numeroNF, arquivo.path, usuarioId]
        );
        const documentoId = resDoc.rows[0].id;

        // 2. Faz o "apontamento" de todos os bens selecionados para este ID
        await client.query(
            `UPDATE patrimonios 
             SET documento_id = $1, 
                 nota_fiscal = $2 
             WHERE id = ANY($3)`,
            [documentoId, numeroNF, idsArray]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Documento vinculado com sucesso a todos os itens!" });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/patrimonio/obter-nf/:id', verificarToken, async (req, res) => {
    const patrimonioId = req.params.id;

    try {
        // Query "inteligente": busca o documento vinculado ou a URL direta
        const sql = `
            SELECT 
                p.url_nota_fiscal as url_direta,
                d.url as url_compartilhada
            FROM patrimonios p
            LEFT JOIN documentos_fiscais d ON p.documento_id = d.id
            WHERE p.id = $1
        `;
        
        const { rows } = await db.query(sql, [patrimonioId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Registo não encontrado." });
        }

        // Prioridade para a URL compartilhada (nova lógica), depois a direta (antiga)
        const urlFinal = rows[0].url_compartilhada || rows[0].url_direta;

        if (!urlFinal) {
            return res.status(404).json({ error: "Este bem não possui Nota Fiscal anexada." });
        }

        res.json({ url: urlFinal });
    } catch (err) {
        res.status(500).json({ error: "Erro ao recuperar documento: " + err.message });
    }
});

router.post('/patrimonio/cadastrar-completo', verificarToken, upload.single('arquivo_nf'), async (req, res) => {
    const { nome, setor_id, quantidade, numero_nf, adquirido_2025, local_id_manual } = req.body;
    
    // 1. GARANTIA DO LOCAL_ID: Pega do token ou do que veio do frontend
    const localId = req.user.local_id || local_id_manual || 26; 
    const usuarioId = req.user.id;
    const qtdNum = parseInt(quantidade);

    // 2. ANO CORRENTE COM 4 DÍGITOS
    const anoAtual = new Date().getFullYear(); // Retorna 2026

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Lógica para Tabela PRODUTOS
        let resProd = await client.query(
            "SELECT id FROM produtos WHERE UPPER(nome) = $1 AND local_id = $2",
            [nome.trim().toUpperCase(), localId]
        );

        let produtoId;
        if (resProd.rows.length > 0) {
            produtoId = resProd.rows[0].id;
            await client.query("UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2", [qtdNum, produtoId]);
        } else {
            const newProd = await client.query(
                "INSERT INTO produtos (nome, tipo, local_id, quantidade_estoque) VALUES ($1, 'PATRIMONIO', $2, $3) RETURNING id",
                [nome.trim().toUpperCase(), localId, qtdNum]
            );
            produtoId = newProd.rows[0].id;
        }

        // --- LÓGICA DO NÚMERO DE SÉRIE ---
        // Buscamos o último número deste ano para este local
        const lastRes = await client.query(
            `SELECT numero_serie FROM patrimonios 
             WHERE numero_serie LIKE $1 
             ORDER BY id DESC LIMIT 1`, 
            [`MP-${anoAtual}-%`]
        );

        let ultimoNum = 0;
        if (lastRes.rows.length > 0) {
            const partes = lastRes.rows[0].numero_serie.split('-');
            ultimoNum = parseInt(partes[partes.length - 1]) || 0;
        }

        // 3. Loop de inserção corrigindo o local_id e o ano
        for (let i = 0; i < qtdNum; i++) {
            ultimoNum++;
            // Montagem: MP - 2026 - 0001
            const novaSerie = `MP-${anoAtual}-${String(ultimoNum).padStart(4, '0')}`;

            await client.query(
                `INSERT INTO patrimonios 
                (produto_id, numero_serie, local_id, setor_id, status, nota_fiscal, estado, adquirido_pos_2025, url_nota_fiscal, em_transito, data_atualizacao) 
                VALUES ($1, $2, $3, $4, 'ESTOQUE', $5, 'BOM', $6, $7, false, NOW())`,
                [
                    produtoId, 
                    novaSerie, 
                    localId,    // Agora salvando o local_id que estava vindo nulo
                    setor_id, 
                    numero_nf, 
                    adquirido_2025 === 'true', 
                    req.file ? req.file.path : null
                ]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/patrimonio/checar-disponibilidade/:serie', verificarToken, async (req, res) => {
    const { serie } = req.params;
    try {
        const sql = "SELECT id FROM patrimonios WHERE numero_serie = $1 OR patrimonio = $1 LIMIT 1";
        const { rows } = await db.query(sql, [serie]);
        
        // Retorna true se estiver disponível (não encontrou ninguém com esse número)
        res.json({ disponivel: rows.length === 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/patrimonio/proximo-numero/:prefixo/:ano', verificarToken, async (req, res) => {
    const { prefixo, ano } = req.params;
    const padrao = `${prefixo}-${ano}-%`;

    try {
        // Esta query procura o maior número final na sequência, ignorando buracos de deleção
        const sql = `
            SELECT MAX(CAST(substring(numero_serie from '-([0-9]+)$') AS INTEGER)) as maximo
            FROM patrimonios
            WHERE numero_serie LIKE $1
        `;
        
        const { rows } = await db.query(sql, [padrao]);
        
        // Se não houver nenhum, começa em 1. Se houver, soma 1 ao maior encontrado.
        const proximo = (rows[0].maximo || 0) + 1;
        
        res.json({ proximo });
    } catch (err) {
        console.error("Erro ao calcular próximo número:", err);
        res.status(500).json({ error: "Erro ao calcular sequência." });
    }
});

router.get('/relatorios/romaneio-infra/:id', verificarToken, async (req, res) => {
    const remessaId = req.params.id;

    try {
        // SQL Corrigido: Adicionado JOIN com romaneios e filtro por pr.id (remessa)
        const sql = `
            SELECT 
                r.id as romaneio_num,
                p.id as pedido_id,
                r.data_saida,
                ld.nome as destino_nome,
                ld.nome_oficial as destino_endereco,
                prod.nome as produto_nome,
                string_agg(pat.numero_serie, ', ') as lista_etiquetas
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN romaneios r ON p.romaneio_id = r.id
            JOIN locais ld ON p.local_destino_id = ld.id
            JOIN patrimonios pat ON pat.pedido_id = p.id
            JOIN produtos prod ON pat.produto_id = prod.id
            WHERE pr.id = $1
            GROUP BY r.id, p.id, ld.id, prod.id
        `;

        const { rows } = await db.query(sql, [remessaId]);
        
        if (rows.length === 0) {
            return res.status(404).send("Romaneio/Remessa não localizado no sistema.");
        }

        const d = rows[0]; 
        const dataHoje = new Date();
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        const html = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <style>
                @page { size: portrait; margin: 1cm; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; margin: 0; padding: 0; }
                .watermark {
                    position: fixed; top: 50%; left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 120px; color: rgba(0, 0, 0, 0.03);
                    font-weight: bold; z-index: -1; pointer-events: none;
                }
                .header { display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                .logo { width: 60px; height: auto; }
                .header-txt { font-weight: bold; font-size: 13px; line-height: 1.2; }
                h1 { text-align: center; font-size: 18px; margin: 30px 0; text-transform: uppercase; text-decoration: underline; }
                .info-entrega { margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 10px; text-align: left; font-size: 12px; }
                th { background: #f2f2f2; text-transform: uppercase; }
                .footer-container { margin-top: 50px; font-size: 14px; }
                .assinaturas { display: flex; justify-content: space-between; margin-top: 60px; }
                .linha-assinatura { border-top: 1px solid #000; width: 300px; text-align: center; padding-top: 5px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="watermark">SEMED</div>

            <div class="header">
                <img src="/assets/img/braque.png" class="logo">
                <div class="header-txt">
                    PREFEITURA MUNICIPAL DE QUEIMADOS<br>
                    SECRETARIA MUNICIPAL DE EDUCAÇÃO
                </div>
            </div>

            <h1>Romaneio de Entrega de Património</h1>

            <div class="info-entrega">
                <b>ROMANEIO Nº:</b> ${(d.romaneio_num || 0).toString().padStart(6, '0')}<br>
                <b>DESTINO:</b> ${d.destino_nome}<br>
                <b>ENDEREÇO:</b> ${d.destino_endereco || 'Não informado'}<br>
                <b>PEDIDO ORIGEM:</b> #${d.pedido_id || ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">PRODUTO</th>
                        <th>NÚMEROS DE PATRIMÓNIO (ETIQUETAS)</th>
                        <th style="width: 10%; text-align: center;">QTD</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td><b>${row.produto_nome}</b></td>
                            <td style="font-family: monospace; word-break: break-all;">${row.lista_etiquetas}</td>
                            <td style="text-align: center;">${(row.lista_etiquetas || "").split(',').length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer-container">
                Queimados/RJ, ${dataHoje.getDate()} de ${meses[dataHoje.getMonth()]} de ${dataHoje.getFullYear()}.
                
                <div class="assinaturas">
                    <div class="linha-assinatura">Responsável pela Expedição</div>
                    <div class="linha-assinatura">
                        Recebido por (Nome e Matrícula)<br>
                        Data: ____/____/_______
                    </div>
                </div>
            </div>

            <script>
                window.onload = () => { window.print(); };
            </script>
        </body>
        </html>`;

        res.send(html);

    } catch (err) {
        console.error("Erro ao gerar PDF Infra:", err);
        res.status(500).send("Erro interno ao gerar o documento.");
    }
});

router.post('/pedidos/logistica/confirmar-saida', verificarToken, async (req, res) => {
    const { remessaId } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Atualiza a Remessa para 'EM_TRANSPORTE'
        await client.query("UPDATE pedido_remessas SET status = 'EM_TRANSPORTE' WHERE id = $1", [remessaId]);

        // 2. CORREÇÃO: Atualiza o Pedido vinculado a essa remessa específica
        // Usamos um subquery para achar o pedido_id correto
        const updatePedido = await client.query(`
            UPDATE pedidos 
            SET status = 'EM_TRANSPORTE', data_saida = NOW() 
            WHERE id = (SELECT pedido_id FROM pedido_remessas WHERE id = $1)
        `, [remessaId]);

        if (updatePedido.rowCount === 0) {
            throw new Error("Nenhum pedido encontrado para esta remessa.");
        }

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NA SAÍDA:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post('/infra/aprovar-e-gerar-romaneio', verificarToken, async (req, res) => {
    const { pedidoId } = req.body;
    const usuarioId = req.user.id; // [cite: 143]

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Busca detalhes do pedido e quantidade solicitada [cite: 153, 208]
        const pedido = await client.query(`
            SELECT p.id, p.local_destino_id, ip.produto_id, ip.quantidade 
            FROM pedidos p 
            JOIN itens_pedido ip ON p.id = ip.pedido_id 
            WHERE p.id = $1`, [pedidoId]);

        const { local_destino_id, produto_id, quantidade } = pedido.rows[0];

        // 2. SELEÇÃO VIRTUAL: Busca os primeiros 'N' itens disponíveis no Almoxarifado Central (37) 
        const itensDisponiveis = await client.query(`
            SELECT id FROM patrimonios 
            WHERE produto_id = $1 AND local_id = 37 AND status = 'ESTOQUE' 
            LIMIT $2 FOR UPDATE`, [produto_id, quantidade]);

        if (itensDisponiveis.rows.length < quantidade) {
            throw new Error(`Estoque insuficiente no Central. Disponível: ${itensDisponiveis.rows.length}`);
        }

        const idsParaVincular = itensDisponiveis.rows.map(r => r.id);

        // 3. CRIA O ROMANEIO [cite: 152]
        const resRom = await client.query(
            "INSERT INTO romaneios (usuario_estoque_id, status) VALUES ($1, 'EM_TRANSPORTE') RETURNING id",
            [usuarioId]
        );
        const romaneioId = resRom.rows[0].id;

        // 4. VINCULA PATRIMÔNIOS E MUDA STATUS DO PEDIDO [cite: 153, 176]
        await client.query(
            "UPDATE patrimonios SET pedido_id = $1, em_transito = true, local_destino_id = $2 WHERE id = ANY($3)",
            [pedidoId, local_destino_id, idsParaVincular]
        );

        await client.query(
            "UPDATE pedidos SET status = 'COLETA_LIBERADA', romaneio_id = $1, data_autorizacao = NOW(), autorizado_por = $2 WHERE id = $3",
            [romaneioId, usuarioId, pedidoId]
        );

        await client.query('COMMIT');
        res.json({ success: true, romaneioId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 1. ROTA DE DETALHES CORRIGIDA (Troca quantidade por quantidade_enviada)
router.get('/escola/detalhes-remessa/:remessaId', verificarToken, async (req, res) => {
    const { remessaId } = req.params;
    try {
        // 1. Primeiro pegamos o tipo do pedido para saber qual tabela consultar
        const info = await db.query(`
            SELECT p.id as pedido_id, p.tipo_pedido 
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            WHERE pr.id = $1`, [remessaId]);

        if (info.rows.length === 0) return res.status(404).json({ error: "Remessa não encontrada" });
        
        const { pedido_id, tipo_pedido } = info.rows[0];
        let itens = [];

        if (tipo_pedido === 'INFRA_PATRIMONIO') {
            // Consulta para Patrimônios (usa a tabela patrimonios)
            const resPat = await db.query(`
                SELECT prod.nome, pat.numero_serie, 1 as quantidade_enviada
                FROM patrimonios pat
                JOIN produtos prod ON pat.produto_id = prod.id
                WHERE pat.pedido_id = $1`, [pedido_id]);
            itens = resPat.rows;
        } else {
            // CORREÇÃO CIRÚRGICA: pri.quantidade_enviada é o nome correto no seu banco
            const resMateriais = await db.query(`
                SELECT 
                    prod.nome, 
                    COALESCE(pri.tamanho, '---') as detalhe, 
                    pri.quantidade_enviada
                FROM pedido_remessa_itens pri
                JOIN produtos prod ON pri.produto_id = prod.id
                WHERE pri.remessa_id = $1`, [remessaId]);
            itens = resMateriais.rows;
        }

        res.json(itens);
    } catch (err) {
        console.error("ERRO CRÍTICO NA ROTA:", err.message);
        res.status(500).json({ error: "Erro interno: " + err.message });
    }
});

// 2. NOVA ROTA PARA BUSCAR SETORES DA UNIDADE
router.get('/escola/setores-unidade', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.user.id;
        const result = await db.query(`
            SELECT s.id, s.nome 
            FROM setores s
            JOIN locais l ON s.local_id = l.id
            JOIN usuarios u ON u.local_id = l.id
            WHERE u.id = $1 ORDER BY s.nome ASC`, [usuarioId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. ROTA DE CONFIRMAÇÃO (Atualiza setor_id se for Patrimônio)
// 1. ROTA DE DETALHES CORRIGIDA (Troca quantidade por quantidade_enviada)
router.get('/escola/detalhes-remessa/:remessaId', verificarToken, async (req, res) => {
    const { remessaId } = req.params;
    try {
        const info = await db.query(`
            SELECT p.id as pedido_id, p.tipo_pedido 
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            WHERE pr.id = $1`, [remessaId]);

        if (info.rows.length === 0) return res.status(404).json({ error: "Não encontrado" });
        const { pedido_id, tipo_pedido } = info.rows[0];

        let itens = [];
        if (tipo_pedido === 'INFRA_PATRIMONIO') {
            const resItens = await db.query(`
                SELECT prod.nome, pat.numero_serie, 1 as quantidade_enviada
                FROM patrimonios pat
                JOIN produtos prod ON pat.produto_id = prod.id
                WHERE pat.pedido_id = $1`, [pedido_id]);
            itens = resItens.rows;
        } else {
            // CORREÇÃO: pri.quantidade_enviada em vez de pri.quantidade
            const resItens = await db.query(`
                SELECT prod.nome, COALESCE(pri.tamanho, 'GERAL') as tamanho, pri.quantidade_enviada
                FROM pedido_remessa_itens pri
                JOIN produtos prod ON pri.produto_id = prod.id
                WHERE pri.remessa_id = $1`, [remessaId]);
            itens = resItens.rows;
        }
        res.json(itens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. NOVA ROTA PARA BUSCAR SETORES DA UNIDADE
router.get('/escola/setores-unidade', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.user.id;
        const result = await db.query(`
            SELECT s.id, s.nome 
            FROM setores s
            JOIN locais l ON s.local_id = l.id
            JOIN usuarios u ON u.local_id = l.id
            WHERE u.id = $1 ORDER BY s.nome ASC`, [usuarioId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/relatorios/romaneio-padrao/:remessaId', verificarToken, async (req, res) => {
    const { remessaId } = req.params;

    try {
        const sql = `
            SELECT 
                pr.id as remessa_num,
                pr.data_criacao as data_saida,
                l.nome as destino_nome,
                l.nome_oficial as destino_endereco,
                p.id as pedido_id,
                prod.nome as produto_nome,
                pri.tamanho,
                pri.quantidade  -- << SE DER ERRO AQUI, TROQUE POR pri.quantidade_estoque ou pri.qtd
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            JOIN pedido_remessa_itens pri ON pri.remessa_id = pr.id
            JOIN produtos prod ON pri.produto_id = prod.id
            WHERE pr.id = $1
        `;

        const { rows } = await db.query(sql, [remessaId]);
        
        if (!rows || rows.length === 0) {
            return res.status(404).send("Nenhum item encontrado para gerar o romaneio.");
        }

        const d = rows[0];
        const remessaFormatada = (d.remessa_num || 0).toString().padStart(6, '0');
        const dataHoje = new Date();
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        const html = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <style>
                @page { size: portrait; margin: 1cm; }
                body { font-family: sans-serif; color: #333; }
                .header { display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                .logo { width: 60px; }
                h1 { text-align: center; font-size: 18px; text-transform: uppercase; margin: 30px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
                th { background: #eee; }
                .footer { margin-top: 50px; font-size: 14px; }
                .assinaturas { display: flex; justify-content: space-between; margin-top: 60px; }
                .linha { border-top: 1px solid #000; width: 250px; text-align: center; font-size: 12px; padding-top: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="/assets/img/braque.png" class="logo">
                <div><b>PREFEITURA DE QUEIMADOS / SEMED</b></div>
            </div>
            <h1>Romaneio de Entrega - Materiais/Uniformes</h1>
            <p><b>REMESSA Nº:</b> ${remessaFormatada} | <b>PEDIDO:</b> #${d.pedido_id}</p>
            <p><b>DESTINO:</b> ${d.destino_nome}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>PRODUTO</th>
                        <th style="text-align:center;">TAMANHO</th>
                        <th style="text-align:center;">QTD</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr>
                            <td>${r.produto_nome || '---'}</td>
                            <td style="text-align:center;">${r.tamanho || 'Geral'}</td>
                            <td style="text-align:center;">${r.quantidade || r.quantidade_estoque || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                Queimados/RJ, ${dataHoje.getDate()} de ${meses[dataHoje.getMonth()]} de ${dataHoje.getFullYear()}.
                <div class="assinaturas">
                    <div class="linha">Expedição</div>
                    <div class="linha">Recebido por (Nome/Matrícula)</div>
                </div>
            </div>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>`;

        res.send(html);
    } catch (err) {
        console.error("ERRO NO PDF PADRÃO:", err);
        res.status(500).send("Erro ao gerar romaneio padrão: " + err.message);
    }
});

router.get('/estoque/movimentacoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `
            SELECT h.data, hd.quantidade, h.acao 
            FROM historico_detalhes hd
            JOIN historico h ON hd.historico_id = h.id
            WHERE hd.produto_id = $1
            ORDER BY h.data DESC;
        `;
        const { rows } = await db.query(sql, [id]);
        
        const entradas = rows.filter(r => r.acao === 'ENTRADA' || r.acao === 'AJUSTE_ENTRADA');
        const saidas = rows.filter(r => r.acao === 'SAIDA' || r.acao === 'CONSUMO');

        res.json({ entradas, saidas });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar histórico do produto" });
    }
});

// Rota para listar os PDFs salvos no disco
router.get('/admin/listar-romaneios', verificarToken, (req, res) => {
    const diretorio = '/var/www/patrimoniosemed/frontend/romaneios';

    try {
        if (!fs.existsSync(diretorio)) {
            return res.json([]);
        }

        const arquivos = fs.readdirSync(diretorio)
            .filter(file => file.endsWith('.pdf'))
            .map(file => {
                const stats = fs.statSync(path.join(diretorio, file));
                return {
                    nome: file,
                    data: stats.mtime, // Data de modificação
                    tamanho: (stats.size / 1024).toFixed(2) + ' KB'
                };
            })
            // Ordenação Decrescente (Mais recentes primeiro)
            .sort((a, b) => b.data - a.data);

        res.json(arquivos);
    } catch (err) {
        console.error("Erro ao listar romaneios:", err);
        res.status(500).json({ error: "Erro ao acessar diretório de arquivos." });
    }
});

// 1. Lista pedidos que tiveram movimentação no período
router.get('/admin/auditoria/filtrar', verificarToken, async (req, res) => {
    const { inicio, fim } = req.query; // Datas no formato YYYY-MM-DD
    try {
        const sql = `
            SELECT DISTINCT p.id, p.data_criacao, p.status, p.tipo_pedido, l.nome as destino
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            LEFT JOIN log_status_pedidos log ON p.id = log.pedido_id
            WHERE (p.data_criacao BETWEEN $1 AND $2)
               OR (log.data_hora BETWEEN $1 AND $2)
            ORDER BY p.id DESC`;
        
        const { rows } = await db.query(sql, [inicio + ' 00:00:00', fim + ' 23:59:59']);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Busca o Ciclo de Vida completo de um pedido
router.get('/admin/auditoria/pedido/:id/fluxo', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Dados mestre do pedido
        const pedido = await db.query(`
            SELECT p.*, u.nome as solicitante, l.nome as destino
            FROM pedidos p
            JOIN locais l ON p.local_destino_id = l.id
            JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE p.id = $1`, [id]);

        // Linha do tempo (Logs)
        const logs = await db.query(`
            SELECT log.*, u.nome as executor
            FROM log_status_pedidos log
            JOIN usuarios u ON log.usuario_id = u.id
            WHERE log.pedido_id = $1
            ORDER BY log.data_hora ASC`, [id]);

        res.json({ info: pedido.rows[0], historico: logs.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admin/relatorio/exportar-fluxo', verificarToken, async (req, res) => {
    const { dados } = req.body;
    
    const html = `
        <style>
            @page { size: A4 landscape; margin: 1cm; }
            body { font-family: sans-serif; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .cabecalho { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
        </style>
        <div class="cabecalho">
            <h1>RELATÓRIO DE RASTREABILIDADE - PEDIDO #${dados.info.id}</h1>
            <p>Destino: ${dados.info.destino} | Tipo: ${dados.info.tipo_pedido}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>DATA/HORA</th>
                    <th>STATUS ANTERIOR</th>
                    <th>STATUS NOVO</th>
                    <th>EXECUTADO POR</th>
                    <th>OBSERVAÇÃO / AÇÃO</th>
                </tr>
            </thead>
            <tbody>
                ${dados.historico.map(log => `
                    <tr>
                        <td>${new Date(log.data_hora).toLocaleString('pt-BR')}</td>
                        <td>${log.status_anterior || 'INÍCIO'}</td>
                        <td><b>${log.status_novo}</b></td>
                        <td>${log.executor}</td>
                        <td>${log.observacao || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const options = { orientation: 'landscape', format: 'A4' };

    pdf.create(html, options).toBuffer((err, buffer) => {
        if (err) return res.status(500).json({ error: "Erro ao gerar PDF" });
        res.type('pdf');
        res.send(buffer);
    });
});

router.get('/escola/turmas-local', verificarToken, async (req, res) => {
    try {
        // Assumindo que o local_id do usuário está disponível após a verificação do token
        const localId = req.user.local_id; 
        if (!localId) {
            return res.status(403).json({ error: "Usuário sem local associado." });
        }

        const { rows } = await db.query(
            `SELECT id, nome FROM turmas WHERE local_id = $1 ORDER BY nome ASC`,
            [localId]
        );
        
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar turmas do local:", err.message);
        res.status(500).json({ error: "Erro interno ao buscar turmas." });
    }
});

router.get('/turma/:id/grade-entrega', verificarToken, async (req, res) => {
    const { id: turmaId } = req.params;
    const localId = req.user.local_id;

    if (!localId) {
        return res.status(403).json({ error: "Usuário sem local associado." });
    }

    try {
        const client = await db.pool.connect();
        try {
            // 1. Buscar informações da turma (sem alteração)
            const turmaRes = await client.query(
                'SELECT id, nome FROM turmas WHERE id = $1 AND local_id = $2',
                [turmaId, localId]
            );
            if (turmaRes.rows.length === 0) {
                return res.status(404).json({ error: "Turma não encontrada ou não pertence a esta unidade." });
            }
            const turmaInfo = turmaRes.rows[0];

            // 2. Buscar produtos do tipo 'UNIFORMES'
            // ✅ CORRIGIDO: removido local_id = 37 hard-coded
            // Produtos de uniforme são globais (sem filtro de local)
            // Se precisar filtrar por local, use: AND local_id = $1 com [localId]
            const produtosRes = await client.query(`
                SELECT id, nome FROM produtos 
                WHERE tipo = 'UNIFORMES'
                ORDER BY nome ASC
            `);
            const produtos = produtosRes.rows;

            // 3. Buscar alunos da turma
            // ✅ CORRIGIDO: adicionado filtro status = 'ATIVO'
            const alunosRes = await client.query(
                `SELECT id, nome FROM alunos 
                 WHERE turma_id = $1 AND status = 'ATIVO' 
                 ORDER BY nome ASC`,
                [turmaId]
            );
            const alunos = alunosRes.rows;
            const alunoIds = alunos.map(a => a.id);

            // 4. Buscar estoque da escola (sem alteração)
            const estoqueRes = await client.query(`
                SELECT produto_id, tamanho, quantidade 
                FROM estoque_por_local 
                WHERE local_id = $1 AND quantidade > 0 AND produto_id IN 
                    (SELECT id FROM produtos WHERE tipo = 'UNIFORMES')
            `, [localId]);

            const estoqueEscola = estoqueRes.rows.reduce((acc, item) => {
                if (!acc[item.produto_id]) acc[item.produto_id] = [];
                acc[item.produto_id].push({ tamanho: item.tamanho, qtd: item.quantidade });
                acc[item.produto_id].sort((a, b) => 
                    a.tamanho.localeCompare(b.tamanho, undefined, { numeric: true })
                );
                return acc;
            }, {});

            // 5. Buscar entregas já realizadas
            // ✅ CORRIGIDO: filtrar apenas entregas de produtos do tipo 'UNIFORMES'
            // Evita que entrega de MATERIAL apareça como entregue numa coluna de uniforme
            const entregasRes = await client.query(`
                SELECT ea.aluno_id, ea.produto_id, ea.tamanho, ea.data_entrega
                FROM entregas_alunos ea
                JOIN produtos p ON p.id = ea.produto_id
                WHERE ea.aluno_id = ANY($1)
                  AND p.tipo = 'UNIFORMES'
            `, [alunoIds]);

            const entregasRealizadas = entregasRes.rows.reduce((acc, entrega) => {
                if (!acc[entrega.aluno_id]) acc[entrega.aluno_id] = {};
                acc[entrega.aluno_id][entrega.produto_id] = {
                    tamanho: entrega.tamanho,
                    data: entrega.data_entrega
                };
                return acc;
            }, {});

            // 6. Montar payload final (sem alteração na lógica)
            const alunosComStatus = alunos.map(aluno => {
                const entregasDoAluno = entregasRealizadas[aluno.id] || {};
                const statusItens = {};

                for (const produto of produtos) {
                    if (entregasDoAluno[produto.id]) {
                        statusItens[produto.id] = {
                            status: 'entregue',
                            ...entregasDoAluno[produto.id]
                        };
                    } else {
                        statusItens[produto.id] = { status: 'pendente' };
                    }
                }
                return { ...aluno, statusItens };
            });

            res.json({
                turmaInfo,
                produtos,
                estoqueEscola,
                alunos: alunosComStatus
            });

        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Erro ao montar grade de entrega:", err.message);
        res.status(500).json({ error: "Erro interno ao processar dados da turma." });
    }
});

router.post('/entregas/lote', verificarToken, async (req, res) => {
    const { entregas } = req.body;
    const usuarioId = req.user.id;
    const localId = req.user.local_id;

    if (!entregas || !Array.isArray(entregas) || entregas.length === 0) {
        return res.status(400).json({ error: "Nenhum item de entrega fornecido." });
    }
    if (!localId) {
        return res.status(403).json({ error: "Usuário sem local associado." });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // ✅ NOVA VALIDAÇÃO: impedir 2º kit de MATERIAL para o mesmo aluno
        // Pegamos os IDs dos produtos do lote para descobrir quais são MATERIAL
        const produtoIds = [...new Set(entregas.map(e => parseInt(e.produtoId)))];
        const tiposRes = await client.query(
            `SELECT id, tipo, nome FROM produtos WHERE id = ANY($1::int[])`,
            [produtoIds]
        );
        const tipoPorProduto = new Map(tiposRes.rows.map(p => [p.id, p]));

        // Verifica se algum aluno do lote (com produto MATERIAL) já recebeu MATERIAL
        const alunosMaterialNoLote = entregas
            .filter(e => tipoPorProduto.get(parseInt(e.produtoId))?.tipo === 'MATERIAL')
            .map(e => parseInt(e.alunoId));

        if (alunosMaterialNoLote.length > 0) {
            const jaRecebidos = await client.query(`
                SELECT ea.aluno_id, a.nome
                FROM entregas_alunos ea
                JOIN produtos p ON ea.produto_id = p.id
                JOIN alunos a ON ea.aluno_id = a.id
                WHERE ea.aluno_id = ANY($1::int[])
                  AND p.tipo = 'MATERIAL'
            `, [alunosMaterialNoLote]);

            if (jaRecebidos.rows.length > 0) {
                const nomes = jaRecebidos.rows.map(r => r.nome).join(', ');
                throw new Error(`Os seguintes alunos já receberam kit de material: ${nomes}.`);
            }
        }

        // Processa cada entrega
        for (const entrega of entregas) {
            const { alunoId, produtoId, tamanho } = entrega;
            const produtoInfo = tipoPorProduto.get(parseInt(produtoId));

            if (!produtoInfo) {
                throw new Error(`Produto ID ${produtoId} não encontrado.`);
            }

            // ✅ AJUSTE: tratar tamanho NULL corretamente no SQL
            // Para material (sem tamanho) usamos IS NULL
            // Para uniforme usamos = $3
            let baixaEstoqueRes;
            if (tamanho === null || tamanho === undefined || tamanho === '') {
                baixaEstoqueRes = await client.query(
                    `UPDATE estoque_por_local
                     SET quantidade = quantidade - 1
                     WHERE local_id = $1
                       AND produto_id = $2
                       AND (tamanho IS NULL OR tamanho = '')
                       AND quantidade > 0`,
                    [localId, produtoId]
                );
            } else {
                baixaEstoqueRes = await client.query(
                    `UPDATE estoque_por_local
                     SET quantidade = quantidade - 1
                     WHERE local_id = $1
                       AND produto_id = $2
                       AND tamanho = $3
                       AND quantidade > 0`,
                    [localId, produtoId, tamanho]
                );
            }

            if (baixaEstoqueRes.rowCount === 0) {
                throw new Error(
                    `Estoque insuficiente para "${produtoInfo.nome}"${tamanho ? ` tamanho ${tamanho}` : ''}. Operação cancelada.`
                );
            }

            // ✅ AJUSTE: tamanho garantidamente string vazia ou valor (constraint UNIQUE não aceita NULL bem)
            // Se preferir manter NULL, ajuste a constraint para incluir COALESCE
            const tamanhoFinal = (tamanho === null || tamanho === undefined) ? '' : tamanho;

            await client.query(
                `INSERT INTO entregas_alunos
                    (aluno_id, produto_id, tamanho, usuario_id, local_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [alunoId, produtoId, tamanhoFinal, usuarioId, localId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({
            success: true,
            message: `Foram registradas ${entregas.length} entrega(s) com sucesso.`
        });

    } catch (err) {
        await client.query('ROLLBACK');

        if (err.code === '23505') {
            console.error("Duplicidade:", err.message);
            return res.status(409).json({
                error: "Um ou mais alunos já receberam este item anteriormente."
            });
        }

        console.error("Erro no lote de entregas:", err.message);
        res.status(500).json({ error: err.message || "Erro interno ao salvar entregas." });
    } finally {
        client.release();
    }
});

router.get('/turma/:id/comprovante', verificarToken, async (req, res) => {
    const { id: turmaId } = req.params;
    const localId = req.user.local_id;

    if (!localId) {
        return res.status(403).json({ error: "Usuário sem local associado." });
    }

    const client = await db.pool.connect();
    try {
        const metaRes = await client.query(
            'SELECT t.nome as turma_nome, l.nome as escola_nome FROM turmas t JOIN locais l ON t.local_id = l.id WHERE t.id = $1 AND t.local_id = $2',
            [turmaId, localId]
        );
        if (metaRes.rows.length === 0) {
            return res.status(404).json({ error: "Turma não encontrada." });
        }
        const { turma_nome, escola_nome } = metaRes.rows[0];

        // ALTERAÇÃO: adicionado "matricula" no SELECT
        const alunosRes = await client.query(
            'SELECT id, nome, matricula FROM alunos WHERE turma_id = $1 ORDER BY nome ASC',
            [turmaId]
        );
        if (alunosRes.rows.length === 0) {
            return res.status(404).json({ error: "A turma não possui alunos." });
        }

        res.json({
            turmaNome: turma_nome,
            escolaNome: escola_nome,
            dataGeracao: new Date(),
            // ALTERAÇÃO: retorna id, nome e matricula de cada aluno
            alunos: alunosRes.rows.map(a => ({
                id: a.id,
                nome: a.nome,
                matricula: a.matricula || '—'
            }))
        });

    } catch (err) {
        console.error("Erro ao gerar dados do comprovante:", err.message);
        res.status(500).json({ error: "Erro interno ao processar dados do comprovante." });
    } finally {
        client.release();
    }
});

router.get('/relatorios/status-turmas', verificarToken, async (req, res) => {
    const localId = req.user.local_id;
    if (!localId) return res.status(403).json({ error: "Usuário sem local associado." });

    try {
        const client = await db.pool.connect();
        try {
            // Contar quantos itens formam o kit completo.
            const kitCountRes = await client.query("SELECT COUNT(id) as total_items FROM produtos WHERE tipo = 'UNIFORMES' AND local_id = 37");
            const totalKitItems = parseInt(kitCountRes.rows[0].total_items, 10);
            if (totalKitItems === 0) return res.json([]); // Evita divisão por zero

            // Consulta principal que agrega todos os dados.
            const query = `
                SELECT
                    t.id as turma_id,
                    t.nome as turma_nome,
                    COUNT(DISTINCT a.id) as total_alunos,
                    COUNT(DISTINCT ea.aluno_id) FILTER (WHERE ea.aluno_id IS NOT NULL) as alunos_com_algum_item,
                    SUM(CASE WHEN sub.itens_recebidos >= $2 THEN 1 ELSE 0 END) as alunos_kit_completo
                FROM turmas t
                LEFT JOIN alunos a ON a.turma_id = t.id
                LEFT JOIN entregas_alunos ea ON ea.aluno_id = a.id
                LEFT JOIN (
                    SELECT 
                        al.id as aluno_id, 
                        COUNT(DISTINCT e_al.produto_id) as itens_recebidos
                    FROM alunos al
                    JOIN entregas_alunos e_al ON al.id = e_al.aluno_id
                    WHERE al.turma_id IN (SELECT id FROM turmas WHERE local_id = $1)
                    GROUP BY al.id
                ) as sub ON sub.aluno_id = a.id
                WHERE t.local_id = $1
                GROUP BY t.id, t.nome
                ORDER BY t.nome;
            `;
            const { rows } = await client.query(query, [localId, totalKitItems]);
            res.json(rows);

        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Erro no relatório de status por turma:", err.message);
        res.status(500).json({ error: "Erro interno ao gerar relatório." });
    }
});

router.get('/turma/:id/grade-entrega-material', verificarToken, async (req, res) => {
    const { id: turmaId } = req.params;
    const localId = req.user.local_id;

    if (!localId) {
        return res.status(403).json({ error: "Usuário sem local associado." });
    }

    const client = await db.pool.connect();
    try {
        // 1. Informações da turma
        const turmaRes = await client.query(
            'SELECT nome FROM turmas WHERE id = $1 AND local_id = $2',
            [turmaId, localId]
        );
        if (turmaRes.rows.length === 0) {
            return res.status(404).json({ error: "Turma não encontrada ou não pertence a esta unidade." });
        }
        const turmaNome = turmaRes.rows[0].nome;

        // 2. Produtos do tipo MATERIAL
        // ⚠️ AJUSTE: removido o local_id = 37 hard-coded.
        // Se MATERIAL for global no sistema, deixe sem filtro de local.
        // Se for por escola, use: AND local_id = $1 com [localId]
        const produtosRes = await client.query(
            "SELECT id, nome FROM produtos WHERE tipo = 'MATERIAL' ORDER BY nome ASC"
        );
        const produtosMaterial = produtosRes.rows;

        if (produtosMaterial.length === 0) {
            return res.json({
                turmaInfo: { id: turmaId, nome: turmaNome },
                produtos: [],
                estoqueEscola: {},
                alunos: []
            });
        }

        // 3. Alunos da turma (apenas ATIVOS)
        const alunosRes = await client.query(
            `SELECT id, nome FROM alunos
             WHERE turma_id = $1 AND status = 'ATIVO'
             ORDER BY nome ASC`,
            [turmaId]
        );
        const alunos = alunosRes.rows;

        if (alunos.length === 0) {
            return res.json({
                turmaInfo: { id: turmaId, nome: turmaNome },
                produtos: produtosMaterial,
                estoqueEscola: {},
                alunos: []
            });
        }
        const alunoIds = alunos.map(a => a.id);

        // 4. Estoque da escola (somando, pois material não tem tamanho)
        const estoqueRes = await client.query(
            `SELECT produto_id, SUM(quantidade)::int AS quantidade
             FROM estoque_por_local
             WHERE local_id = $1
               AND produto_id = ANY($2::int[])
             GROUP BY produto_id`,
            [localId, produtosMaterial.map(p => p.id)]
        );
        const estoqueEscola = new Map(
            estoqueRes.rows.map(item => [item.produto_id, item.quantidade])
        );

        // 5. Entregas já realizadas
        // ⚠️ AJUSTE: agora retornamos também data_entrega
        const entregasRes = await client.query(`
            SELECT ea.aluno_id,
                   ea.produto_id,
                   ea.data_entrega,
                   p.nome AS produto_nome
            FROM entregas_alunos ea
            JOIN produtos p ON ea.produto_id = p.id
            WHERE ea.aluno_id = ANY($1::int[])
              AND p.tipo = 'MATERIAL'
        `, [alunoIds]);

        const entregasRealizadas = new Map(
            entregasRes.rows.map(e => [e.aluno_id, {
                produto_id: e.produto_id,
                produto_nome: e.produto_nome,
                data_entrega: e.data_entrega
            }])
        );

        // 6. Monta payload
        const alunosComStatus = alunos.map(aluno => {
            const entrega = entregasRealizadas.get(aluno.id);
            return {
                id: aluno.id,
                nome: aluno.nome,
                status: entrega ? 'entregue' : 'pendente',
                entregaInfo: entrega || null
            };
        });

        res.json({
            turmaInfo: { id: turmaId, nome: turmaNome },
            produtos: produtosMaterial,
            estoqueEscola: Object.fromEntries(estoqueEscola),
            alunos: alunosComStatus
        });

    } catch (err) {
        console.error("Erro ao montar grade de entrega de material:", err.message);
        res.status(500).json({ error: "Erro interno ao processar dados." });
    } finally {
        client.release();
    }
});

router.get('/relatorios/alunos-status', verificarToken, async (req, res) => {
    const localId    = req.user.local_id;
    const tipoProduto = (req.query.tipoProduto || '').trim().toUpperCase();
    const status      = (req.query.status      || '').trim().toLowerCase();

    if (!localId || !tipoProduto || !status) {
        return res.status(400).json({
            error: "Parâmetros 'tipoProduto' e 'status' são obrigatórios."
        });
    }

    try {

        // ─────────────────────────────────────────────────────
        // MATERIAL — lógica simples: recebeu ou não recebeu
        // ─────────────────────────────────────────────────────
        if (tipoProduto === 'MATERIAL') {

            if (!['pendente', 'completo'].includes(status)) {
                return res.status(400).json({
                    error: "Para MATERIAL os status válidos são 'pendente' e 'completo'."
                });
            }

            const query = `
                WITH alunos_base AS (
                    SELECT
                        a.id,
                        a.nome                          AS aluno_nome,
                        COALESCE(t.nome, 'SEM TURMA')   AS turma_nome
                    FROM alunos a
                    LEFT JOIN turmas t ON a.turma_id = t.id
                    WHERE a.local_id = $1
                ),
                entregas_material AS (
                    SELECT
                        ea.aluno_id,
                        array_to_string(
                            array_agg(DISTINCT p.nome ORDER BY p.nome), ', '
                        )                               AS produto_recebido,
                        MAX(ea.data_entrega)            AS data_entrega
                    FROM entregas_alunos ea
                    JOIN produtos p ON ea.produto_id = p.id
                    WHERE p.tipo = 'MATERIAL'
                    GROUP BY ea.aluno_id
                )
                SELECT
                    ab.aluno_nome,
                    ab.turma_nome,
                    em.produto_recebido,
                    em.data_entrega
                FROM alunos_base ab
                LEFT JOIN entregas_material em ON em.aluno_id = ab.id
                WHERE
                    ($2 = 'pendente'  AND em.aluno_id IS NULL)
                    OR
                    ($2 = 'completo'  AND em.aluno_id IS NOT NULL)
                ORDER BY ab.turma_nome, ab.aluno_nome;
            `;

            const { rows } = await db.query(query, [localId, status]);
            return res.json(rows);
        }

        // ─────────────────────────────────────────────────────
        // UNIFORMES — três classificações:
        //   completo | parcial | pendente
        // ─────────────────────────────────────────────────────
        if (tipoProduto === 'UNIFORMES') {

            if (!['pendente', 'parcial', 'completo'].includes(status)) {
                return res.status(400).json({
                    error: "Para UNIFORMES os status válidos são 'pendente', 'parcial' e 'completo'."
                });
            }

            const regras = await obterRegrasUniforme();

            const query = `
                WITH alunos_base AS (
                    SELECT
                        a.id,
                        a.nome                          AS aluno_nome,
                        COALESCE(t.nome, 'SEM TURMA')   AS turma_nome
                    FROM alunos a
                    LEFT JOIN turmas t ON a.turma_id = t.id
                    WHERE a.local_id = $1
                ),
                entregas_uniforme AS (
                    SELECT
                        ea.aluno_id,
                        array_agg(
                            DISTINCT UPPER(TRIM(p.nome))
                            ORDER BY UPPER(TRIM(p.nome))
                        )                               AS itens_recebidos,
                        array_to_string(
                            array_agg(DISTINCT p.nome ORDER BY p.nome), ', '
                        )                               AS produto_recebido,
                        MAX(ea.data_entrega)            AS data_entrega
                    FROM entregas_alunos ea
                    JOIN produtos p ON ea.produto_id = p.id
                    WHERE p.tipo = 'UNIFORMES'
                    GROUP BY ea.aluno_id
                ),
                classificacao AS (
                    SELECT
                        ab.aluno_nome,
                        ab.turma_nome,
                        COALESCE(eu.produto_recebido, '')       AS produto_recebido,
                        eu.data_entrega,
                        CASE
                            -- Nenhum item recebido
                            WHEN COALESCE(cardinality(eu.itens_recebidos), 0) = 0
                                THEN 'pendente'

                            -- Kit masculino completo:
                            --   contém todos os itens do kit masculino
                            --   E não contém nenhum item exclusivo feminino
                            WHEN (
                                eu.itens_recebidos @> $2::text[]
                                AND NOT (eu.itens_recebidos && $3::text[])
                            )
                                THEN 'completo'

                            -- Kit feminino completo:
                            --   contém todos os itens do kit feminino
                            --   E não contém nenhum item exclusivo masculino
                            WHEN (
                                eu.itens_recebidos @> $4::text[]
                                AND NOT (eu.itens_recebidos && $5::text[])
                            )
                                THEN 'completo'

                            -- Recebeu algo mas não completou nenhum kit válido
                            ELSE 'parcial'
                        END AS status_uniforme
                    FROM alunos_base ab
                    LEFT JOIN entregas_uniforme eu ON eu.aluno_id = ab.id
                )
                SELECT
                    aluno_nome,
                    turma_nome,
                    produto_recebido,
                    data_entrega
                FROM classificacao
                WHERE status_uniforme = $6
                ORDER BY turma_nome, aluno_nome;
            `;

            const { rows } = await db.query(query, [
                localId,
                regras.kitMasculino,            // $2
                regras.invalidosKitMasculino,   // $3
                regras.kitFeminino,             // $4
                regras.invalidosKitFeminino,    // $5
                status                          // $6
            ]);

            return res.json(rows);
        }

        return res.status(400).json({ error: 'tipoProduto inválido.' });

    } catch (err) {
        console.error(
            `Erro no relatório de status [${tipoProduto}/${status}]:`,
            err.message
        );
        res.status(500).json({ error: "Erro interno ao gerar relatório de alunos." });
    }
});

router.get('/relatorios/consolidado-geral', verificarToken, async (req, res) => {
    try {
        const regras = await obterRegrasUniforme();

        const query = `
            WITH turmas_por_local AS (
                SELECT
                    local_id,
                    COUNT(*)    AS total_turmas
                FROM turmas
                GROUP BY local_id
            ),
            alunos_base AS (
                SELECT
                    a.id        AS aluno_id,
                    a.local_id
                FROM alunos a
            ),
            entregas_por_aluno AS (
                SELECT
                    ab.aluno_id,
                    ab.local_id,
                    -- Array de itens de UNIFORMES recebidos (uppercase, sem espaços)
                    COALESCE(
                        array_agg(
                            DISTINCT UPPER(TRIM(p.nome))
                            ORDER BY UPPER(TRIM(p.nome))
                        ) FILTER (WHERE p.tipo = 'UNIFORMES'),
                        ARRAY[]::text[]
                    )           AS itens_uniforme,
                    -- Qtd de kits de MATERIAL recebidos
                    COUNT(DISTINCT p.id)
                        FILTER (WHERE p.tipo = 'MATERIAL')
                                AS qtd_material
                FROM alunos_base ab
                LEFT JOIN entregas_alunos ea ON ea.aluno_id = ab.aluno_id
                LEFT JOIN produtos p         ON ea.produto_id = p.id
                GROUP BY ab.aluno_id, ab.local_id
            ),
            classificacao AS (
                SELECT
                    epa.aluno_id,
                    epa.local_id,
                    CASE
                        WHEN COALESCE(cardinality(epa.itens_uniforme), 0) = 0
                            THEN 'pendente'
                        WHEN (
                            epa.itens_uniforme @> $1::text[]
                            AND NOT (epa.itens_uniforme && $2::text[])
                        ) OR (
                            epa.itens_uniforme @> $3::text[]
                            AND NOT (epa.itens_uniforme && $4::text[])
                        )
                            THEN 'completo'
                        ELSE 'parcial'
                    END         AS status_uniforme,
                    CASE
                        WHEN epa.qtd_material > 0 THEN 'completo'
                        ELSE 'pendente'
                    END         AS status_material
                FROM entregas_por_aluno epa
            )
            SELECT
                l.id                                                        AS local_id,
                l.nome                                                      AS local_nome,
                COALESCE(tpl.total_turmas, 0)                               AS total_turmas,
                COUNT(c.aluno_id)                                           AS total_alunos,
                COUNT(*) FILTER (WHERE c.status_uniforme = 'completo')      AS uniformes_recebidos,
                COUNT(*) FILTER (WHERE c.status_uniforme = 'parcial')       AS uniformes_parciais,
                COUNT(*) FILTER (WHERE c.status_uniforme = 'pendente')      AS uniformes_pendentes,
                COUNT(*) FILTER (WHERE c.status_material = 'completo')      AS material_recebido,
                COUNT(*) FILTER (WHERE c.status_material = 'pendente')      AS material_pendentes
            FROM locais l
            LEFT JOIN turmas_por_local tpl  ON tpl.local_id = l.id
            LEFT JOIN classificacao c       ON c.local_id   = l.id
            WHERE l.id != 37
            GROUP BY l.id, l.nome, tpl.total_turmas
            ORDER BY l.nome;
        `;

        const { rows } = await db.query(query, [
            regras.kitMasculino,            // $1
            regras.invalidosKitMasculino,   // $2
            regras.kitFeminino,             // $3
            regras.invalidosKitFeminino     // $4
        ]);

        res.json(rows);

    } catch (err) {
        console.error("Erro no relatório consolidado geral:", err.message);
        res.status(500).json({ error: "Erro interno ao gerar relatório consolidado." });
    }
});

router.get('/estoque/historico-produto/:id', verificarToken, async (req, res) => {
    const { id: produtoId } = req.params;

    try {
        // Query para buscar ENTRADAS (do histórico de entrada em lote)
        const entradasSql = `
            SELECT 
                h.data AS data_hora, 
                h.observacoes,
                hd.quantidade,
                hd.tamanho,
                u.nome as nome_usuario
            FROM historico h
            JOIN historico_detalhes hd ON h.id = hd.historico_id
            JOIN usuarios u ON h.usuario_id = u.id
            WHERE hd.produto_id = $1 AND h.tipo = 'ENTRADA' AND h.local_id = 37
            ORDER BY h.data DESC
            LIMIT 20;
        `;

        // Query para buscar SAÍDAS (das remessas para as escolas)
        const saidasSql = `
            SELECT 
                pr.data_criacao as data_hora,
                l.nome as observacoes, -- Nome da escola como observação
                pri.quantidade_enviada as quantidade,
                pri.tamanho,
                u.nome as nome_usuario -- Usuário que criou o pedido
            FROM pedido_remessa_itens pri
            JOIN pedido_remessas pr ON pri.remessa_id = pr.id
            JOIN pedidos p ON pr.pedido_id = p.id
            JOIN locais l ON p.local_destino_id = l.id
            LEFT JOIN usuarios u ON p.usuario_origem_id = u.id
            WHERE pri.produto_id = $1
            ORDER BY pr.data_criacao DESC
            LIMIT 20;
        `;

        // Executa as duas consultas em paralelo
        const [entradasRes, saidasRes] = await Promise.all([
            db.query(entradasSql, [produtoId]),
            db.query(saidasSql, [produtoId])
        ]);
        
        res.json({
            entradas: entradasRes.rows,
            saidas: saidasRes.rows
        });

    } catch (err) {
        console.error("ERRO AO BUSCAR HISTÓRICO DE PRODUTO:", err.message);
        res.status(500).json({ error: "Erro ao carregar histórico do produto." });
    }
});

router.get('/relatorios/status-turmas-geral', verificarToken, async (req, res) => {
    const localId = req.user.local_id;

    if (!localId) {
        return res.status(403).json({ error: "Usuário sem local associado." });
    }

    try {
        const regras = await obterRegrasUniforme();

        const query = `
            WITH alunos_base AS (
                SELECT
                    a.id AS aluno_id,
                    a.turma_id
                FROM alunos a
                WHERE a.local_id = $1
            ),
            entregas_por_aluno AS (
                SELECT
                    ab.aluno_id,
                    ab.turma_id,
                    COALESCE(
                        array_agg(
                            DISTINCT UPPER(TRIM(p.nome))
                            ORDER BY UPPER(TRIM(p.nome))
                        ) FILTER (WHERE p.tipo = 'UNIFORMES'),
                        ARRAY[]::text[]
                    ) AS itens_uniforme,
                    COUNT(DISTINCT p.id) FILTER (WHERE p.tipo = 'MATERIAL') AS qtd_material
                FROM alunos_base ab
                LEFT JOIN entregas_alunos ea ON ea.aluno_id = ab.aluno_id
                LEFT JOIN produtos p ON p.id = ea.produto_id
                GROUP BY ab.aluno_id, ab.turma_id
            ),
            classificacao AS (
                SELECT
                    epa.aluno_id,
                    epa.turma_id,
                    CASE
                        WHEN COALESCE(cardinality(epa.itens_uniforme), 0) = 0 THEN 'pendente'
                        WHEN (
                            epa.itens_uniforme @> $2::text[]
                            AND NOT (epa.itens_uniforme && $3::text[])
                        ) OR (
                            epa.itens_uniforme @> $4::text[]
                            AND NOT (epa.itens_uniforme && $5::text[])
                        ) THEN 'completo'
                        ELSE 'parcial'
                    END AS status_uniforme,
                    CASE
                        WHEN epa.qtd_material > 0 THEN 'completo'
                        ELSE 'pendente'
                    END AS status_material
                FROM entregas_por_aluno epa
            )
            SELECT
                t.id AS turma_id,
                t.nome AS turma_nome,
                COUNT(ab.aluno_id) AS total_alunos,

                COUNT(c.aluno_id) FILTER (
                    WHERE c.status_uniforme = 'completo'
                ) AS uniformes_completos,

                COUNT(c.aluno_id) FILTER (
                    WHERE c.status_uniforme = 'parcial'
                ) AS uniformes_parciais,

                COUNT(c.aluno_id) FILTER (
                    WHERE c.status_uniforme = 'pendente'
                ) AS uniformes_pendentes,

                COUNT(c.aluno_id) FILTER (
                    WHERE c.status_material = 'completo'
                ) AS material_recebido,

                COUNT(c.aluno_id) FILTER (
                    WHERE c.status_material = 'pendente'
                ) AS material_pendentes

            FROM turmas t
            LEFT JOIN alunos_base ab ON ab.turma_id = t.id
            LEFT JOIN classificacao c ON c.aluno_id = ab.aluno_id
            WHERE t.local_id = $1
            GROUP BY t.id, t.nome
            ORDER BY t.nome;
        `;

        const { rows } = await db.query(query, [
            localId,
            regras.kitMasculino,            // $2
            regras.invalidosKitMasculino,   // $3
            regras.kitFeminino,             // $4
            regras.invalidosKitFeminino     // $5
        ]);

        res.json(rows);

    } catch (err) {
        console.error("Erro no relatório de status por turma GERAL:", err.message);
        res.status(500).json({ error: "Erro interno ao gerar relatório geral." });
    }
});

router.get('/relatorios/progresso-geral-escolas', verificarToken, async (req, res) => {
    try {
        // ✅ FIXO: 7 peças = kit completo de uniformes (regra de negócio)
        const totalPecasUniformes = 7;

        const query = `
            WITH turmas_por_local AS (
                SELECT local_id, COUNT(*)::int AS total_turmas
                FROM turmas 
                GROUP BY local_id
            ),
            alunos_ativos_por_local AS (
                SELECT local_id, COUNT(*)::int AS total_alunos
                FROM alunos 
                WHERE status = 'ATIVO'
                GROUP BY local_id
            ),
            material_por_local AS (
                SELECT a.local_id, 
                       COUNT(DISTINCT ea.aluno_id)::int AS material_recebido
                FROM entregas_alunos ea
                JOIN produtos p ON p.id = ea.produto_id
                JOIN alunos a ON a.id = ea.aluno_id
                WHERE p.tipo = 'MATERIAL' AND a.status = 'ATIVO'
                GROUP BY a.local_id
            ),
            uniformes_completos_por_local AS (
                SELECT sub.local_id, 
                       COUNT(*)::int AS uniformes_completos
                FROM (
                    SELECT a.local_id, ea.aluno_id
                    FROM entregas_alunos ea
                    JOIN produtos p ON p.id = ea.produto_id
                    JOIN alunos a ON a.id = ea.aluno_id
                    WHERE p.tipo = 'UNIFORMES' AND a.status = 'ATIVO'
                    GROUP BY a.local_id, ea.aluno_id
                    HAVING COUNT(DISTINCT ea.produto_id) >= $1
                ) sub
                GROUP BY sub.local_id
            )
            SELECT
                l.id AS local_id,
                l.nome AS local_nome,
                COALESCE(t.total_turmas, 0) AS total_turmas,
                COALESCE(a.total_alunos, 0) AS total_alunos,
                COALESCE(u.uniformes_completos, 0) AS uniformes_completos,
                COALESCE(m.material_recebido, 0) AS material_recebido,
                -- Calculados no back (mais preciso e performático)
                GREATEST(a.total_alunos - u.uniformes_completos, 0) AS uniformes_faltantes,
                GREATEST(a.total_alunos - m.material_recebido, 0) AS material_faltante,
                -- Percentuais com 1 casa decimal
                CASE WHEN a.total_alunos > 0 
                     THEN ROUND((u.uniformes_completos * 100.0) / a.total_alunos, 1)
                     ELSE 0 END AS perc_uniformes,
                CASE WHEN a.total_alunos > 0 
                     THEN ROUND((m.material_recebido * 100.0) / a.total_alunos, 1)
                     ELSE 0 END AS perc_material
            FROM locais l
            LEFT JOIN turmas_por_local t ON t.local_id = l.id
            LEFT JOIN alunos_ativos_por_local a ON a.local_id = l.id
            LEFT JOIN uniformes_completos_por_local u ON u.local_id = l.id
            LEFT JOIN material_por_local m ON m.local_id = l.id
            WHERE l.id BETWEEN 1 AND 40 AND l.id NOT IN (37, 38)
            ORDER BY l.nome
        `;

        const { rows } = await db.query(query, [totalPecasUniformes]);
        res.json(rows);

    } catch (err) {
        console.error("Erro no relatório de progresso por escolas:", err.message);
        res.status(500).json({ error: "Erro interno ao gerar relatório consolidado." });
    }
});

router.get('/escola/alertas/entregas', verificarToken, async (req, res) => {
    const localId = req.user.local_id;
    if (!localId) {
        return res.json({ count: 0 }); // Retorna 0 se o usuário não tiver local
    }
    
    try {
        const query = `
            SELECT COUNT(DISTINCT pr.id) as total
            FROM pedido_remessas pr
            JOIN pedidos p ON pr.pedido_id = p.id
            WHERE p.local_destino_id = $1 AND pr.status = 'EM_TRANSPORTE'
        `;
        const { rows } = await db.query(query, [localId]);
        res.json({ count: parseInt(rows[0].total, 10) || 0 });
    } catch (err) {
        console.error("Erro ao buscar alerta de entregas:", err.message);
        res.status(500).json({ error: "Erro ao verificar entregas." });
    }
});

router.get('/admin/alertas/solicitacoes', verificarToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.user.perfil !== 'admin' && req.user.perfil !== 'super') {
        return res.status(403).json({ error: "Acesso negado." });
    }

    try {
        const query = `
            SELECT COUNT(id) as total
            FROM pedidos
            WHERE status = 'AGUARDANDO_AUTORIZACAO'
              AND tipo_pedido = 'SOLICITACAO'
        `;
        const { rows } = await db.query(query);
        res.json({ count: parseInt(rows[0].total, 10) || 0 });
    } catch (err) {
        console.error("Erro ao buscar alerta de solicitações:", err.message);
        res.status(500).json({ error: "Erro ao verificar solicitações." });
    }
});

router.get('/logistica/alertas/coleta-liberada', verificarToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!['logistica', 'admin', 'super'].includes(req.user.perfil)) {
        return res.status(403).json({ error: "Acesso negado." });
    }
    
    try {
        const query = `
            SELECT COUNT(id) as total
            FROM pedidos
            WHERE status = 'COLETA_LIBERADA'
        `;
        const { rows } = await db.query(query);
        res.json({ count: parseInt(rows[0].total, 10) || 0 });
    } catch (err) {
        console.error("Erro ao buscar alerta de coletas liberadas:", err.message);
        res.status(500).json({ error: "Erro ao verificar coletas." });
    }
});

router.get('/estoque/alertas/aprovados', verificarToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!['estoque', 'admin', 'super'].includes(req.user.perfil)) {
        return res.status(403).json({ error: "Acesso negado." });
    }
    
    try {
        const query = `
            SELECT COUNT(id) as total
            FROM pedidos
            WHERE status = 'APROVADO'
        `;
        const { rows } = await db.query(query);
        res.json({ count: parseInt(rows[0].total, 10) || 0 });
    } catch (err) {
        console.error("Erro ao buscar alerta de pedidos aprovados:", err.message);
        res.status(500).json({ error: "Erro ao verificar pedidos aprovados." });
    }
});

router.get('/estoque/alertas/infra-pendentes', verificarToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!['estoque', 'admin', 'super'].includes(req.user.perfil)) {
        return res.status(403).json({ error: "Acesso negado." });
    }

    try {
        const query = `
            SELECT COUNT(id) as total
            FROM pedidos
            WHERE status = 'AGUARDANDO_AUTORIZACAO'
              AND tipo_pedido = 'INFRA_PATRIMONIO'
        `;
        const { rows } = await db.query(query);
        res.json({ count: parseInt(rows[0].total, 10) || 0 });
    } catch (err) {
        console.error("Erro ao buscar alerta de infra pendente:", err.message);
        res.status(500).json({ error: "Erro ao verificar infra." });
    }
});

router.get('/estoque/alertas/prontos-transporte', verificarToken, async (req, res) => {
    // evita cache/304 em endpoint dinâmico
    res.set('Cache-Control', 'no-store');

    if (!['estoque', 'admin', 'super'].includes(req.user.perfil)) {
        return res.status(403).json({ error: "Acesso negado." });
    }

    try {
        const query = `
            SELECT COUNT(*) as total
            FROM pedido_remessas
            WHERE status = 'PRONTO'
        `;
        const { rows } = await db.query(query);
        res.json({ count: parseInt(rows[0].total, 10) || 0 });
    } catch (err) {
        console.error("Erro ao buscar alerta de prontos (transporte):", err.message);
        res.status(500).json({ error: "Erro ao verificar prontos." });
    }
});

async function obterRegrasUniforme() {
    const { rows } = await db.query(`
        SELECT DISTINCT UPPER(TRIM(nome)) AS nome
        FROM produtos
        WHERE tipo = 'UNIFORMES'
        ORDER BY nome
    `);

    const catalogo = rows.map(r => r.nome);

    const masculinos = EXCLUSIVOS_UNIFORME_MASCULINO.filter(nome => catalogo.includes(nome));
    const femininos  = EXCLUSIVOS_UNIFORME_FEMININO.filter(nome => catalogo.includes(nome));
    const comuns     = catalogo.filter(nome =>
        !masculinos.includes(nome) && !femininos.includes(nome)
    );

    return {
        kitMasculino:          [...comuns, ...masculinos],
        kitFeminino:           [...comuns, ...femininos],
        invalidosKitMasculino: femininos,   // femininos são inválidos no kit masc.
        invalidosKitFeminino:  masculinos   // masculinos são inválidos no kit fem.
    };
}

router.get('/remessas/:id/romaneio-detalhado', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                r.id AS remessa_id,
                p.id AS pedido_id,
                p.data_criacao,
                p.data_autorizacao,
                p.data_separacao,
                p.data_saida,
                p.data_recebimento, -- NOVO CAMPO
                p.status,           -- NOVO CAMPO
                p.tipo_pedido,
                p.volumes,
                COALESCE(l.nome_oficial, l.nome, 'Local não identificado') AS destino_final,
                u_origem.nome AS solicitante,
                u_autoriza.nome AS quem_autorizou,
                (
                    SELECT json_agg(json_build_object(
                        'produto_nome', prod.nome,
                        'tamanho', ri.tamanho,
                        'quantidade_enviada', ri.quantidade_enviada
                    ))
                    FROM pedido_remessa_itens ri
                    JOIN produtos prod ON ri.produto_id = prod.id
                    WHERE ri.remessa_id = r.id
                ) AS itens
            FROM pedido_remessas r
            JOIN pedidos p ON r.pedido_id = p.id
            LEFT JOIN locais l ON p.local_destino_id = l.id
            LEFT JOIN usuarios u_origem ON p.usuario_origem_id = u_origem.id
            LEFT JOIN usuarios u_autoriza ON p.autorizado_por = u_autoriza.id
            WHERE r.id = $1;
        `;

        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Remessa não encontrada." });
        }

        const dados = result.rows[0];

        res.json({
            pedido: {
                id: dados.pedido_id,
                escola_nome: dados.destino_final,
                tipo_pedido: dados.tipo_pedido || 'SAÍDA',
                data_criacao: dados.data_criacao,
                data_autorizacao: dados.data_autorizacao,
                data_separacao: dados.data_separacao,
                data_recebimento: dados.data_recebimento, // ENVIANDO PARA O FRONT
                status: dados.status,                     // ENVIANDO PARA O FRONT
                solicitante: dados.solicitante || 'Não informado',
                quem_autorizou: dados.quem_autorizou,
                volumes: dados.volumes || 0
            },
            itens: dados.itens || []
        });

    } catch (err) {
        console.error('Erro ao buscar romaneio:', err);
        res.status(500).json({ error: "Erro interno ao processar o romaneio." });
    }
});

module.exports = router;