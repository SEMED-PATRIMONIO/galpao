const express = require('express');
const router = express.Router();
const pool = require('../db');

// Tabelas que usam o campo 'ativo' para controlar o que é exibido
const tabelasComAtivo = ['aee_usuarios_equipe', 'aee_alunos', 'aee_profissionais_saude', 'aee_usuarios_pais'];

const getTableName = (param) => {
    const mapping = {
        'alunos': 'aee_alunos',
        'usuarios': 'aee_usuarios_equipe',
        'usuarios_equipe': 'aee_usuarios_equipe',
        'profissionais': 'aee_profissionais_saude',
        'escolas': 'aee_escolas',
        'especialidades': 'aee_especialidades',
        'pais': 'aee_usuarios_pais'
    };
    return mapping[param] || param;
};

// 1. LISTAGEM (Exibe apenas quem tem 'ativo = true')
router.get('/:table', async (req, res) => {
    const tabela = getTableName(req.params.table);
    try {
        let sql = `SELECT * FROM ${tabela}`;
        if (tabelasComAtivo.includes(tabela)) {
            sql += ` WHERE ativo = true`; // Aqui filtramos para "enxugar" a lista
        }
        sql += ` ORDER BY id DESC`;
        const result = await pool.query(sql);
        res.json(result.rows || []);
    } catch (err) {
        res.status(200).json([]);
    }
});

// 2. ALTERAR STATUS (Inativar ou Restaurar)
// Mudamos o nome para 'patch' para refletir que é apenas uma ALTERAÇÃO de campo
router.patch('/:table/:id/status', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    const { novoStatus } = req.body; // O front envia 'true' ou 'false'

    try {
        // AQUI ESTÁ A MÁGICA: Apenas um UPDATE, nada de apagar registros
        const query = `UPDATE ${tabela} SET ativo = $1 WHERE id = $2`;
        await pool.query(query, [novoStatus, id]);
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao alterar status' });
    }
});

// Mantida por compatibilidade com os botões atuais do seu portal
router.delete('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    try {
        // Mesmo estando em uma rota "delete", o comando é de UPDATE
        const query = `UPDATE ${tabela} SET ativo = false WHERE id = $1`;
        await pool.query(query, [id]);
        res.json({ message: 'Registro inativado' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao inativar' });
    }
});

// 3. EDITAR DADOS GERAIS
router.put('/:table/:id', async (req, res) => {
    const tabela = getTableName(req.params.table);
    const { id } = req.params;
    const campos = req.body;
    try {
        const keys = Object.keys(campos).filter(k => k !== 'id');
        const values = keys.map(k => campos[k]);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const query = `UPDATE ${tabela} SET ${setClause} WHERE id = $${keys.length + 1}`;
        await pool.query(query, [...values, id]);
        res.json({ message: 'Salvo com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar' });
    }
});

module.exports = router;