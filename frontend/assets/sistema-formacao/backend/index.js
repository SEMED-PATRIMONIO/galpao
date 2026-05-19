const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3009;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_token_queimados_educacao_2026';

// Configuração de conexão com o banco de dados PostgreSQL baseada nas tabelas reais
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DB_PASSWORD || 'Gatosap2009*2',
    port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(express.json());

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
        }
        req.user = decoded;
        next();
    });
};

app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
        return res.status(400).json({ error: 'Os campos usuário e senha são estritamente obrigatórios.' });
    }

    try {
        const queryText = 'SELECT id, nome, usuario, senha, ativo, deve_alterar_senha FROM usuarios WHERE usuario = $1';
        const result = await pool.query(queryText, [usuario]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
        }

        const user = result.rows[0];

        if (!user.ativo) {
            return res.status(403).json({ error: 'Este usuário está inativo no sistema administrativo.' });
        }

        if (senha !== user.senha) {
            return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
        }

        const token = jwt.sign(
            { id: user.id, nome: user.nome, usuario: user.usuario },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token,
            user: {
                id: user.id,
                nome: user.nome,
                usuario: user.usuario,
                deve_alterar_senha: user.deve_alterar_senha
            }
        });

    } catch (error) {
        console.error('Erro na rota de autenticação de login:', error);
        return res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao processar o login.' });
    }
});

app.get('/api/v2/locais', verificarToken, async (req, res) => {
    try {
        const queryText = 'SELECT id, nome, endereco, latitude, longitude, ativo FROM locais ORDER BY nome ASC';
        const result = await pool.query(queryText);
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar lista geral de locais:', error);
        return res.status(500).json({ error: 'Erro interno ao recuperar os locais do banco de dados.' });
    }
});

// Listagem exclusiva de locais ativos para alimentar o select do formulário de eventos
app.get('/api/v2/locais/ativos', verificarToken, async (req, res) => {
    try {
        const queryText = 'SELECT id, nome FROM locais WHERE ativo = true ORDER BY nome ASC';
        const result = await pool.query(queryText);
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar locais ativos:', error);
        return res.status(500).json({ error: 'Erro interno ao recuperar os locais ativos.' });
    }
});

// Criação de um novo local na base de dados
app.post('/api/v2/locais', verificarToken, async (req, res) => {
    const { nome, endereco, latitude, longitude } = req.body;

    if (!nome || !endereco || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Todos os campos (nome, endereço, latitude, longitude) precisam ser preenchidos.' });
    }

    try {
        const queryText = 'INSERT INTO locais (nome, endereco, latitude, longitude, ativo) VALUES ($1, $2, $3, $4, true) RETURNING *';
        const result = await pool.query(queryText, [nome, endereco, latitude, longitude]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao inserir novo local na tabela:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar os dados do novo local.' });
    }
});

// Alteração de dados cadastrais de um local existente
app.put('/api/v2/locais/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome, endereco, latitude, longitude } = req.body;

    if (!nome || !endereco || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Parâmetros incompletos para a atualização do local.' });
    }

    try {
        const queryText = 'UPDATE locais SET nome = $1, endereco = $2, latitude = $3, longitude = $4 WHERE id = $5 RETURNING *';
        const result = await pool.query(queryText, [nome, endereco, latitude, longitude, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum local foi encontrado com o ID informado.' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar local cadastrado:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar as modificações do local.' });
    }
});

// Inativação lógica do local (Soft Delete para preservar integridade com a tabela eventos)
app.patch('/api/v2/locais/:id/inativar', verificarToken, async (req, res) => {
    const { id } = req.params;

    try {
        const queryText = 'UPDATE locais SET ativo = false WHERE id = $1 RETURNING *';
        const result = await pool.query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum local encontrado para inativação.' });
        }

        return res.json({ message: 'O local foi inativado com sucesso.', local: result.rows[0] });
    } catch (error) {
        console.error('Erro ao inativar local do sistema:', error);
        return res.status(500).json({ error: 'Erro interno ao modificar o status de atividade do local.' });
    }
});

