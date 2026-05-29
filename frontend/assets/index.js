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

const verificarTokenAdminExclusivo = (req, res, next) => {
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

app.post('/api/v2/admin-exclusivo/auth/login', async (req, res) => {
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

app.post('/api/v2/admin-exclusivo/auth/alterar-senha-obrigatoria', verificarTokenAdminExclusivo, async (req, res) => {
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
        const resEventos = await pool.query(`
            SELECT e.id, e.titulo, e.local, e.palestrante, e.hora_inicio, e.hora_fim, 
                   l.nome as local_nome, l.endereco as local_endereco, 
                   COALESCE(l.latitude, e.latitude) as latitude, COALESCE(l.longitude, e.longitude) as longitude 
            FROM eventos e 
            LEFT JOIN locais l ON e.local_id = l.id 
            WHERE e.data_evento = CURRENT_DATE::date AND e.hora_fim >= CURRENT_TIME 
            ORDER BY e.hora_inicio ASC
        `);

        const listaEventosFormatada = resEventos.rows.map(e => ({ 
            id: e.id, 
            titulo: e.titulo, 
            palestrante: e.palestrante || '', 
            local: e.local_nome || e.local || 'Auditório', 
            endereco: e.local_endereco || e.endereco || '', 
            latitude: e.latitude, 
            longitude: e.longitude, 
            hora_inicio: e.hora_inicio, 
            hora_fim: e.hora_fim 
        }));

        if (listaEventosFormatada.length === 0) {
            return res.status(404).json({ 
                status: 'erro', 
                situacao: 'sem_evento', 
                eventos: [] 
            });
        }

        if (!tokenEfetivo) {
            return res.json({ 
                status: 'sucesso', 
                situacao: 'nao_vinculado', 
                eventos: listaEventosFormatada 
            });
        }

        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);

        if (resDisp.rows.length === 0) {
            return res.json({ 
                status: 'sucesso', 
                situacao: 'nao_vinculado', 
                eventos: listaEventosFormatada 
            });
        }

        const disp = resDisp.rows[0];

        const resSaidaPendenteAntiga = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND data_entrada::date < CURRENT_DATE::date AND data_saida IS NULL 
            LIMIT 1
        `, [disp.participante_id]);

        if (resSaidaPendenteAntiga.rows.length > 0) {
            return res.json({
                status: 'sucesso',
                situacao: 'bloqueado_saida_estourada',
                eventos: listaEventosFormatada
            });
        }

        const freqAtiva = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL 
            LIMIT 1
        `, [disp.participante_id]);

        return res.json({
            status: 'sucesso', 
            situacao: 'regular',
            tem_evento_ativo: freqAtiva.rows.length > 0, 
            evento_ativo_id: freqAtiva.rows.length > 0 ? freqAtiva.rows[0].evento_id : null,
            eventos: listaEventosFormatada
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

// Exemplo de Endpoint na sua API Node.js
app.post('/api/v2/presencas', async (req, res) => {
    const { device_key, evento_id, lat_entrada, lng_entrada } = req.body;

    try {
        // 1. Busca os dados do evento e o participante vinculado ao device_key
        const evento = await db.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
        const participante = await db.query('SELECT * FROM participantes WHERE device_key = $1', [device_key]);
        
        const matricula = participante.rows[0]?.matricula || 'Desconhecido';

        // 2. Cálculo da Distância (Haversine) entre o GPS do aluno e o GPS do Evento
        const distancia = calcularDistancia(
            lat_entrada, lng_entrada, 
            parseFloat(evento.rows[0].latitude), parseFloat(evento.rows[0].longitude)
        );

        // 3. VERIFICAÇÃO DE FRAUDE: Está fora do raio de 1000 metros?
        if (distancia > 1000) {
            
            // REGISTRO SILENCIOSO: Salva na tabela de fraudes antes de barrar
            await db.query(`
                INSERT INTO log_fraudes 
                (device_key, matricula, evento_id, tipo_tentativa, lat_dispositivo, lng_dispositivo, distancia_calculada_metros, motivo_bloqueio)
                VALUES ($1, $2, $3, 'ENTRADA', $4, $5, $6, 'Fora do raio permitido')
            `, [device_key, matricula, evento_id, lat_entrada, lng_entrada, Math.round(distancia)]);

            // Retorna o erro para o aplicativo, mas a Diretoria já tem o rastro
            return res.status(400).json({ 
                status: 'erro', 
                error: `Bloqueio de Perímetro: Você está fora do raio permitido da formação.` 
            });
        }

        // 4. Se passou, segue o fluxo normal e registra na tabela 'frequencias'
        await db.query(`
            INSERT INTO frequencias (participante_id, evento_id, data_entrada, lat_entrada, lng_entrada, device_key, matricula)
            VALUES ($1, $2, NOW(), $3, $4, $5, $6)
        `, [participante.rows[0].id, evento_id, lat_entrada, lng_entrada, device_key, matricula]);

        return res.json({ status: 'sucesso' });

    } catch (error) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
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
app.get('/api/v2/admin-exclusivo/combos/areas', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM area ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json([]); }
});

app.get('/api/v2/admin-exclusivo/combos/setores', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM setor ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json([]); }
});

app.get('/api/v2/admin-exclusivo/combos/locais', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM locais ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json([]); }
});

app.get('/api/v2/admin-exclusivo/combos/publicos', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM publicoalvo ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json([]); }
});

