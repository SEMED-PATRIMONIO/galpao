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
        // Criar tabela setor se não existir
        await pool.query(`
            CREATE TABLE IF NOT EXISTS setor (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                ativo BOOLEAN DEFAULT true
            );
        `);

        // NOVO: Criar tabela area se não existir
        await pool.query(`
            CREATE TABLE IF NOT EXISTS area (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                ativo BOOLEAN DEFAULT true
            );
        `);
        
        // Adicionar colunas de setores e área em eventos se não existirem
        await pool.query(`
            ALTER TABLE eventos 
            ADD COLUMN IF NOT EXISTS setor_id_1 INTEGER REFERENCES setor(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS setor_id_2 INTEGER REFERENCES setor(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS setor_id_3 INTEGER REFERENCES setor(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES area(id) ON DELETE SET NULL;
        `);

        // Tabela associativa para múltiplos públicos-alvo por evento
        await pool.query(`
            CREATE TABLE IF NOT EXISTS evento_publicos (
                evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
                publico_alvo_id INTEGER REFERENCES publicoalvo(id) ON DELETE CASCADE,
                PRIMARY KEY (evento_id, publico_alvo_id)
            );
        `);

        // Adicionar coluna de tempo_participacao em frequencias se não existir
        await pool.query(`
            ALTER TABLE frequencias 
            ADD COLUMN IF NOT EXISTS tempo_participacao VARCHAR(10);
        `);

        // Adicionar colunas de logs adicionais em log_fraudes caso não existam
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
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
        if (user.senha !== senha) return res.status(401).json({ error: 'Credenciais inválidas.' });
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
// ROTAS DE GERENCIAMENTO DE DISPOSITIVOS
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
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno.' });
    }
});

app.post('/api/v2/dispositivo/associar', async (req, res) => {
    const { matricula, nome, device_token, token } = req.body;
    try {
        const tokenDispositivo = device_token || token || uuidv4();
        const resVerif = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [tokenDispositivo]);
        if (resVerif.rows.length > 0) {
            const vinculo = resVerif.rows[0];
            const partDono = await pool.query('SELECT * FROM participantes WHERE id = $1', [vinculo.participante_id]);
            if (partDono.rows.length > 0 && partDono.rows[0].matricula !== matricula) {
                return res.status(400).json({ error: 'Este dispositivo já está associado a outro participante.' });
            }
        }
        let resPart = await pool.query('SELECT * FROM participantes WHERE matricula = $1', [matricula]);
        let participanteId;
        if (resPart.rows.length === 0) {
            const novoPart = await pool.query('INSERT INTO participantes (nome_completo, matricula, ativo) VALUES ($1, $2, true) RETURNING id', [nome, matricula]);
            participanteId = novoPart.rows[0].id;
        } else {
            participanteId = resPart.rows[0].id;
        }
        await pool.query(`
            INSERT INTO dispositivos (device_token, participante_id, participante_matricula, ativo) 
            VALUES ($1, $2, $3, true) 
            ON CONFLICT (device_token) DO UPDATE SET participante_id = $2, participante_matricula = $3, ativo = true
        `, [tokenDispositivo, participanteId, matricula]);
        const partFinal = await pool.query('SELECT * FROM participantes WHERE id = $1', [participanteId]);
        return res.json({ device_token: tokenDispositivo, token: tokenDispositivo, participante: partFinal.rows[0] });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno ao associar dispositivo.' });
    }
});