app.patch('/api/v2/locais/:id/restaurar', verificarToken, async (req, res) => {
    const { id } = req.params;

    try {
        const queryText = 'UPDATE locais SET ativo = true WHERE id = $1 RETURNING *';
        const result = await pool.query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum local encontrado para restauração.' });
        }

        return res.json({ message: 'O local foi restaurado com sucesso.', local: result.rows[0] });
    } catch (error) {
        console.error('Erro ao restaurar local do sistema:', error);
        return res.status(500).json({ error: 'Erro interno ao reativar o status do local.' });
    }
});
app.get('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, ativo FROM publicoalvo ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar público-alvo.' });
    }
});

app.get('/api/v2/publico-alvo/ativos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome FROM publicoalvo WHERE ativo = true ORDER BY nome ASC');
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar públicos-alvo ativos.' });
    }
});

app.post('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    const { nome } = req.body;
    if (!nome) {
        return res.status(400).json({ error: 'O nome é obrigatório.' });
    }
    try {
        const result = await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [nome]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao salvar público-alvo.' });
    }
});

app.put('/api/v2/publico-alvo/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome) {
        return res.status(400).json({ error: 'O nome é obrigatório.' });
    }
    try {
        const result = await pool.query('UPDATE publicoalvo SET nome = $1 WHERE id = $2 RETURNING *', [nome, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Público-alvo não encontrado.' });
        }
        return res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao atualizar público-alvo.' });
    }
});

app.patch('/api/v2/publico-alvo/:id/inativar', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE publicoalvo SET ativo = false WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Público-alvo não encontrado.' });
        }
        return res.json({ message: 'Inativado com sucesso.', data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao inativar público-alvo.' });
    }
});

app.patch('/api/v2/publico-alvo/:id/reativar', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE publicoalvo SET ativo = true WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Público-alvo não encontrado.' });
        }
        return res.json({ message: 'Reativado com sucesso.', data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao reativar público-alvo.' });
    }
});

app.get('/api/v2/eventos', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT e.*, l.nome as local_nome, p.nome as publico_alvo_nome 
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN publicoalvo p ON e.publico_alvo_id = p.id
            ORDER BY e.data_evento DESC, e.hora_inicio DESC
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao buscar eventos.' });
    }
});

app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id } = req.body;

    if (!titulo || !data_evento || !carga_horaria || !local_id || !hora_inicio || !hora_fim || !publico_alvo_id) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    try {
        const conflitoQuery = `
            SELECT id FROM eventos 
            WHERE local_id = $1 
              AND data_evento = $2 
              AND hora_inicio < $4 
              AND hora_fim > $3
        `;
        const conflitoResult = await pool.query(conflitoQuery, [local_id, data_evento, hora_inicio, hora_fim]);

        if (conflitoResult.rows.length > 0) {
            return res.status(409).json({ error: 'Conflito de horário: Já existe um evento agendado para este local neste mesmo intervalo de tempo.' });
        }

        const insertQuery = `
            INSERT INTO eventos (titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao criar evento.' });
    }
});

app.put('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id } = req.body;

    if (!titulo || !data_evento || !carga_horaria || !local_id || !hora_inicio || !hora_fim || !publico_alvo_id) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    try {
        const conflitoQuery = `
            SELECT id FROM eventos 
            WHERE local_id = $1 
              AND data_evento = $2 
              AND hora_inicio < $4 
              AND hora_fim > $3
              AND id != $5
        `;
        const conflitoResult = await pool.query(conflitoQuery, [local_id, data_evento, hora_inicio, hora_fim, id]);

        if (conflitoResult.rows.length > 0) {
            return res.status(409).json({ error: 'Conflito de horário: Já existe outro evento agendado para este local neste mesmo intervalo de tempo.' });
        }

        const updateQuery = `
            UPDATE eventos 
            SET titulo = $1, data_evento = $2, carga_horaria = $3, palestrante = $4, local = $5, token_qr = $6, endereco = $7, latitude = $8, longitude = $9, local_id = $10, hora_inicio = $11, hora_fim = $12, publico_alvo_id = $13
            WHERE id = $14
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [titulo, data_evento, carga_horaria, palestrante, local, token_qr, endereco, latitude, longitude, local_id, hora_inicio, hora_fim, publico_alvo_id, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento não encontrado.' });
        }
        return res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao atualizar evento.' });
    }
});
app.delete('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM eventos WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento não encontrado.' });
        }
        return res.json({ message: 'Evento excluído com sucesso.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao excluir evento.' });
    }
});