app.get('/api/v2/admin-exclusivo/listagens/eventos', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, titulo, local, palestrante, data_evento, hora_inicio, hora_fim FROM eventos ORDER BY data_evento DESC, hora_inicio DESC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/locais', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome, endereco, latitude, longitude FROM locais ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/participantes', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome_completo, matricula, ativo FROM participantes ORDER BY nome_completo ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/publico-alvo', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM publicoalvo ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/setores', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM setor ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/areas', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome FROM area ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/usuarios', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome, usuario FROM usuarios WHERE ativo = true ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/log-fraudes', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, matricula, motivo, data_tentativa FROM log_fraudes ORDER BY data_tentativa DESC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/pesquisa-satisfacao', verificarTokenAdminExclusivo, async (req, res) => {
    try {
        return res.json((await pool.query(`
            SELECT ps.id, ps.avaliacao, ps.comentarios, ps.criado_em, 
                   p.nome_completo AS participante_nome, p.matricula AS participante_matricula, 
                   e.titulo AS evento_titulo 
            FROM pesquisa_satisfacao ps 
            LEFT JOIN participantes p ON ps.participante_id = p.id 
            LEFT JOIN eventos e ON ps.evento_id = e.id 
            ORDER BY ps.criado_em DESC
        `)).rows);
    } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/admin-exclusivo/listagens/frequencias', verificarTokenAdminExclusivo, async (req, res) => {
    try {
        return res.json((await pool.query(`
            SELECT f.id, f.matricula, f.tempo_participacao, f.data_entrada, f.data_saida,
                   p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria 
            FROM frequencias f 
            JOIN participantes p ON f.participante_id = p.id 
            JOIN eventos e ON f.evento_id = e.id 
            WHERE f.data_entrada::date = CURRENT_DATE::date
            ORDER BY f.data_entrada DESC
        `)).rows);
    } catch (e) { return res.status(500).json([]); }
});

