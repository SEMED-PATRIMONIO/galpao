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
            ALTER TABLE frequencias 
            ADD COLUMN IF NOT EXISTS tempo_participacao VARCHAR(10);
        `);
        await pool.query(`
            ALTER TABLE dispositivos 
            ADD COLUMN IF NOT EXISTS hardware_fingerprint VARCHAR(255);
        `).catch(() => {});
        await pool.query(`
            CREATE TABLE IF NOT EXISTS log_fraudes (
                id SERIAL PRIMARY KEY,
                matricula VARCHAR(50),
                evento_id INTEGER,
                motivo VARCHAR(255),
                data_tentativa TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                lat_tentativa VARCHAR(50),
                lng_tentativa VARCHAR(50)
            );
        `).catch(() => {});
    } catch (err) {
        console.error(err.message);
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
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

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
app.get('/api/v2/dispositivo/status', async (req, res) => {
    const { device_token } = req.query;
    try {
        if (!device_token) return res.json({ atribuido: false });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.json({ atribuido: false });
        const disp = resDisp.rows[0];
        const resPart = await pool.query('SELECT * FROM participantes WHERE id = $1', [disp.participante_id]);
        return res.json({ atribuido: true, participante: resPart.rows[0] });
    } catch (error) { 
        return res.status(500).json({ error: 'Erro interno.' }); 
    }
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
                `, [matricula]).catch(() => {});
                return res.status(403).json({ 
                    error: 'Bloqueio de Segurança: Detectamos que este aparelho físico já foi utilizado para vincular a matrícula de outro professor.' 
                });
            }
        }

        await pool.query('UPDATE dispositivos SET ativo = false WHERE participante_matricula = $1 AND ativo = true', [matricula]);
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
    const { device_token, device_key } = req.body;
    const tokenEfetivo = device_token || device_key;
    try {
        if (!tokenEfetivo) return res.status(400).json({ error: 'Identificação ausente.' });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado ou desativado.' });
        const disp = resDisp.rows[0];

        const resEventos = await pool.query(`
            SELECT e.id, e.titulo, e.local, e.palestrante, e.hora_inicio, e.hora_fim, 
                   l.nome as local_nome, l.endereco as local_endereco, 
                   COALESCE(l.latitude, e.latitude) as latitude, COALESCE(l.longitude, e.longitude) as longitude 
            FROM eventos e 
            LEFT JOIN locais l ON e.local_id = l.id 
            WHERE e.data_evento = CURRENT_DATE::date AND e.hora_fim >= CURRENT_TIME 
            ORDER BY e.hora_inicio ASC
        `);
        const freqAtiva = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL 
            LIMIT 1
        `, [disp.participante_id]);

        return res.json({
            status: 'sucesso', 
            tem_evento_ativo: freqAtiva.rows.length > 0, 
            evento_ativo_id: freqAtiva.rows.length > 0 ? freqAtiva.rows[0].evento_id : null,
            eventos: resEventos.rows.map(e => ({ 
                id: e.id, 
                titulo: e.titulo, 
                palestrante: e.palestrante || '', 
                local: e.local_nome || e.local || 'Auditório', 
                endereco: e.local_endereco || e.endereco || '', 
                latitude: e.latitude, 
                longitude: e.longitude, 
                hora_inicio: e.hora_inicio, 
                hora_fim: e.hora_fim 
            }))
        });
    } catch (error) { 
        return res.status(500).json({ error: 'Erro interno ao inicializar o Portal.' }); 
    }
});

app.post('/api/v2/presenca/checar-status', async (req, res) => {
    const { device_token, device_key, evento_id, latitude, longitude, lat, lng } = req.body;
    const tokenEfetivo = device_token || device_key;
    const latEfetiva = latitude || lat;
    const lngEfetiva = longitude || lng;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query(`
            SELECT e.*, COALESCE(l.latitude, e.latitude) as lat_real, COALESCE(l.longitude, e.longitude) as lng_real 
            FROM eventos e 
            LEFT JOIN locais l ON e.local_id = l.id 
            WHERE e.id = $1
        `, [evento_id]);
        if (resEv.rows.length === 0) return res.status(404).json({ error: 'Formação não localizada.' });
        const ev = resEv.rows[0];

        if (calcularDistancia(latEfetiva, lngEfetiva, parseFloat(ev.lat_real), parseFloat(ev.lng_real)) > 1000) {
            await pool.query(`
                INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa) 
                VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3, $4)
            `, [disp.participante_matricula, evento_id, String(latEfetiva), String(lngEfetiva)]);
            return res.status(400).json({ error: 'Bloqueio de Segurança: Você está fora do raio permitido do local.' });
        }

        const resFreq = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = CURRENT_DATE::date
        `, [disp.participante_id, evento_id]);
        if (resFreq.rows.length > 0) {
            const freq = resFreq.rows[0];
            if (freq.data_saida !== null) return res.json({ status: 'completo' });
            return res.json({ status: 'somente_entrada' });
        }
        return res.json({ status: 'nenhum' });
    } catch (error) { 
        return res.status(500).json({ error: 'Erro ao analisar status de presença.' }); 
    }
});