app.post('/api/v2/pesquisa-satisfacao', verificarToken, async (req, res) => {
    const { participante_id, evento_id, publico_alvo_id, avaliacao, comentarios } = req.body;
    if (!evento_id || !avaliacao) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [participante_id, evento_id, publico_alvo_id, avaliacao, comentarios]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao salvar pesquisa de satisfação.' });
    }
});

app.get('/api/v2/pesquisa-satisfacao/evento/:evento_id', verificarToken, async (req, res) => {
    const { evento_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT p.*, part.nome_completo as participante_nome, part.matricula, pa.nome as publico_alvo_nome
            FROM pesquisa_satisfacao p
            LEFT JOIN participantes part ON p.participante_id = part.id
            LEFT JOIN publicoalvo pa ON p.publico_alvo_id = pa.id
            WHERE p.evento_id = $1
            ORDER BY p.criado_em DESC
        `, [evento_id]);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar pesquisas do evento.' });
    }
});

app.get('/api/v2/relatorios/prestacao-contas', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    try {
        let query = `
            SELECT e.id, e.titulo, e.data_evento, e.carga_horaria, e.palestrante, e.hora_inicio, e.hora_fim,
                   l.nome as local_nome,
                   COUNT(f.id) as total_participantes
            FROM eventos e
            LEFT JOIN locais l ON e.local_id = l.id
            LEFT JOIN frequencias f ON e.id = f.evento_id
        `;
        const params = [];
        if (data_inicio && data_fim) {
            query += ` WHERE e.data_evento BETWEEN $1 AND $2 `;
            params.push(data_inicio, data_fim);
        }
        query += ` GROUP BY e.id, l.nome ORDER BY e.data_evento DESC, e.hora_inicio DESC `;
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao gerar relatório de prestação de contas.' });
    }
});

app.get('/api/v2/relatorios/log-frequencia', verificarToken, async (req, res) => {
    const { data_inicio, data_fim, evento_id } = req.query;
    try {
        let query = `
            SELECT f.*, p.nome_completo as participante_nome, e.titulo as evento_titulo, l.nome as local_nome
            FROM frequencias f
            JOIN participantes p ON f.participante_id = p.id
            JOIN eventos e ON f.evento_id = e.id
            LEFT JOIN locais l ON e.local_id = l.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;
        if (data_inicio && data_fim) {
            query += ` AND e.data_evento BETWEEN $${paramCount} AND $${paramCount + 1} `;
            params.push(data_inicio, data_fim);
            paramCount += 2;
        }
        if (evento_id) {
            query += ` AND f.evento_id = $${paramCount} `;
            params.push(evento_id);
            paramCount++;
        }
        query += ` ORDER BY f.data_entrada DESC `;
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar log de frequências.' });
    }
});

app.get('/api/v2/relatorios/log-fraudes', verificarToken, async (req, res) => {
    const { data_inicio, data_fim } = req.query;
    try {
        let query = `
            SELECT lf.*, e.titulo as evento_titulo, e.data_evento
            FROM log_fraudes lf
            JOIN eventos e ON lf.evento_id = e.id
            WHERE 1=1
        `;
        const params = [];
        if (data_inicio && data_fim) {
            query += ` AND e.data_evento BETWEEN $1 AND $2 `;
            params.push(data_inicio, data_fim);
        }
        query += ` ORDER BY lf.data_tentativa DESC `;
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao recuperar log de fraudes.' });
    }
});

app.use((req, res) => {
    return res.status(404).json({ error: 'Rota não encontrada no servidor.' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).json({ error: 'Ocorreu um erro interno crítico no servidor.' });
});

app.listen(PORT, () => {
    console.log(`Servidor ativo na porta ${PORT}`);
});