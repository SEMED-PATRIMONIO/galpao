const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 📄 1. ROTAS: GESTÃO MESTRE DE CONTRATOS & PAINEL CENTRAL
// =========================================================================

// ROTA CENTRAL: DASHBOARD CONSOLIDADO DE CONTRATOS
router.get('/', async (req, res) => {
    try {
        // Coleta todos os contratos vinculando Fornecedor e Categoria
        const listaContratos = await pool.query(`
            SELECT c.*, f.razao_social as fornecedor, cat.nome as categoria,
                   (SELECT COUNT(*) FROM parcelas WHERE contrato_id = c.id AND pago = false) as parcelas_pendentes,
                   (SELECT COUNT(*) FROM ativos_ti WHERE contrato_id = c.id) as total_ativos
            FROM contratos c
            JOIN fornecedores f ON c.fornecedor_id = f.id
            JOIN categorias cat ON c.categoria_id = cat.id
            ORDER BY c.data_fim ASC
        `);

        // Busca todas as parcelas em aberto ordenadas por vencimento crítico
        const parcelasCriticas = await pool.query(`
            SELECT p.*, c.numero_contrato, f.razao_social as fornecedor 
            FROM parcelas p
            JOIN contratos c ON p.contrato_id = c.id
            JOIN fornecedores f ON c.fornecedor_id = f.id
            WHERE p.pago = false AND p.data_vencimento <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY p.data_vencimento ASC
        `);

        // Coleta as janelas de monitoramento de expediente para a tabela do painel
        const janelas = await pool.query(`
            SELECT * FROM janelas_monitoramento 
            ORDER BY local_tipo
        `);

        const fornecedores = await pool.query('SELECT id, razao_social FROM fornecedores WHERE ativo = true ORDER BY razao_social');
        const categorias = await pool.query('SELECT id, nome FROM categorias ORDER BY nome');

        res.render('contratos_dashboard', {
            contratos: listaContratos.rows,
            alertasFinanceiros: parcelasCriticas.rows,
            fornecedores: fornecedores.rows,
            categorias: categorias.rows,
            janelas: janelas.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao processar ecossistema de contratos.");
    }
});

// CADASTRO DE NOVO CONTRATO COM GERAÇÃO DE PARCELAS AUTOMÁTICA
router.post('/contratos/salvar', async (req, res) => {
    const { fornecedor_id, categoria_id, numero_contrato, objeto_resumido, valor_total, data_inicio, data_fim, qtd_parcelas } = req.body;
    try {
        const novoContrato = await pool.query(`
            INSERT INTO contratos (fornecedor_id, categoria_id, numero_contrato, objeto_resumido, valor_total, data_inicio, data_fim)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, [fornecedor_id, categoria_id, numero_contrato, objeto_resumido, valor_total, data_inicio, data_fim]);
        
        const contratoId = novoContrato.rows[0].id;
        const totalParcelas = parseInt(qtd_parcelas) || 1;
        const valorParcela = (parseFloat(valor_total) / totalParcelas).toFixed(2);

        for (let i = 1; i <= totalParcelas; i++) {
            await pool.query(`
                INSERT INTO parcelas (contrato_id, numero_parcela, data_vencimento, valor)
                VALUES ($1, $2, CURRENT_DATE + INTERVAL '${i} month', $3)
            `, [contratoId, `${i}/${totalParcelas}`, valorParcela]);
        }

        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao estruturar contrato.");
    }
});

// =========================================================================
// 💵 2. ROTAS: CRONOGRAMA FINANCEIRO & PARCELAS
// =========================================================================

// MARCAÇÃO REATIVA DE PAGAMENTO DE PARCELA
router.post('/parcelas/:id/dar-baixa', async (req, res) => {
    const { id } = req.params;
    const { pago, data_pagamento } = req.body;
    try {
        await pool.query(`
            UPDATE parcelas 
            SET pago = $1, data_pagamento = $2 
            WHERE id = $3
        `, [pago === 'true' || pago === true, data_pagamento || new Date(), id]);
        res.json({ success: true, message: "Baixa de pagamento efetuada com sucesso." });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar parcela." });
    }
});

// =========================================================================
// 🖥️ 3. ROTAS: INVENTÁRIO PATRIMONIAL E DE ATIVOS DE TI
// =========================================================================

// BUSCAR INVENTÁRIO COMPLETO COM DISTINÇÃO PATRIMONIAL
router.get('/inventario', async (req, res) => {
    try {
        const ativos = await pool.query(`
            SELECT a.*, c.numero_contrato, f.razao_social as fornecedor_nome
            FROM ativos_ti a
            LEFT JOIN contratos c ON a.contrato_id = c.id
            LEFT JOIN fornecedores f ON c.fornecedor_id = f.id
            ORDER BY a.origem_ativo DESC, a.nome_produto ASC
        `);
        res.json({ success: true, data: ativos.rows });
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar o inventário." });
    }
});

// SALVAR OU ATUALIZAR FICHA DE EQUIPAMENTO (ALOCAÇÃO OPCIONAL A QUALQUER TEMPO)
router.post('/ativos/salvar', async (req, res) => {
    const { 
        id, contrato_id, origem_ativo, nome_produto, numero_serie, patrimonio_tag, 
        estado_conservacao, ativo_pai_id, componentes_descricao, local_tipo, local_id, data_alocacao, observacoes 
    } = req.body;
    
    try {
        if (id) {
            await pool.query(`
                UPDATE ativos_ti SET
                    contrato_id = $1, origem_ativo = $2, nome_produto = $3, numero_serie = $4,
                    patrimonio_tag = $5, estado_conservacao = $6, ativo_pai_id = $7,
                    componentes_descricao = $8, local_tipo = $9, local_id = $10,
                    data_alocacao = $11, observacoes = $12, updated_at = CURRENT_TIMESTAMP
                WHERE id = $13
            `, [
                origem_ativo === 'Próprio' ? null : contrato_id, origem_ativo, nome_produto, numero_serie || null,
                patrimonio_tag || null, estado_conservacao, ativo_pai_id || null, componentes_descricao || null,
                local_tipo || null, local_id || null, data_alocacao || null, observacoes || null, id
            ]);
        } else {
            await pool.query(`
                INSERT INTO ativos_ti (
                    contrato_id, origem_ativo, nome_produto, numero_serie, patrimonio_tag,
                    estado_conservacao, ativo_pai_id, componentes_descricao, local_tipo, local_id, data_alocacao, observacoes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                origem_ativo === 'Próprio' ? null : contrato_id, origem_ativo, nome_produto, numero_serie || null,
                patrimonio_tag || null, estado_conservacao, ativo_pai_id || null, componentes_descricao || null,
                local_tipo || null, local_id || null, data_alocacao || null, observacoes || null
            ]);
        }
        res.redirect('/#inventario');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao processar a ficha do ativo.");
    }
});

// CERTIFIQUE-SE DE EXPORTAR O ROTEADOR NO FIM DO ARQUIVO
module.exports = router;