app.post(['/api/v2/presencas', '/api/v2/presenca', '/api/v2/presenca/confirmar-entrada'], async (req, res) => {
    const { device_key, device_token, evento_id, lat_entrada, lng_entrada, lat, lng, latitude, longitude } = req.body;
    const tokenEfetivo = device_key || device_token;
    const latEfetiva = lat_entrada || lat || latitude;
    const lngEfetiva = lng_entrada || lng || longitude;
    try {
        if (!tokenEfetivo) return res.status(400).json({ error: 'Identificação ausente.' });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado ou desativado.' });
        const disp = resDisp.rows[0];

        const checkDuplicado = await pool.query(`
            SELECT id FROM frequencias 
            WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL
        `, [disp.participante_id, evento_id]);
        if (checkDuplicado.rows.length > 0) {
            return res.json({ status: 'sucesso', message: 'Presença já estava ativa.' });
        }

        await pool.query(`
            INSERT INTO frequencias (participante_id, evento_id, lat_entrada, lng_entrada, device_key, matricula, funcao, data_entrada) 
            VALUES ($1, $2, $3, $4, $5, $6, 'Ouvinte', CURRENT_TIMESTAMP)
        `, [disp.participante_id, evento_id, String(latEfetiva || ''), String(lngEfetiva || ''), tokenEfetivo, disp.participante_matricula]);

        return res.json({ status: 'sucesso' });
    } catch (error) { 
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao salvar frequência.' }); 
    }
});