app.post('/api/v2/presenca/inicializar', async (req, res) => {
    const { device_token } = req.body;
    try {
        if (!device_token) return res.status(400).json({ error: 'Identificação ausente.' });
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Aparelho não associado ou desativado.' });
        const disp = resDisp.rows[0];

        const resEventos = await pool.query(`
            SELECT e.id, e.titulo, e.local, e.palestrante, e.hora_inicio, e.hora_fim,
                   l.nome as local_nome, l.endereco as local_endereco,
                   COALESCE(l.latitude, e.latitude) as latitude, COALESCE(l.longitude, e.longitude) as longitude
            FROM eventos e LEFT JOIN locais l ON e.local_id = l.id
            WHERE e.data_evento = CURRENT_DATE::date AND e.hora_fim >= CURRENT_TIME ORDER BY e.hora_inicio ASC
        `);
        const freqAtiva = await pool.query(`SELECT * FROM frequencias WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL LIMIT 1`, [disp.participante_id]);
        return res.json({
            status: 'sucesso',
            tem_evento_ativo: freqAtiva.rows.length > 0,
            evento_ativo_id: freqAtiva.rows.length > 0 ? freqAtiva.rows[0].evento_id : null,
            eventos: resEventos.rows.map(e => ({
                id: e.id, titulo: e.titulo, palestrante: e.palestrante || '', local: e.local_nome || e.local || 'Auditório',
                endereco: e.local_endereco || e.endereco || '', latitude: e.latitude, longitude: e.longitude, hora_inicio: e.hora_inicio, hora_fim: e.hora_fim
            }))
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno ao inicializar o Portal.' });
    }
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

        const dist = calcularDistancia(latitude, longitude, parseFloat(ev.lat_real), parseFloat(ev.lng_real));
        if (dist > 1000) {
            
            await pool.query(`INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa) VALUES ($1, $2, 'FORA_DO_RAIO_PERMITIDO', $3, $4)`, [disp.participante_matricula, evento_id, latitude, longitude]);
            return res.status(400).json({ error: 'Bloqueio de Segurança: Você está fora do raio permitido do local.' });
        }

        const resFreq = await pool.query(`
            SELECT *, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - data_entrada))/60 as minutos_decorridos
            FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_entrada::date = CURRENT_DATE::date
        `, [disp.participante_id, evento_id]);

        if (resFreq.rows.length > 0) {
            const freq = resFreq.rows[0];
            if (freq.data_saida !== null) return res.json({ status: 'completo' });
            
            if (freq.minutos_decorridos < 30) {
                return res.json({ status: 'somente_entrada', exibir_aviso_precoce: true, minutos: Math.ceil(freq.minutos_decorridos) });
            }
            return res.json({ status: 'somente_entrada' });
        }

        const outroAtivo = await pool.query(`SELECT id FROM frequencias WHERE participante_id = $1 AND data_entrada::date = CURRENT_DATE::date AND data_saida IS NULL`, [disp.participante_id]);
        if (outroAtivo.rows.length > 0) return res.status(400).json({ error: 'Você já possui uma frequência em andamento.' });

        return res.json({ status: 'nenhum' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao analisar status de presença.' });
    }
});

app.post('/api/v2/presenca/confirmar-entrada', async (req, res) => {
    const { device_token, evento_id, latitude, longitude } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        await pool.query(`
            INSERT INTO frequencias (participante_id, evento_id, lat_entrada, lng_entrada, device_key, matricula, funcao, data_entrada)
            VALUES ($1, $2, $3, $4, $5, $6, 'Ouvinte', CURRENT_TIMESTAMP)
        `, [disp.participante_id, evento_id, String(latitude), String(longitude), device_token, disp.participante_matricula]);

        return res.json({ status: 'sucesso' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro interno ao salvar frequência.' });
    }
});

app.post('/api/v2/presenca/confirmar-saida', async (req, res) => {
    const { device_token, evento_id, estrelas, comentario, latitude, longitude, confirmou_saida_precoce } = req.body;
    try {
        const resDisp = await pool.query('SELECT * FROM dispositivos WHERE device_token = $1 AND ativo = true', [device_token]);
        if (resDisp.rows.length === 0) return res.status(401).json({ error: 'Dispositivo inválido.' });
        const disp = resDisp.rows[0];

        const resEv = await pool.query('SELECT data_evento, hora_inicio, hora_fim, publico_alvo_id FROM eventos WHERE id = $1', [evento_id]);
        const ev = resEv.rows[0];

        let avaliacaoTexto = 'Muito Bom';
        if (estrelas === 4) avaliacaoTexto = 'Bom';
        if (estrelas === 3) avaliacaoTexto = 'Regular';
        if (estrelas === 2) avaliacaoTexto = 'Ruim';
        if (estrelas === 1) avaliacaoTexto = 'Péssimo';

        const agoraTexto = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" });
        const dataHoraReal = new Date(agoraTexto);

        const dataEventoFormatada = new Date(ev.data_evento).toISOString().split('T')[0];
        const dataHoraInicioOficial = new Date(`${dataEventoFormatada}T${ev.hora_inicio}`);
        const dataHoraTerminoOficial = new Date(`${dataEventoFormatada}T${ev.hora_fim}`);

        const resFreq = await pool.query(`SELECT data_entrada FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL`, [disp.participante_id, evento_id]);
        if (resFreq.rows.length === 0) return res.status(400).json({ error: 'Registro de entrada ativa não localizado.' });
        
        const dataEntradaReal = new Date(resFreq.rows[0].data_entrada);
        const minutosPermanencia = (dataHoraReal - dataEntradaReal) / (1000 * 60);

        if (minutosPermanencia < 30) {
            if (!confirmou_saida_precoce) return res.status(400).json({ error: 'Aviso de Permanência Mínima Requerido.' });
            await pool.query(`INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa, data_tentativa) VALUES ($1, $2, 'PERMANENCIA_MENOR_30_MIN', $3, $4, $5)`, [disp.participante_matricula, evento_id, String(latitude), String(longitude), dataHoraReal]);
        }

        const minutosAtraso = (dataHoraReal - dataHoraTerminoOficial) / (1000 * 60);
        let dataSaidaGravar = minutosAtraso < 0 ? dataHoraReal : dataHoraTerminoOficial;

        if (minutosAtraso > 40) {
            await pool.query(`INSERT INTO log_fraudes (matricula, evento_id, motivo, lat_tentativa, lng_tentativa, data_tentativa) VALUES ($1, $2, 'SAIDA_APOS_40_MIN_DO_FIM', $3, $4, $5)`, [disp.participante_matricula, evento_id, String(latitude), String(longitude), dataHoraReal]);
        }

        let tempoFinalFormatado = "00:00";
        if (minutosPermanencia >= 30) {
            const inicioCalculo = dataEntradaReal < dataHoraInicioOficial ? dataHoraInicioOficial : dataEntradaReal;
            const fimCalculo = dataHoraReal > dataHoraTerminoOficial ? dataHoraTerminoOficial : dataHoraReal;
            
            let deltaMilissegundos = fimCalculo - inicioCalculo;
            if (deltaMilissegundos > 0) {
                const totalMinutosCalculados = Math.floor(deltaMilissegundos / (1000 * 60));
                tempoFinalFormatado = `${String(Math.floor(totalMinutosCalculados / 60)).padStart(2, '0')}:${String(totalMinutosCalculados % 60).padStart(2, '0')}`;
            }
        }

        await pool.query('BEGIN');
        await pool.query(`UPDATE frequencias SET data_saida = $1, avaliacao = $2, lat_saida = $3, lng_saida = $4, tempo_participacao = $5 WHERE participante_id = $6 AND evento_id = $7 AND data_saida IS NULL`, [dataSaidaGravar, avaliacaoTexto, String(latitude), String(longitude), tempoFinalFormatado, disp.participante_id, evento_id]);

        const jaAvaliou = await pool.query(`SELECT id FROM pesquisa_satisfacao WHERE participante_id = $1 AND evento_id = $2`, [disp.participante_id, evento_id]);
        if (jaAvaliou.rows.length === 0) {
            await pool.query(`INSERT INTO pesquisa_satisfacao (participante_id, evento_id, publico_alvo_id, avaliacao, comentarios, criado_em) VALUES ($1, $2, $3, $4, $5, $6)`, [disp.participante_id, evento_id, ev.publico_alvo_id, avaliacaoTexto, comentario || '', dataHoraReal]);
        }

        await pool.query('COMMIT');
        return res.json({ status: 'sucesso', tempo_gravado: tempoFinalFormatado });
    } catch (error) {
        await pool.query('ROLLBACK');
        return res.status(500).json({ error: 'Erro interno ao processar saída.' });
    }
});

app.get('/api/v2/eventos', async (req, res) => {
    try { return res.json((await pool.query(`SELECT id, titulo, local, palestrante, latitude, longitude, hora_inicio, hora_fim, data_evento FROM eventos WHERE data_evento = CURRENT_DATE ORDER BY hora_inicio ASC`)).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

// ==========================================
// POST & PUT: CADASTRO COMPLETO DE EVENTOS (SETORIZADO, MÚLTIPLOS PÚBLICOS E ÁREA)
// ==========================================
app.post('/api/v2/eventos', verificarToken, async (req, res) => {
    const { titulo, area_id, data_evento, carga_horaria, local_id, publicos_alvo_ids, setores_ids, hora_inicio, hora_fim, palestrante } = req.body;
    try {
        if (!local_id || !data_evento || !hora_inicio || !hora_fim) return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });

        const h_ini_limpa = hora_inicio.slice(0, 5); const h_fim_limpa = hora_fim.slice(0, 5);
        const dadosLocal = (await pool.query('SELECT nome, endereco, latitude, longitude FROM locais WHERE id = $1', [parseInt(local_id)])).rows[0];
        
        const s1 = setores_ids && setores_ids[0] ? parseInt(setores_ids[0]) : null;
        const s2 = setores_ids && setores_ids[1] ? parseInt(setores_ids[1]) : null;
        const s3 = setores_ids && setores_ids[2] ? parseInt(setores_ids[2]) : null;
        const p_id_retrocompativel = publicos_alvo_ids && publicos_alvo_ids[0] ? parseInt(publicos_alvo_ids[0]) : null;

        const result = await pool.query(`
            INSERT INTO eventos 
            (titulo, data_evento, carga_horaria, local_id, publico_alvo_id, hora_inicio, hora_fim, palestrante, local, endereco, latitude, longitude, setor_id_1, setor_id_2, setor_id_3, area_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id
        `, [titulo, data_evento, parseFloat(carga_horaria || 0), parseInt(local_id), p_id_retrocompativel, h_ini_limpa, h_fim_limpa, palestrante || '', dadosLocal.nome || '', dadosLocal.endereco || '', parseFloat(dadosLocal.latitude), parseFloat(dadosLocal.longitude), s1, s2, s3, area_id ? parseInt(area_id) : null]);

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

        await pool.query(`
            UPDATE eventos 
            SET titulo=$1, data_evento=$2, carga_horaria=$3, local_id=$4, publico_alvo_id=$5, 
                hora_inicio=$6, hora_fim=$7, palestrante=$8, local=$9, endereco=$10, latitude=$11, longitude=$12,
                setor_id_1=$13, setor_id_2=$14, setor_id_3=$15, area_id=$16 WHERE id=$17`, 
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
// CRUD COMPLETO: SETOR & ÁREA (MODALIDADE)
// ==========================================
app.get('/api/v2/setor', async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM setor ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.post('/api/v2/setor', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO setor (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.put('/api/v2/setor/:id', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('UPDATE setor SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.delete('/api/v2/setor/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM setor WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

// NOVO: Endpoints CRUD para Área
app.get('/api/v2/area', async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM area ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.post('/api/v2/area', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO area (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.put('/api/v2/area/:id', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('UPDATE area SET nome = $1 WHERE id = $2 RETURNING *', [req.body.nome, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.delete('/api/v2/area/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM area WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

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

app.get('/api/v2/participantes', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM participantes ORDER BY nome_completo ASC')).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.put('/api/v2/participantes/:id', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('UPDATE participantes SET nome_completo=$1, ativo=$2 WHERE id=$3 RETURNING *', [req.body.nome_completo, req.body.ativo, req.params.id])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.get('/api/v2/frequencias', verificarToken, async (req, res) => {
    try { return res.json((await pool.query(`SELECT f.*, p.nome_completo as participante_nome, p.matricula, e.titulo as evento_titulo FROM frequencias f JOIN participantes p ON f.participante_id = p.id JOIN eventos e ON f.evento_id = e.id ORDER BY f.data_entrada DESC`)).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.get('/api/v2/log-fraudes', verificarToken, async (req, res) => {
    try { return res.json((await pool.query(`SELECT lf.*, e.titulo as evento_titulo FROM log_fraudes lf LEFT JOIN eventos e ON lf.evento_id = e.id ORDER BY lf.data_tentativa DESC`)).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.get('/api/v2/publico-alvo', async (req, res) => {
    try { return res.json((await pool.query('SELECT * FROM publicoalvo ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.post('/api/v2/publico-alvo', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO publicoalvo (nome, ativo) VALUES ($1, true) RETURNING *', [req.body.nome])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.delete('/api/v2/publico-alvo/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM publicoalvo WHERE id = $1', [req.params.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.get('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('SELECT id, nome, usuario, ativo, deve_alterar_senha FROM usuarios ORDER BY nome ASC')).rows); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.post('/api/v2/usuarios', verificarToken, async (req, res) => {
    try { return res.json((await pool.query('INSERT INTO usuarios (nome, usuario, senha, ativo, deve_alterar_senha) VALUES ($1, $2, $3, true, true) RETURNING id, nome, usuario, ativo', [req.body.nome, req.body.usuario, hashSenha(req.body.senha)])).rows[0]); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});
app.put('/api/v2/usuarios/alterar-propria-senha', verificarToken, async (req, res) => {
    try { await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hashSenha(req.body.novaSenha), req.user.id]); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Erro.' }); }
});

app.delete('/api/v2/admin/log-fraudes/:id', verificarToken, async (req, res) => {
    try { await pool.query('DELETE FROM log_fraudes WHERE id = $1', [req.params.id]); return res.json({ status: 'sucesso' }); } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.put('/api/v2/admin/frequencias/:id', verificarToken, async (req, res) => {
    try { await pool.query(`UPDATE frequencias SET data_entrada = $1, data_saida = $2 WHERE id = $3`, [req.body.data_entrada, req.body.data_saida || null, req.params.id]); return res.json({ status: 'sucesso' }); } catch (e) { return res.status(500).json({ error: e.message }); }
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
    const { data_inicio, data_fim } = req.query;
    try {
        const totalEventos = await pool.query("SELECT COUNT(id) as qtd, COALESCE(SUM(carga_horaria), 0) as horas FROM eventos WHERE data_evento BETWEEN $1 AND $2", [data_inicio, data_fim]);
        const totalParticipacoes = await pool.query("SELECT COUNT(id) as qtd FROM frequencias WHERE DATE(data_entrada) BETWEEN $1 AND $2", [data_inicio, data_fim]);
        const mediaSatisfacao = await pool.query(`SELECT AVG(CASE WHEN avaliacao = 'Muito Bom' THEN 5 WHEN avaliacao = 'Bom' THEN 4 WHEN avaliacao = 'Regular' THEN 3 WHEN avaliacao = 'Ruim' THEN 2 WHEN avaliacao = 'Péssimo' THEN 1 ELSE 0 END) as media FROM pesquisa_satisfacao WHERE DATE(criado_em) BETWEEN $1 AND $2`, [data_inicio, data_fim]);
        const registros = await pool.query(`SELECT f.id, f.matricula, f.tempo_participacao, p.nome_completo as participante_nome, e.titulo as evento_titulo, e.carga_horaria, f.data_entrada, f.data_saida FROM frequencias f LEFT JOIN participantes p ON f.participante_id = p.id LEFT JOIN eventos e ON f.evento_id = e.id WHERE DATE(f.data_entrada) BETWEEN $1 AND $2 ORDER BY f.data_entrada DESC`, [data_inicio, data_fim]);
        return res.json({
            totais: { total_eventos: parseInt(totalEventos.rows[0].qtd), soma_horas: parseFloat(totalEventos.rows[0].horas).toFixed(2), total_participacoes: parseInt(totalParticipacoes.rows[0].qtd), nota_media: parseFloat(mediaSatisfacao.rows[0].media || 0).toFixed(1) },
            registros: registros.rows
        });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Erro crítico interno.' }));

app.listen(PORT, () => console.log(`Servidor ativado na porta ${PORT}`));