app.get('/api/v2/admin-exclusivo/relatorio-integrated', verificarTokenAdminExclusivo, async (req, res) => {
    const { data_inicio, data_fim, area_id, setor_id, publico_alvo_id } = req.query;
    try {
        let filtrosSQL = `WHERE e.data_evento BETWEEN $1 AND $2`;
        let parametros = [data_inicio, data_fim];
        let contadorParam = 3;

        if (area_id) { filtrosSQL += ` AND e.area_id = $${contadorParam}`; parametros.push(parseInt(area_id)); contadorParam++; }
        if (setor_id) { filtrosSQL += ` AND (e.setor_id_1 = $${contadorParam} OR e.setor_id_2 = $${contadorParam} OR e.setor_id_3 = $${contadorParam})`; parametros.push(parseInt(setor_id)); contadorParam++; }
        if (publico_alvo_id) { filtrosSQL += ` AND e.publico_alvo_id = $${contadorParam}`; parametros.push(parseInt(publico_alvo_id)); contadorParam++; }

        const resultadoTotais = await pool.query(`SELECT COUNT(DISTINCT e.id) as total_eventos, COUNT(f.id) as total_frequencias FROM eventos e LEFT JOIN frequencias f ON f.evento_id = e.id ${filtrosSQL}`, parametros);
        const resultadoRegistros = await pool.query(`SELECT f.id, f.matricula, f.tempo_participacao, p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria, e.data_evento, f.data_entrada, f.data_saida FROM frequencias f INNER JOIN eventos e ON f.evento_id = e.id INNER JOIN participantes p ON f.participante_id = p.id ${filtrosSQL} ORDER BY e.data_evento DESC, f.data_entrada DESC`, parametros);

        return res.json({ totais: { total_eventos: parseInt(resultadoTotais.rows[0].total_eventos || 0), total_frequencias: parseInt(resultadoTotais.rows[0].total_frequencias || 0) }, registros: resultadoRegistros.rows });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

app.post('/api/v2/admin-exclusivo/frequencias/saida-manual', verificarTokenAdminExclusivo, async (req, res) => {
    const { frequencia_id, hora_saida } = req.body;
    try {
        const resFreq = await pool.query(`SELECT f.*, e.data_evento, e.hora_inicio, e.hora_fim FROM frequencias f JOIN eventos e ON f.evento_id = e.id WHERE f.id = $1`, [frequencia_id]);
        if (resFreq.rows.length === 0) return res.status(404).json({ error: 'Frequência não localizada.' });
        const freq = resFreq.rows[0];

        const dataEventoFormatada = new Date(freq.data_evento).toISOString().split('T')[0];
        const dataHoraEntrada = new Date(freq.data_entrada); 
        const dataHoraSaidaManual = new Date(`${dataEventoFormatada}T${hora_saida}`); 
        const dataHoraInicioOficial = new Date(`${dataEventoFormatada}T${freq.hora_inicio}`);
        const dataHoraFimPrevista = new Date(`${dataEventoFormatada}T${freq.hora_fim}`); 

        if (dataHoraSaidaManual <= dataHoraEntrada) return res.status(400).json({ error: 'A saída não pode ser anterior ou igual à entrada.' });
        if (dataHoraSaidaManual > dataHoraFimPrevista) return res.status(400).json({ error: 'A saída não pode ultrapassar o término oficial.' });

        const entradaParaCalculo = dataHoraEntrada < dataHoraInicioOficial ? dataHoraInicioOficial : dataHoraEntrada;
        const saidaParaCalculo = dataHoraSaidaManual > dataHoraFimPrevista ? dataHoraFimPrevista : dataHoraSaidaManual;

        let tempoFinalFormatado = "00:00";
        if (saidaParaCalculo > entradaParaCalculo) {
            const totalMinutos = Math.floor((saidaParaCalculo - entradaParaCalculo) / (1000 * 60));
            tempoFinalFormatado = `${String(Math.floor(totalMinutos / 60)).padStart(2, '0')}:${String(totalMinutos % 60).padStart(2, '0')}`;
        }

        await pool.query(`UPDATE frequencias SET data_saida = $1, tempo_participacao = $2 WHERE id = $3`, [dataHoraSaidaManual, tempoFinalFormatado, frequencia_id]);
        return res.json({ status: 'sucesso', message: 'Saída manual registrada!', tempo_gravado: tempoFinalFormatado });
    } catch (error) { return res.status(500).json({ error: 'Erro operacional.' }); }
});

app.post('/api/v2/admin-exclusivo/frequencias/atualizar-tempo-esquecimento', verificarTokenAdminExclusivo, async (req, res) => {
    const { frequencia_id } = req.body;
    try {
        const resFreq = await pool.query(`SELECT f.*, e.data_evento, e.hora_inicio, e.hora_fim FROM frequencias f JOIN eventos e ON f.evento_id = e.id WHERE f.id = $1`, [frequencia_id]);
        if (resFreq.rows.length === 0) return res.status(404).json({ error: 'Frequência ausente.' });
        const freq = resFreq.rows[0];

        const dataEventoFormatada = new Date(freq.data_evento).toISOString().split('T')[0];
        const dataHoraEntrada = new Date(freq.data_entrada);
        const dataHoraSaida = new Date(freq.data_saida);
        const dataHoraInicioOficial = new Date(`${dataEventoFormatada}T${freq.hora_inicio}`);
        const dataHoraFimPrevista = new Date(`${dataEventoFormatada}T${freq.hora_fim}`);

        const entradaParaCalculo = dataHoraEntrada < dataHoraInicioOficial ? dataHoraInicioOficial : dataHoraEntrada;
        const saidaParaCalculo = dataHoraSaida > dataHoraFimPrevista ? dataHoraFimPrevista : dataHoraSaida;

        let tempoFinalFormatado = "00:00";
        if (saidaParaCalculo > entradaParaCalculo) {
            const totalMinutos = Math.floor((saidaParaCalculo - entradaParaCalculo) / (1000 * 60));
            tempoFinalFormatado = `${String(Math.floor(totalMinutos / 60)).padStart(2, '0')}:${String(totalMinutos % 60).padStart(2, '0')}`;
        }

        await pool.query('BEGIN');
        await pool.query(`UPDATE frequencias SET tempo_participacao = $1 WHERE id = $2`, [tempoFinalFormatado, frequencia_id]);
        await pool.query(`INSERT INTO log_fraudes (matricula, evento_id, motivo) VALUES ($1, $2, 'ESQUECEU DE LER QR CODE NA SAÍDA')`, [freq.matricula, freq.evento_id]);
        await pool.query('COMMIT');

        return res.json({ status: 'sucesso' });
    } catch (e) { await pool.query('ROLLBACK'); return res.status(500).json({ error: 'Erro ao recalcular.' }); }
});

app.post('/api/v2/admin-exclusivo/locais', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO locais (nome, endereco, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *', [req.body.nome, req.body.endereco, req.body.latitude, req.body.longitude])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.put('/api/v2/admin-exclusivo/locais/:id', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4 WHERE id=$5 RETURNING *', [req.body.nome, req.body.endereco, req.body.latitude, req.body.longitude, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.put('/api/v2/admin-exclusivo/participantes/:id', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('UPDATE participantes SET nome_completo=$1, ativo=$2 WHERE id=$3 RETURNING *', [req.body.nome_completo, req.body.ativo, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.post('/api/v2/admin-exclusivo/publico-alvo', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.put('/api/v2/admin-exclusivo/publico-alvo/:id', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('UPDATE publicoalvo SET nome=$1 WHERE id=$2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.post('/api/v2/admin-exclusivo/setores', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO setor (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.put('/api/v2/admin-exclusivo/setores/:id', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('UPDATE setor SET nome=$1 WHERE id=$2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.post('/api/v2/admin-exclusivo/areas', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO area (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.put('/api/v2/admin-exclusivo/areas/:id', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('UPDATE area SET nome=$1 WHERE id=$2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.post('/api/v2/admin-exclusivo/usuarios', verificarTokenAdminExclusivo, async (req, res) => {
    try { 
        const hash = hashSenha(req.body.senha);
        return res.json((await pool.query('INSERT INTO usuarios (nome, usuario, senha, ativo, deve_alterar_senha) VALUES ($1, $2, $3, true, false) RETURNING id, nome, usuario', [req.body.nome, req.body.usuario, hash])).rows[0]); 
    } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.put('/api/v2/admin-exclusivo/usuarios/:id', verificarTokenAdminExclusivo, async (req, res) => {
    try { return res.json((await pool.query('UPDATE usuarios SET nome=$1, usuario=$2 WHERE id=$3 RETURNING id, nome, usuario', [req.body.nome, req.body.usuario, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

// NOVA ROTA CADASTRO DE EVENTOS - ISOLADA E PROTEGIDA
// NOVA ROTA CADASTRO DE EVENTOS - COM BUSCA AUTOMÁTICA DE DADOS DO LOCAL
app.post('/api/v2/admin-exclusivo/eventos', verificarTokenAdminExclusivo, async (req, res) => {
    const {
        titulo, palestrante, data_evento, hora_inicio, hora_fim, carga_horaria,
        local_id, local, endereco, latitude, longitude,
        setor_id_1, sector_id_2, sector_id_3, area_id, publicos
    } = req.body;

    try {
        const token_qr = uuidv4(); // Gera o token UUID único para o QR Code
        const publico_alvo_id = publicos && publicos.length > 0 ? publicos[0] : null;

        let finalLocal = local;
        let finalEndereco = endereco;
        let finalLat = latitude;
        let finalLng = longitude;

        // ASSOCIAÇÃO AUTOMÁTICA: Busca os dados geográficos direto na tabela 'locais' se o ID existir
        if (local_id) {
            const buscaLocal = await pool.query('SELECT nome, endereco, latitude, longitude FROM locais WHERE id = $1', [parseInt(local_id)]);
            if (buscaLocal.rows.length > 0) {
                const dadosDoLocal = buscaLocal.rows[0];
                finalLocal = dadosDoLocal.nome;
                finalEndereco = dadosDoLocal.endereco;
                finalLat = dadosDoLocal.latitude;
                finalLng = dadosDoLocal.longitude;
            }
        }

        await pool.query('BEGIN');

        // Insere na tabela principal 'eventos' com os dados consolidados do local
        const queryEvento = `
            INSERT INTO eventos (
                titulo, palestrante, data_evento, hora_inicio, hora_fim, carga_horaria,
                local_id, local, endereco, latitude, longitude,
                setor_id_1, setor_id_2, setor_id_3, area_id, publico_alvo_id, token_qr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id
        `;

        const valoresEvento = [
            titulo, palestrante, data_evento, hora_inicio, hora_fim, parseFloat(carga_horaria),
            local_id ? parseInt(local_id) : null, finalLocal, finalEndereco, 
            finalLat ? parseFloat(finalLat) : null, finalLng ? parseFloat(finalLng) : null,
            req.body.setor_id_1 ? parseInt(req.body.setor_id_1) : null, 
            req.body.setor_id_2 ? parseInt(req.body.setor_id_2) : null, 
            req.body.setor_id_3 ? parseInt(req.body.setor_id_3) : null, 
            area_id ? parseInt(area_id) : null,
            publico_alvo_id, token_qr
        ];

        const resultadoEvento = await pool.query(queryEvento, valoresEvento);
        const novoEventoId = resultadoEvento.rows[0].id;

        // Vincula os múltiplos públicos-alvo na tabela intermediária 'evento_publicos'
        if (publicos && Array.isArray(publicos)) {
            for (const pId of publicos) {
                await pool.query(
                    'INSERT INTO evento_publicos (evento_id, publico_alvo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [novoEventoId, parseInt(pId)]
                );
            }
        }

        await pool.query('COMMIT');
        return res.json({ success: true, id: novoEventoId, token_qr });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Erro ao cadastrar evento:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar o evento no banco de dados.' });
    }
});

app.post('/api/v2/dispositivos/vincular', async (req, res) => {
    const { device_key, nome, matricula } = req.body;

    if (!device_key || !nome || !matricula) {
        return res.status(400).json({ error: 'Dados insuficientes para realizar o vínculo.' });
    }

    try {
        await pool.query('BEGIN');

        let resPart = await pool.query('SELECT id FROM participantes WHERE matricula = $1', [matricula]);
        let participanteId;

        if (resPart.rows.length === 0) {
            const novoPart = await pool.query(
                'INSERT INTO participantes (nome, matricula, device_key) VALUES ($1, $2, $3) RETURNING id',
                [nome, matricula, device_key]
            );
            participanteId = novoPart.rows[0].id;
        } else {
            participanteId = resPart.rows[0].id;
            await pool.query(
                'UPDATE participantes SET nome = $1, device_key = $2 WHERE id = $3',
                [nome, device_key, participanteId]
            );
        }

        await pool.query('UPDATE dispositivos SET ativo = false WHERE participante_id = $1', [participanteId]);

        await pool.query(
            'INSERT INTO dispositivos (device_token, participante_id, ativo) VALUES ($1, $2, true)',
            [device_key, participanteId]
        );

        await pool.query('COMMIT');

        return res.json({ status: 'sucesso', message: 'Aparelho vinculado com sucesso.' });

    } catch (error) {
        await pool.query('ROLLBACK');
        return res.status(500).json({ error: 'Erro interno ao vincular o dispositivo.' });
    }
});

// ==========================================
// ROTAS EXCLUSIVAS: NOVO PORTAL DE PRESENÇA QRCODE
// ==========================================

// 1. Inicialização do Portal Isolada
app.post('/api/v2/qrcode-presenca/inicializar', async (req, res) => {
    const { device_token, device_key } = req.body;
    const tokenEfetivo = device_token || device_key;

    try {
        const resEventos = await pool.query(`
            SELECT e.id, e.titulo, e.local, e.palestrante, e.hora_inicio, e.hora_fim, 
                   l.nome as local_nome, l.endereco as local_endereco, 
                   COALESCE(l.latitude, e.latitude) as latitude, COALESCE(l.longitude, e.longitude) as longitude 
            FROM eventos e 
            LEFT JOIN locais l ON e.local_id = l.id 
            WHERE e.data_evento = CURRENT_DATE::date AND e.hora_fim >= CURRENT_TIME 
            ORDER BY e.hora_inicio ASC
        `);

        const listaEventosFormatada = resEventos.rows.map(e => ({ 
            id: e.id, 
            titulo: e.titulo, 
            palestrante: e.palestrante || '', 
            local: e.local_nome || e.local || 'Auditório', 
            endereco: e.local_endereco || e.endereco || '', 
            latitude: e.latitude, 
            longitude: e.longitude, 
            hora_inicio: e.hora_inicio, 
            hora_fim: e.hora_fim 
        }));

        if (listaEventosFormatada.length === 0) {
            return res.status(404).json({ status: 'erro', situacao: 'sem_evento', eventos: [] });
        }

        if (!tokenEfetivo) {
            return res.json({ status: 'sucesso', situacao: 'nao_vinculado', eventos: listaEventosFormatada });
        }

        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);

        if (resDisp.rows.length === 0) {
            return res.json({ status: 'sucesso', situacao: 'nao_vinculado', eventos: listaEventosFormatada });
        }

        const disp = resDisp.rows[0];

        const resSaidaPendenteAntiga = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND data_entrada::date < CURRENT_DATE::date AND data_saida IS NULL 
            LIMIT 1
        `, [disp.participante_id]);

        if (resSaidaPendenteAntiga.rows.length > 0) {
            return res.json({ status: 'sucesso', situacao: 'bloqueado_saida_estourada', eventos: listaEventosFormatada });
        }

        const freqAtiva = await pool.query(`
            SELECT * FROM frequencias 
            WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL 
            LIMIT 1
        `, [disp.participante_id]);

        return res.json({
            status: 'sucesso', 
            situacao: 'regular',
            tem_evento_ativo: freqAtiva.rows.length > 0, 
            evento_ativo_id: freqAtiva.rows.length > 0 ? freqAtiva.rows[0].evento_id : null,
            eventos: listaEventosFormatada
        });
    } catch (error) { 
        return res.status(500).json({ error: 'Erro interno ao inicializar o Portal.' }); 
    }
});

// 2. Auto-vínculo Isolado de Dispositivo
// 2. Auto-vínculo Isolado de Dispositivo (REVISADO E BLINDADO)
app.post('/api/v2/qrcode-presenca/vincular', async (req, res) => {
    const { device_key, nome, matricula } = req.body;

    if (!device_key || !nome || !matricula) {
        return res.status(400).json({ error: 'Dados insuficientes para realizar o vínculo.' });
    }

    try {
        await pool.query('BEGIN');

        // 1. Verifica se o participante já existe pela matrícula
        let resPart = await pool.query('SELECT id FROM participantes WHERE matricula = $1', [matricula]);
        let participanteId;

        if (resPart.rows.length === 0) {
            // Se o banco foi limpo, cria o participante primeiro (Garante o ID para a chave estrangeira)
            const novoPart = await pool.query(
                'INSERT INTO participantes (nome, matricula, device_key) VALUES ($1, $2, $3) RETURNING id',
                [nome, matricula, device_key]
            );
            participanteId = novoPart.rows[0].id;
        } else {
            // Se já existia, atualiza os dados dele
            participanteId = resPart.rows[0].id;
            await pool.query(
                'UPDATE participantes SET nome = $1, device_key = $2 WHERE id = $3',
                [nome, device_key, participanteId]
            );
        }

        // 2. Desativa quaisquer tokens/dispositivos antigos vinculados a este participante id
        await pool.query('UPDATE dispositivos SET ativo = false WHERE participante_id = $1', [participanteId]);

        // 3. Insere o novo dispositivo garantindo o id válido do participante
        await pool.query(
            'INSERT INTO dispositivos (device_token, participante_id, ativo) VALUES ($1, $2, true)',
            [device_key, participanteId]
        );

        await pool.query('COMMIT');
        return res.json({ status: 'sucesso', message: 'Aparelho vinculado com sucesso.' });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("ERRO NO VINCULO:", error.message); // Imprime o erro exato no terminal do seu servidor
        return res.status(500).json({ error: 'Erro interno ao vincular o dispositivo no banco.' });
    }
});

// ==========================================
// PORTAL QRCODE - ENTRADA COM VERIFICAÇÃO DE RAIO E LOG SILENCIOSO
// ==========================================
// ==========================================
// PORTAL QRCODE - ENTRADA COM VERIFICAÇÃO DE RAIO E LOG SILENCIOSO
// ==========================================
// ==========================================
// PORTAL QRCODE - ENTRADA COM VERIFICAÇÃO DE RAIO E LOG SILENCIOSO
// ==========================================
app.post('/api/v2/qrcode-presenca/registrar-entrada', async (req, res) => {
    const { device_key, device_token, evento_id, lat_entrada, lng_entrada, lat, lng, latitude, longitude } = req.body;
    const tokenEfetivo = device_key || device_token;
    const latEfetiva = lat_entrada || lat || latitude;
    const lngEfetiva = lng_entrada || lng || longitude; // <--- CORRIGIDO AQUI!

    try {
        if (!tokenEfetivo) return res.status(400).json({ error: 'Identificação ausente.' });
        
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo não homologado. Por favor, refaça o vínculo do aparelho.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query(`
            SELECT e.*, COALESCE(l.latitude, e.latitude) as lat_real, COALESCE(l.longitude, e.longitude) as lng_real 
            FROM eventos e 
            LEFT JOIN locais l ON e.local_id = l.id 
            WHERE e.id = $1
        `, [evento_id]);
        
        if (resEv.rows.length > 0) {
            const ev = resEv.rows[0];
            
            const calcularDistanciaLocal = (lat1, lon1, lat2, lon2) => {
                const R = 6371000;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
            };

            const distancia = calcularDistanciaLocal(
                parseFloat(latEfetiva), parseFloat(lngEfetiva),
                parseFloat(ev.lat_real), parseFloat(ev.lng_real)
            );

            if (distancia > 1000 || isNaN(distancia)) {
                await pool.query(`
                    INSERT INTO log_fraudes (device_key, matricula, evento_id, tipo_tentativa, lat_tentativa, lng_tentativa, distancia_calculada_metros, motivo) 
                    VALUES ($1, $2, $3, 'ENTRADA', $4, $5, $6, 'Fora do raio permitido')
                `, [tokenEfetivo, disp.participante_matricula, evento_id, parseFloat(latEfetiva), parseFloat(lngEfetiva), Math.round(distancia || 0)]);

                return res.status(400).json({ error: 'Bloqueio de Perímetro: Você está fora do raio permitido da escola.' });
            }
        }

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

// ==========================================
// PORTAL QRCODE - SAÍDA COM VERIFICAÇÃO DE RAIO E LOG SILENCIOSO
// ==========================================
app.post('/api/v2/qrcode-presenca/registrar-saida', async (req, res) => {
    const { device_token, device_key, evento_id, estrelas, comentario, lat, lng, latitude, longitude, avaliacao, comentarios } = req.body;
    const tokenEfetivo = device_token || device_key;
    const latEfetiva = lat || latitude;
    const lngEfetiva = lng || longitude;
    const textoComentario = comentario || comentarios || '';
    const notaEstrelas = estrelas || (avaliacao === 'Ótimo' ? 5 : avaliacao === 'Muito Bom' ? 4 : avaliacao === 'Bom' ? 3 : avaliacao === 'Regular' ? 2 : 1);
    
    try {
        if (!tokenEfetivo) return res.status(400).json({ error: 'Identificação ausente.' });

        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenEfetivo]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const ev = (await pool.query('SELECT data_evento, hora_inicio, hora_fim, publico_alvo_id, latitude, longitude, local_id FROM eventos WHERE id = $1', [evento_id])).rows[0];
        
        // --- INÍCIO DA VALIDAÇÃO DE DISTÂNCIA E LOG DE FRAUDE NA SAÍDA ---
        const resLocal = await pool.query('SELECT latitude, longitude FROM locais WHERE id = $1', [ev.local_id]);
        const latRealEv = resLocal.rows[0]?.latitude || ev.latitude;
        const lngRealEv = resLocal.rows[0]?.longitude || ev.longitude;

        const calcularDistanciaLocal = (lat1, lon1, lat2, lon2) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        const distancia = calcularDistanciaLocal(
            parseFloat(latEfetiva), parseFloat(lngEfetiva),
            parseFloat(latRealEv), parseFloat(lngRealEv)
        );

        if (distancia > 1000 || isNaN(distancia)) {
            await pool.query(`
                INSERT INTO log_fraudes (device_key, matricula, evento_id, tipo_tentativa, lat_tentativa, lng_tentativa, distancia_calculada_metros, motivo) 
                VALUES ($1, $2, $3, 'SAIDA', $4, $5, $6, 'Fora do raio permitido')
            `, [tokenEfetivo, disp.participante_matricula, evento_id, parseFloat(latEfetiva), parseFloat(lngEfetiva), Math.round(distancia || 0)]);

            return res.status(400).json({ error: 'Bloqueio de Perímetro: Você está fora do raio permitido para encerrar.' });
        }
        // --- FIM DA VALIDAÇÃO DE DISTÂNCIA ---

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

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.listen(PORT, () => console.log(`Servidor ativado na porta ${PORT}`));