app.post('/api/v2/presenca/confirmar-saida', async (req, res) => {
    const { device_token, device_key, evento_id, estrelas, comentario, lat, lng, latitude, longitude, avaliacao, comentarios } = req.body;
    const tokenEfetivo = device_token || device_key;
    const latEfetiva = lat || latitude;
    const lngEfetiva = lng || longitude;
    const textoComentario = comentario || comentarios || '';
    const notaEstrelas = estrelas || (avaliacao === 'Ótimo' ? 5 : avaliacao === 'Muito Bom' ? 4 : avaliacao === 'Bom' ? 3 : avaliacao === 'Regular' ? 2 : 1);
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const ev = (await pool.query('SELECT data_evento, hora_inicio, hora_fim, publico_alvo_id FROM eventos WHERE id = $1', [evento_id])).rows[0];
        let avaliacaoTexto = notaEstrelas === 5 ? 'Excelência total' : notaEstrelas === 4 ? 'Muito Bom' : notaEstrelas === 3 ? 'Atendeu às expectativas' : notaEstrelas === 2 ? 'Regular' : 'Precisa melhorar bastante';

        const dataHoraReal = new Date(new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(' ', 'T'));
        const dataEventoFormatada = new Date(ev.data_evento).toISOString().split('T')[0];
        const dataHoraInicioOficial = new Date(`${dataEventoFormatada}T${ev.hora_inicio}`);
        const dataHoraTerminoOficial = new Date(`${dataEventoFormatada}T${ev.hora_fim}`);

        const resFreq = await pool.query(`SELECT id, data_entrada FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL`, [disp.participante_id, evento_id]);
        if (resFreq.rows.length === 0) return res.status(400).json({ error: 'Registro de entrada ativa não localizado.' });
        const freq = resFreq.rows[0];

        const entradaParaCalculo = new Date(freq.data_entrada) < dataHoraInicioOficial ? dataHoraInicioOficial : new Date(freq.data_entrada);
        const formulaSaida = dataHoraReal > dataHoraTerminoOficial ? dataHoraTerminoOficial : dataHoraReal;

        let tempoFinalFormatado = "00:00";
        if (formulaSaida > entradaParaCalculo) {
            const totalMinutosCalculados = Math.floor((formulaSaida - entradaParaCalculo) / (1000 * 60));
            tempoFinalFormatado = `${String(Math.floor(totalMinutosCalculados / 60)).padStart(2, '0')}:${String(totalMinutosCalculados % 60).padStart(2, '0')}`;
        }

        await pool.query('BEGIN');
        await pool.query(`UPDATE frequencias SET data_saida = $1, avaliacao = $2, lat_saida = $3, lng_saida = $4, tempo_participacao = $5 WHERE id = $6`, [dataHoraReal, avaliacaoTexto, String(latEfetiva || ''), String(lngEfetiva || ''), tempoFinalFormatado, freq.id]);
        await pool.query(`INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em) VALUES ($1, $2, $3, $4, $5, $6)`, [disp.participante_id, evento_id, ev.publico_alvo_id, avaliacaoTexto, textoComentario, dataHoraReal]);
        await pool.query('COMMIT');

        return res.json({ status: 'sucesso', tempo_gravado: tempoFinalFormatado });
    } catch (error) { 
        await pool.query('ROLLBACK'); 
        console.error(error); 
        return res.status(500).json({ error: 'Erro interno ao processar saída.' }); 
    }
});
app.get('/api/v2/eventos', async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT id, titulo, local, palestrante, latitude, longitude, hora_inicio, hora_fim, data_evento FROM eventos WHERE data_evento = CURRENT_DATE ORDER BY hora_inicio ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.get(['/api/v2/setor', '/api/v2/setores'], async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT * FROM setor ORDER BY nome ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.post(['/api/v2/setor', '/api/v2/setores'], verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('INSERT INTO setor (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.put(['/api/v2/setor/:id', '/api/v2/setores/:id'], verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('UPDATE setor SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.delete(['/api/v2/setor/:id', '/api/v2/setores/:id'], verificarToken, async (req, res) => {
    try { 
        await pool.query('DELETE FROM setor WHERE id = $1', [req.params.id]); 
        return res.json({ success: true }); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get(['/api/v2/area', '/api/v2/areas'], async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT * FROM area ORDER BY nome ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.post(['/api/v2/area', '/api/v2/areas'], verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('INSERT INTO area (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.put(['/api/v2/area/:id', '/api/v2/areas/:id'], verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('UPDATE area SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.delete(['/api/v2/area/:id', '/api/v2/areas/:id'], verificarToken, async (req, res) => {
    try { 
        await pool.query('DELETE FROM area WHERE id = $1', [req.params.id]); 
        return res.json({ success: true }); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/locais', async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT * FROM locais ORDER BY nome ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.post('/api/v2/locais', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('INSERT INTO locais (nome, endereco, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *', [req.body.nome, req.body.endereco, req.body.latitude, req.body.longitude])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.put('/api/v2/locais/:id', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4 WHERE id=$5 RETURNING *', [req.body.nome, req.body.endereco, req.body.latitude, req.body.longitude, req.params.id])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.delete('/api/v2/locais/:id', verificarToken, async (req, res) => {
    try { 
        await pool.query('DELETE FROM locais WHERE id = $1', [req.params.id]); 
        return res.json({ success: true }); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.get(['/api/v2/publico-alvo', '/api/v2/publico-alvos'], async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT * FROM publicoalvo ORDER BY nome ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.post(['/api/v2/publico-alvo', '/api/v2/publico-alvos'], verificarToken, async (req, res) => {
    const { nome } = req.body;
    try {
        if (!nome) return res.status(400).json({ error: 'O nome é obrigatório.' });
        return res.json((await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [nome])).rows[0]);
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.delete(['/api/v2/publico-alvo/:id', '/api/v2/publico-alvos/:id'], verificarToken, async (req, res) => {
    try { 
        await pool.query('DELETE FROM publicoalvo WHERE id = $1', [parseInt(req.params.id)]); 
        return res.json({ success: true }); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/participantes', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT * FROM participantes ORDER BY nome_completo ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.get('/api/v2/frequencias', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query(`SELECT f.*, p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria FROM frequencias f JOIN participantes p ON f.participante_id = p.id JOIN eventos e ON f.evento_id = e.id ORDER BY f.data_entrada DESC`)).rows); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.get('/api/v2/log-fraudes', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query(`SELECT lf.*, e.titulo as evento_titulo FROM log_fraudes lf LEFT JOIN eventos e ON lf.evento_id = e.id ORDER BY lf.data_tentativa DESC`)).rows); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.get('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query('SELECT id, nome, usuario, ativo, deve_alterar_senha FROM usuarios ORDER BY nome ASC')).rows); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.post('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { 
        const hash = hashSenha(req.body.senha);
        return res.json((await pool.query('INSERT INTO usuarios (nome, usuario, senha, ativo, deve_alterar_senha) VALUES ($1, $2, $3, true, false) RETURNING id, nome, usuario, ativo', [req.body.nome, req.body.usuario, hash])).rows[0]); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.put('/api/v2/usuarios/alterar-propria-senha', verificarToken, async (req, res) => {
    try { 
        const hash = hashSenha(req.body.novaSenha);
        await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, req.user.id]); 
        return res.json({ success: true }); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.delete('/api/v2/usuarios/:id', verificarToken, async (req, res) => {
    try { 
        await pool.query('DELETE FROM usuarios WHERE id = $1', [parseInt(req.params.id)]); 
        return res.json({ success: true }); 
    } catch (e) { 
        return res.status(500).json({ error: 'Erro.' }); 
    }
});

app.delete('/api/v2/admin/log-fraudes/:id', verificarToken, async (req, res) => {
    try { 
        await pool.query('DELETE FROM log_fraudes WHERE id = $1', [req.params.id]); 
        return res.json({ status: 'sucesso' }); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/admin/listar-participantes-view', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query(`SELECT p.id, p.nome_completo, p.matricula, p.device_key, p.ativo, COUNT(f.id) AS total_presencas FROM participantes p LEFT JOIN frequencias f ON p.id = f.participante_id GROUP BY p.id, p.nome_completo, p.matricula, p.device_key, p.ativo ORDER BY p.id ASC`)).rows); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/admin/pesquisa-satisfacao-detalhada', verificarToken, async (req, res) => {
    try { 
        return res.json((await pool.query(`SELECT ps.id, ps.avaliacao, ps.comentarios, ps.criado_em, p.nome_completo AS participante_nome, p.matricula AS participante_matricula, e.titulo AS evento_titulo FROM pesquisa_satisfacao ps LEFT JOIN participantes p ON ps.participante_id = p.id LEFT JOIN eventos e ON ps.evento_id = e.id ORDER BY ps.criado_em DESC`)).rows); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/admin/eventos', async (req, res) => {
    try { 
        return res.json((await pool.query(`SELECT id, titulo, data_evento, hora_inicio, hora_fim, palestrante, local FROM eventos ORDER BY data_evento DESC, hora_inicio DESC`)).rows); 
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/admin/eventos-detalhes/:id', verificarToken, async (req, res) => {
    try {
        const ev = (await pool.query('SELECT * FROM eventos WHERE id = $1', [req.params.id])).rows[0];
        return res.json({ ...ev });
    } catch (e) { 
        return res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/v2/admin/relatorio-integrado', verificarToken, async (req, res) => {
    const { data_inicio, data_fim, area_id, setor_id, publico_alvo_id } = req.query;
    try {
        if (!data_inicio || !data_fim) return res.status(400).json({ error: 'As datas são obrigatórias.' });
        let filtrosSQL = `WHERE e.data_evento BETWEEN $1 AND $2`;
        let parametros = [data_inicio, data_fim];
        let contadorParam = 3;

        if (area_id) { filtrosSQL += ` AND e.area_id = $${contadorParam}`; parametros.push(parseInt(area_id)); contadorParam++; }
        if (setor_id) { filtrosSQL += ` AND (e.setor_id_1 = $${contadorParam} OR e.setor_id_2 = $${contadorParam} OR e.setor_id_3 = $${contadorParam})`; parametros.push(parseInt(setor_id)); contadorParam++; }
        if (publico_alvo_id) { filtrosSQL += ` AND e.publico_alvo_id = $${contadorParam}`; parametros.push(parseInt(publico_alvo_id)); contadorParam++; }

        const resultadoTotais = await pool.query(`SELECT COUNT(DISTINCT e.id) as total_eventos, COUNT(f.id) as total_frequencias FROM eventos e LEFT JOIN frequencias f ON f.evento_id = e.id ${filtrosSQL}`, parametros);
        const resultadoRegistros = await pool.query(`SELECT f.id, f.matricula, f.tempo_participacao, p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria, e.data_evento, f.data_entrada, f.data_saida FROM frequencias f INNER JOIN eventos e ON f.evento_id = e.id INNER JOIN participantes p ON f.participante_id = p.id ${filtrosSQL} ORDER BY e.data_evento DESC, f.data_entrada DESC`, parametros);

        return res.json({ totais: { total_eventos: parseInt(resultadoTotais.rows[0].total_eventos || 0), total_frequencias: parseInt(resultadoTotais.rows[0].total_frequencias || 0) }, registros: resultadoRegistros.rows });
    } catch (error) { 
        return res.status(500).json({ error: error.message }); 
    }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.listen(PORT, () => console.log(`Servidor ativado na porta ${PORT}`));