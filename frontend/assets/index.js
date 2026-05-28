const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3009;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_token_queimados_educacao_2026';

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

app.use(cors());
app.use(express.json());

// ==========================================
// BANCO DE DADOS: MIGRAÇÕES AUTOMÁTICAS
// ==========================================
const inicializarBanco = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS setor (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                ativo BOOLEAN DEFAULT true
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS area (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                ativo BOOLEAN DEFAULT true
            );
        `);
        await pool.query(`
            ALTER TABLE eventos 
            ADD COLUMN IF NOT EXISTS setor_id_1 INTEGER REFERENCES setor(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS setor_id_2 INTEGER REFERENCES setor(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS setor_id_3 INTEGER REFERENCES setor(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES area(id) ON DELETE SET NULL;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS evento_publicos (
                evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
                publico_alvo_id INTEGER REFERENCES publicoalvo(id) ON DELETE CASCADE,
                PRIMARY KEY (evento_id, publico_alvo_id)
            );
        `);
        await pool.query(`
            ALTER TABLE frequencias 
            ADD COLUMN IF NOT EXISTS tempo_participacao VARCHAR(10);
        `);
        await pool.query(`
            ALTER TABLE log_fraudes 
            ADD COLUMN IF NOT EXISTS data_tentativa TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS lat_tentativa VARCHAR(50),
            ADD COLUMN IF NOT EXISTS lng_tentativa VARCHAR(50);
        `);
    } catch (err) {
        console.error("Erro nas migrações do banco:", err.message);
    }
};
inicializarBanco();

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acesso negado.' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Sessão expirada.' });
        req.user = decoded;
        next();
    });
};

const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180; const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ==========================================
// ROTAS DE AUTENTICAÇÃO ADMINISTRATIVA
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });
        
        const user = result.rows[0];
        if (!user.ativo) return res.status(403).json({ error: 'Usuário inativo.' });
        
        const senhaCriptografada = hashSenha(senha);
        if (user.senha !== senha && user.senha !== senhaCriptografada) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        
        const token = jwt.sign({ id: user.id, usuario: user.usuario }, JWT_SECRET, { expiresIn: '8h' });
        delete user.senha;
        return res.json({ token, user });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/auth/alterar-senha', async (req, res) => {
    const { usuario, novaSenha } = req.body;
    try {
        const hash = hashSenha(novaSenha);
        await pool.query('UPDATE usuarios SET senha = $1, deve_alterar_senha = false WHERE usuario = $2', [hash, usuario]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

// ==========================================
// ROTAS DO PORTAL DO PROFESSOR / DISPOSITIVOS
// ==========================================
app.get('/api/v2/dispositivo/status', async (req, res) => {
    const { device_token } = req.query;
    try {
        if (!device_token) return res.json({ atribuido: false });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.json({ atribuido: false });
        const disp = resDisp.rows[0];
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [disp.participante_id]);
        return res.json({ atribuido: true, participante: resPart.rows[0] });
    } catch (error) { return res.status(500).json({ error: 'Erro interno.' }); }
});

app.post('/api/v2/dispositivo/associar', async (req, res) => {
    const { matricula, nome, hardware_id } = req.body;
    try {
        if (!matricula || !nome) {
            return res.status(400).json({ error: 'A matrícula e o nome completo são obrigatórios.' });
        }

        const resPart = await pool.query('SELECT id FROM participantes WHERE matricula = $1', [matricula]);
        const pId = resPart.rows.length > 0 ? resPart.rows[0].id : null;

        if (hardware_id) {
            await pool.query(`ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS hardware_fingerprint VARCHAR(255)`).catch(() => {});
            const checkHardware = await pool.query(`
                SELECT * FROM dispositivos 
                WHERE hardware_fingerprint = $1 
                AND participante_matricula != $2 
                AND ativo = true
            `, [hardware_id, matricula]);

            if (checkHardware.rows.length > 0) {
                await pool.query(`
                    INSERT INTO log_fraudes (matricula, motivo) 
                    VALUES ($1, 'TENTATIVA_VINCULO_MULTIPLO_NO_MESMO_APARELHO_FISICO')
                `).catch(() => {});

                return res.status(403).json({ 
                    error: 'Bloqueio de Segurança: Detectamos que este aparelho físico já foi utilizado para vincular a matrícula de outro professor.' 
                });
            }
        }

        await pool.query(`UPDATE dispositivos SET ativo = false WHERE participante_matricula = $1 AND ativo = true`, [matricula]);
        const novoDeviceToken = crypto.randomUUID();

        await pool.query(`
            INSERT INTO dispositivos (participante_id, participante_matricula, device_token, ativo, hardware_fingerprint)
            VALUES ($1, $2, $3, true, $4)
        `, [pId, matricula, novoDeviceToken, hardware_id || null]);

        return res.json({ status: 'sucesso', device_token: novoDeviceToken });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno no servidor ao processar o vínculo.' });
    }
});

app.post('/api/v2/presenca/inicializar', async (req, res) => {
    const { device_token } = req.body;
    try {
        if (!device_token) return res.status(400).json({ error: 'Identificação ausente.' });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado ou desativado.' });
        const disp = resDisp.rows[0];

        const resEventos = await pool.query(`SELECT e.id, e.titulo, e.local, e.palestrante, e.hora_inicio, e.hora_fim, l.nome as local_nome, l.endereco as local_endereco, COALESCE(l.latitude, e.latitude) as latitude, COALESCE(l.longitude, e.longitude) as longitude FROM eventos e LEFT JOIN locais l ON e.local_id = l.id WHERE e.data_evento = CURRENT_DATE::date AND e.hora_fim >= CURRENT_TIME ORDER BY e.hora_inicio ASC`);
        const freqAtiva = await pool.query(`SELECT * FROM frequencias WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL LIMIT 1`, [disp.participante_id]);
        return res.json({
            status: 'sucesso', tem_evento_ativo: freqAtiva.rows.length > 0, evento_ativo_id: freqAtiva.rows.length > 0 ? freqAtiva.rows[0].evento_id : null,
            eventos: resEventos.rows.map(e => ({ id: e.id, titulo: e.titulo, palestrante: e.palestrante || '', local: e.local_nome || e.local || 'Auditório', endereco: e.local_endereco || e.endereco || '', latitude: e.latitude, longitude: e.longitude, hora_inicio: e.hora_inicio, hora_fim: e.hora_fim }))
        });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao inicializar o Portal.' }); }
});

app.post('/api/v2/presenca/checar-status', async (req, res) => {
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query(`SELECT e.*, COALESCE(l.latitude, e.latitude) as lat_real, COALESCE(l.longitude, e.longitude) as lng_real FROM eventos e LEFT JOIN locais l ON e.local_id = l.id WHERE e.id = $1`, [evento_id]);
        if (resEv.rows.length === 0) return res.status(404).json({ error: 'Formação não localizada.' });
        const ev = resEv.rows[0];

        if (calcularDistancia(latitude, longitude, parseFloat(ev.lat_real), parseFloat(ev.lng_real)) > 80000) {
            await pool.query(`INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa) VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3, $4)`, [disp.participante_matricula, evento_id, latitude, longitude]);
            return res.status(400).json({ error: 'Bloqueio de Segurança: Você está fora do raio permitido do local.' });
        }

        const resFreq = await pool.query(`SELECT *, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - data_entrada))/60 as minutos_decorridos FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = CURRENT_DATE::date`, [disp.participante_id, evento_id]);
        if (resFreq.rows.length > 0) {
            const freq = resFreq.rows[0];
            if (freq.data_saida !== null) return res.json({ status: 'completo' });
            return res.json({ status: 'somente_entrada' });
        }
        return res.json({ status: 'nenhum' });
    } catch (error) { return res.status(500).json({ error: 'Erro ao analisar status de presença.' }); }
});

// ALTERADO PARA ACEITAR AS DUAS ROTAS: A oficial e a curta que o frontend está chamando
app.post(['/api/v2/presenca', '/api/v2/presenca/confirmar-entrada'], async (req, res) => {
    // ... todo o resto do código interno da sua rota continua exatamente igual ...
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        
        await pool.query(`
            INSERT INTO frequencias (participante_id, evento_id, lat_entrada, lng_entrada, device_key, matricula, funcao, data_entrada) 
            VALUES ($1, $2, $3, $4, $5, $6, 'Ouvinte', CURRENT_TIMESTAMP)
        `, [resDisp.rows[0].participante_id, evento_id, String(latitude), String(longitude), device_token, resDisp.rows[0].participante_matricula]);
        
        return res.json({ status: 'sucesso' });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao salvar frequência.' }); }
});

app.post('/api/v2/presenca/confirmar-saida', async (req, res) => {
    const { device_token, evento_id, estrelas, comentario, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const ev = (await pool.query('SELECT data_evento, hora_inicio, hora_fim, publico_alvo_id FROM eventos WHERE id = $1', [evento_id])).rows[0];
        let avaliacaoTexto = estrelas === 5 ? 'Excelência total' : estrelas === 4 ? 'Muito Bom' : estrelas === 3 ? 'Atendeu às expectativas' : estrelas === 2 ? 'Regular' : 'Precisa melhorar bastante';

        const dataHoraReal = new Date(new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(' ', 'T'));
        const dataEventoFormatada = new Date(ev.data_evento).toISOString().split('T')[0];
        const dataHoraInicioOficial = new Date(`${dataEventoFormatada}T${ev.hora_inicio}`);
        const dataHoraTerminoOficial = new Date(`${dataEventoFormatada}T${ev.hora_fim}`);

        const resFreq = await pool.query(`SELECT id, data_entrada FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL`, [disp.participante_id, evento_id]);
        if (resFreq.rows.length === 0) return res.status(400).json({ error: 'Registro de entrada ativa não localizado.' });
        const freq = resFreq.rows[0];

        // BALIZAS DA REGRA DE PERMANÊNCIA ESTABELECIDA
        const entradaParaCalculo = new Date(freq.data_entrada) < dataHoraInicioOficial ? dataHoraInicioOficial : new Date(freq.data_entrada);
        const formulaSaida = dataHoraReal > dataHoraTerminoOficial ? dataHoraTerminoOficial : dataHoraReal;

        let tempoFinalFormatado = "00:00";
        if (formulaSaida > entradaParaCalculo) {
            const totalMinutosCalculados = Math.floor((formulaSaida - entradaParaCalculo) / (1000 * 60));
            tempoFinalFormatado = `${String(Math.floor(totalMinutosCalculados / 60)).padStart(2, '0')}:${String(totalMinutosCalculados % 60).padStart(2, '0')}`;
        }

        await pool.query('BEGIN');
        await pool.query(`UPDATE frequencias SET data_saida = $1, avaliacao = $2, lat_saida = $3, lng_saida = $4, tempo_participacao = $5 WHERE id = $6`, [dataHoraReal, avaliacaoTexto, String(latitude), String(longitude), tempoFinalFormatado, freq.id]);
        
        if ((await pool.query(`SELECT id FROM pesquisa_satisfacao WHERE participante_id = $1 AND evento_id = $2`, [disp.participante_id, evento_id])).rows.length === 0) {
            await pool.query(`INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em) VALUES ($1, $2, $3, $4, $5, $6)`, [disp.participante_id, evento_id, ev.publico_alvo_id, avaliacaoTexto, comentario || '', dataHoraReal]);
        }
        await pool.query('COMMIT');
        return res.json({ status: 'sucesso', tempo_gravado: tempoFinalFormatado });
    } catch (error) { await pool.query('ROLLBACK'); return res.status(500).json({ error: 'Erro interno ao processar saída.' }); }
});

app.get('/api/v2/eventos', async (req, res) => {
    try { return res.json((await pool.query(`SELECT id, titulo, local, palestrante, latitude, longitude, hora_inicio, hora_fim, data_evento FROM eventos WHERE data_evento = CURRENT_DATE ORDER BY hora_inicio ASC`)).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

// ==========================================
// OPERAÇÃO CENTRAL: EVENTOS / FORMAÇÕES
// ==========================================
app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, area_id, data_evento, carga_horaria, local_id, publicos_alvo_ids, setores_ids, hora_inicio, hora_fim, palestrante } = req.body;
    try {
        if (!local_id || !data_evento || !hora_inicio || !hora_fim) return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
        const dadosLocal = (await pool.query('SELECT nome, endereco, latitude, longitude FROM locais WHERE id = $1', [parseInt(local_id)])).rows[0];
        const s1 = setores_ids && setores_ids[0] ? parseInt(setores_ids[0]) : null;
        const s2 = setores_ids && setores_ids[1] ? parseInt(setores_ids[1]) : null;
        const s3 = setores_ids && setores_ids[2] ? parseInt(setores_ids[2]) : null;
        const p_id_retrocompativel = publicos_alvo_ids && publicos_alvo_ids[0] ? parseInt(publicos_alvo_ids[0]) : null;

        const result = await pool.query(`INSERT INTO eventos (titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim, palestrante, local, endereco, latitude, longitude, setor_id_1, setor_id_2, setor_id_3, area_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`, 
        [titulo, data_evento, parseFloat(carga_horaria || 0), parseInt(local_id), p_id_retrocompativel, hora_inicio.slice(0,5), hora_fim.slice(0,5), palestrante || '', dadosLocal.nome, dadosLocal.endereco, parseFloat(dadosLocal.latitude), parseFloat(dadosLocal.longitude), s1, s2, s3, area_id ? parseInt(area_id) : null]);

        const novoEventoId = result.rows[0].id;
        if (publicos_alvo_ids && Array.isArray(publicos_alvo_ids)) {
            for (let pId of publicos_alvo_ids) await pool.query('INSERT INTO evento_publicos (evento_id, publico_alvo_id) VALUES ($1, $2)', [novoEventoId, parseInt(pId)]);
        }
        return res.json({ id: novoEventoId });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

app.put('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { titulo, area_id, data_evento, carga_horaria, local_id, publicos_alvo_ids, setores_ids, hora_inicio, hora_fim, palestrante } = req.body;
    try {
        const dadosLocal = (await pool.query('SELECT nome, endereco, latitude, longitude FROM locais WHERE id = $1', [parseInt(local_id)])).rows[0] || {};
        const s1 = setores_ids && setores_ids[0] ? parseInt(setores_ids[0]) : null;
        const s2 = setores_ids && setores_ids[1] ? parseInt(setores_ids[1]) : null;
        const s3 = setores_ids && setores_ids[2] ? parseInt(setores_ids[2]) : null;
        const p_id_retrocompativel = publicos_alvo_ids && publicos_alvo_ids[0] ? parseInt(publicos_alvo_ids[0]) : null;

        await pool.query(`UPDATE eventos SET titulo=$1, data_evento=$2, carga_horaria=$3, local_id=$4, publico_alvo_id=$5, hora_inicio=$6, hora_fim=$7, palestrante=$8, local=$9, endereco=$10, latitude=$11, longitude=$12, setor_id_1=$13, setor_id_2=$14, setor_id_3=$15, area_id=$16 WHERE id=$17`, 
        [titulo, data_evento, parseFloat(carga_horaria || 0), parseInt(local_id), p_id_retrocompativel, hora_inicio.slice(0,5), hora_fim.slice(0,5), palestrante || '', dadosLocal.nome || '', dadosLocal.endereco || '', parseFloat(dadosLocal.latitude), parseFloat(dadosLocal.longitude), s1, s2, s3, area_id ? parseInt(area_id) : null, parseInt(id)]);

        await pool.query('DELETE FROM evento_publicos WHERE evento_id = $1', [parseInt(id)]);
        if (publicos_alvo_ids && Array.isArray(publicos_alvo_ids)) {
            for (let pId of publicos_alvo_ids) await pool.query('INSERT INTO evento_publicos (evento_id, publico_alvo_id) VALUES ($1, $2)', [parseInt(id), parseInt(pId)]);
        }
        return res.json({ success: true });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

app.delete('/api/v2/eventos/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM eventos WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

// ==========================================
// CRUD PLURAL / SINGULAR: SETOR & ÁREA
// ==========================================
app.get(['/api/v2/setor', '/api/v2/setores'], async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM setor ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.post(['/api/v2/setor', '/api/v2/setores'], verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO setor (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.put(['/api/v2/setor/:id', '/api/v2/setores/:id'], verificarToken, async (req, res) => {
    try { return res.json((await pool.query('UPDATE setor SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.delete(['/api/v2/setor/:id', '/api/v2/setores/:id'], verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM setor WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get(['/api/v2/area', '/api/v2/areas'], async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM area ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.post(['/api/v2/area', '/api/v2/areas'], verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO area (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.put(['/api/v2/area/:id', '/api/v2/areas/:id'], verificarToken, async (req, res) => {
    try { return res.json((await pool.query('UPDATE area SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.delete(['/api/v2/area/:id', '/api/v2/areas/:id'], verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM area WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ==========================================
// AUXILIARES ADICIONAIS DO PAINEL
// ==========================================
app.get('/api/v2/locais', async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM locais ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.post('/api/v2/locais', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO locais (nome, endereco, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *', [req.body.nome, req.body.endereco, req.body.latitude, req.body.longitude])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.put('/api/v2/locais/:id', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4 WHERE id=$5 RETURNING *', [req.body.nome, req.body.endereco, req.body.latitude, req.body.longitude, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.delete('/api/v2/locais/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM locais WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.get(['/api/v2/publico-alvo', '/api/v2/publico-alvos'], async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM publicoalvo ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.post(['/api/v2/publico-alvo', '/api/v2/publico-alvos'], verificarToken, async (req, res) => {
    const { nome } = req.body;
    try {
        if (!nome) return res.status(400).json({ error: 'O nome é obrigatório.' });
        return res.json((await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [nome])).rows[0]);
    } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.delete(['/api/v2/publico-alvo/:id', '/api/v2/publico-alvos/:id'], verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM publicoalvo WHERE id = $1', [parseInt(req.params.id)]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/participantes', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM participantes ORDER BY nome_completo ASC')).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.get('/api/v2/frequencias', verificarToken, async (req, res) => {
    try { return res.json((await pool.query(`SELECT f.*, p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria FROM frequencias f JOIN participantes p ON f.participante_id = p.id JOIN eventos e ON f.evento_id = e.id ORDER BY f.data_entrada DESC`)).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.get('/api/v2/log-fraudes', verificarToken, async (req, res) => {
    try { return res.json((await pool.query(`SELECT lf.*, e.titulo as evento_titulo FROM log_fraudes lf LEFT JOIN eventos e ON lf.evento_id = e.id ORDER BY lf.data_tentativa DESC`)).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.get('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome, usuario, ativo, deve_alterar_senha FROM usuarios ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.post('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { 
        const hash = hashSenha(req.body.senha);
        return res.json((await pool.query('INSERT INTO usuarios (nome, usuario, senha, ativo, deve_alterar_senha) VALUES ($1, $2, $3, true, false) RETURNING id, nome, usuario, ativo', [req.body.nome, req.body.usuario, hash])).rows[0]); 
    } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.put('/api/v2/usuarios/alterar-propria-senha', verificarToken, async (req, res) => {
    try { 
        const hash = hashSenha(req.body.novaSenha);
        await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, req.user.id]); 
        return res.json({ success: true }); 
    } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.delete('/api/v2/usuarios/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM usuarios WHERE id = $1', [parseInt(req.params.id)]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.delete('/api/v2/admin/log-fraudes/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM log_fraudes WHERE id = $1', [req.params.id]); return res.json({ status: 'sucesso' }); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.get('/api/v2/admin/listar-participantes-view', verificarToken, async (req, res) => {
    try { return res.json((await pool.query(`SELECT p.id, p.nome_completo, p.matricula, p.device_key, p.ativo, COUNT(f.id) AS total_presencas FROM participantes p LEFT JOIN frequencias f ON p.id = f.participante_id GROUP BY p.id, p.nome_completo, p.matricula, p.device_key, p.ativo ORDER BY p.id ASC`)).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.get('/api/v2/admin/pesquisa-satisfacao-detalhada', verificarToken, async (req, res) => {
    try { return res.json((await pool.query(`SELECT ps.id, ps.avaliacao, ps.comentarios, ps.criado_em, p.nome_completo AS participante_nome, p.matricula AS participante_matricula, e.titulo AS evento_titulo FROM pesquisa_satisfacao ps LEFT JOIN participantes p ON ps.participante_id = p.id LEFT JOIN eventos e ON ps.evento_id = e.id ORDER BY ps.criado_em DESC`)).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.get('/api/v2/admin/eventos', async (req, res) => {
    try { return res.json((await pool.query(`SELECT id, titulo, data_evento, hora_inicio, hora_fim, palestrante, local FROM eventos ORDER BY data_evento DESC, hora_inicio DESC`)).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.get('/api/v2/admin/eventos-detalhes/:id', verificarToken, async (req, res) => {
    try {
        const ev = (await pool.query('SELECT * FROM eventos WHERE id = $1', [req.params.id])).rows[0];
        const pub = (await pool.query('SELECT publico_alvo_id FROM evento_publicos WHERE evento_id = $1', [req.params.id])).rows.map(r => r.publico_alvo_id);
        return res.json({ ...ev, publicos_alvo_ids: pub });
    } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin/relatorio-integrado', verificarToken, async (req, res) => {
    const { data_inicio, data_fim, area_id, setor_id, publico_alvo_id } = req.query;
    try {
        if (!data_inicio || !data_fim) return res.status(400).json({ error: 'As datas de início e fim são obrigatórias.' });
        let filtrosSQL = `WHERE e.data_evento BETWEEN $1 AND $2`;
        let parametros = [data_inicio, data_fim];
        let contadorParam = 3;

        if (area_id) { filtrosSQL += ` AND e.area_id = $${contadorParam}`; parametros.push(parseInt(area_id)); contadorParam++; }
        if (setor_id) { filtrosSQL += ` AND (e.setor_id_1 = $${contadorParam} OR e.setor_id_2 = $${contadorParam} OR e.setor_id_3 = $${contadorParam})`; parametros.push(parseInt(setor_id)); contadorParam++; }
        if (publico_alvo_id) { filtrosSQL += ` AND EXISTS (SELECT 1 FROM evento_publicos ep WHERE ep.evento_id = e.id AND ep.publico_alvo_id = $${contadorParam})`; parametros.push(parseInt(publico_alvo_id)); contadorParam++; }

        const resultadoTotais = await pool.query(`SELECT COUNT(DISTINCT e.id) as total_eventos, COUNT(f.id) as total_frequencias FROM eventos e LEFT JOIN frequencias f ON f.evento_id = e.id ${filtrosSQL}`, parametros);
        const resultadoRegistros = await pool.query(`SELECT f.id, f.matricula, f.tempo_participacao, p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria, e.data_evento, f.data_entrada, f.data_saida FROM frequencias f INNER JOIN eventos e ON f.evento_id = e.id INNER JOIN participantes p ON f.participante_id = p.id ${filtrosSQL} ORDER BY e.data_evento DESC, f.data_entrada DESC`, parametros);

        return res.json({ totais: { total_eventos: parseInt(resultadoTotais.rows[0].total_eventos || 0), total_frequencias: parseInt(resultadoTotais.rows[0].total_frequencias || 0) }, registros: resultadoRegistros.rows });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

// ========================================================
// ROTA ADMIN: REGISTRO DE SAÍDA MANUAL POR ESQUECIMENTO
// ========================================================
app.post('/api/v2/admin/frequencias/saida-manual', verificarToken, async (req, res) => {
    const { frequencia_id, hora_saida } = req.body;
    try {
        if (!frequencia_id || !hora_saida) return res.status(400).json({ error: 'Dados incompletos.' });

        const resFreq = await pool.query(`
            SELECT f.*, e.data_evento, e.hora_inicio, e.hora_fim 
            FROM frequencias f 
            JOIN eventos e ON f.evento_id = e.id 
            WHERE f.id = $1
        `, [frequencia_id]);

        if (resFreq.rows.length === 0) return res.status(404).json({ error: 'Frequência não localizada.' });
        const freq = resFreq.rows[0];
        if (freq.data_saida !== null) return res.status(400).json({ error: 'Esta frequência já possui saída registrada.' });

        const dataEventoFormatada = new Date(freq.data_evento).toISOString().split('T')[0];
        const dataHoraEntrada = new Date(freq.data_entrada); 
        const dataHoraSaidaManual = new Date(`${dataEventoFormatada}T${hora_saida}`); 
        const dataHoraInicioOficial = new Date(`${dataEventoFormatada}T${freq.hora_inicio}`);
        const dataHoraFimPrevista = new Date(`${dataEventoFormatada}T${freq.hora_fim}`); 

        const entradaStr = dataHoraEntrada.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

        if (dataHoraSaidaManual <= dataHoraEntrada) {
            return res.status(400).json({ error: `A saída não pode ser anterior ou igual à hora de entrada (${entradaStr}).` });
        }
        if (dataHoraSaidaManual > dataHoraFimPrevista) {
            return res.status(400).json({ error: `A saída manual não pode ultrapassar a hora de término prevista do evento (${freq.hora_fim.slice(0,5)}).` });
        }

        // CÁLCULO ESTRITO DE TEMPO EFETIVO DE PARTICIPAÇÃO MANUAL
        const entradaParaCalculo = dataHoraEntrada < dataHoraInicioOficial ? dataHoraInicioOficial : dataHoraEntrada;
        const saidaParaCalculo = dataHoraSaidaManual > dataHoraFimPrevista ? dataHoraFimPrevista : dataHoraSaidaManual;

        let tempoFinalFormatado = "00:00";
        if (saidaParaCalculo > entradaParaCalculo) {
            const totalMinutosCalculados = Math.floor((saidaParaCalculo - entradaParaCalculo) / (1000 * 60));
            tempoFinalFormatado = `${String(Math.floor(totalMinutosCalculados / 60)).padStart(2, '0')}:${String(totalMinutosCalculados % 60).padStart(2, '0')}`;
        }

        await pool.query(`
            UPDATE frequencias 
            SET data_saida = $1, tempo_participacao = $2
            WHERE id = $3
        `, [dataHoraSaidaManual, tempoFinalFormatado, frequencia_id]);

        return res.json({ status: 'sucesso', message: 'Saída manual registrada e professor liberado!', tempo_gravado: tempoFinalFormatado });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao registrar saída manual.' });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.listen(PORT, () => console.log(`Servidor ativado na porta ${PORT}`));