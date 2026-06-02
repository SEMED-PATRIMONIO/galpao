// ROTA: BUSCAR INVENTÁRIO COMPLETO COM DISTINÇÃO PATRIMONIAL
router.get('/inventario', async (req, res) => {
    try {
        const ativos = await pool.query(`
            SELECT a.*, c.numero_contrato, f.razao_social as fornecedor_nome
            FROM ativos_ti a
            LEFT JOIN contratos c ON a.contrato_id = c.id
            LEFT JOIN fornecedores f ON c.fornecedor_id = f.id
            ORDER BY a.origem_ativo DESC, a.nome_produto ASC
        `);
        
        // Mapeia quem são filhos (componentes) para exibição aninhada na tela se necessário
        res.json({ success: true, data: ativos.rows });
    } catch (err) {
        res.status(500).json({ error: "Erro ao carregar o inventário." });
    }
});

// ROTA: SALVAR OU ATUALIZAR FICHA DE EQUIPAMENTO (ALOCAÇÃO OPCIONAL A QUALQUER TEMPO)
router.post('/ativos/salvar', async (req, res) => {
    const { 
        id, contrato_id, origem_ativo, nome_produto, numero_serie, patrimonio_tag, 
        estado_conservacao, ativo_pai_id, componentes_descricao, local_tipo, local_id, data_alocacao, observacoes 
    } = req.body;
    
    try {
        if (id) {
            // Regra de Edição a qualquer tempo
            await pool.query(`
                UPDATE ativos_ti SET
                    contrato_id = $1, origem_ativo = $2, nome_produto = $3, numero_serie = $4,
                    patrimonio_tag = $5, estado_conservacao = $6, ativo_pai_id = $7,
                    componentes_descricao = $8, local_tipo = $9, local_id = $10,
                    data_alocacao = $11, observacoes = $12, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $13
            `, [
                origem_ativo === 'Próprio' ? null : contrato_id, origem_ativo, nome_produto, numero_serie || null,
                patrimonio_tag || null, estado_conservacao, ativo_pai_id || null, componentes_descricao || null,
                local_tipo || null, local_id || null, data_alocacao || null, observacoes || null, id
            ]);
        } else {
            // Regra de Inserção Nova
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