const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const app = express();

app.use(cors());
app.use(express.json());

// --- ADMIN: CRUD PROFESSORES ---
app.get('/api/admin/professores', async (req, res) => {
  const r = await pool.query("SELECT * FROM participantes ORDER BY nome_completo ASC");
  res.json(r.rows);
});

app.post('/api/admin/professores', async (req, res) => {
  const { nome_completo, matricula, ativo } = req.body;
  await pool.query(
    "INSERT INTO participantes (nome_completo, matricula, ativo) VALUES ($1, $2, $3) ON CONFLICT (matricula) DO UPDATE SET nome_completo = $1, ativo = $3",
    [nome_completo, matricula, ativo]
  );
  res.json({ success: true });
});

// --- ADMIN: EVENTOS E QR CODE ---
app.post('/api/admin/eventos', async (req, res) => {
    const { titulo, data_evento, carga_horaria, local_id, hora_inicio, hora_fim } = req.body;
    try {
        await pool.query(
            "INSERT INTO eventos (titulo, data_evento, carga_horaria, local_id, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4, $5, $6)", 
            [titulo, data_evento, carga_horaria, local_id, hora_inicio || null, hora_fim || null]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PROFESSOR: ENTRADA/SAÍDA VIA QR ---
app.post('/api/registrar-check', async (req, res) => {
    const { matricula, token_qr, lat, lng, device_key } = req.body;

    try {
        // 1. Busca o evento e sua localização real
        const ev = await pool.query("SELECT * FROM eventos WHERE token_qr = $1", [token_qr]);
        if (ev.rows.length === 0) return res.status(404).json({ error: "QR Code Inválido." });
        const evento = ev.rows[0];

        // 2. VALIDAÇÃO 1: Geofencing (Tolerância de 60 metros)
        const distancia = getDistancia(lat, lng, evento.latitude, evento.longitude);
        if (distancia > 60) {
            await pool.query(
                "INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, distancia_calculada, motivo) VALUES ($1, $2, $3, $4, $5, $6)",
                [matricula, evento.id, lat, lng, distancia, 'FORA_DO_RAIO']
            );
            return res.status(403).json({ error: `Fraude Detectada: Você está a ${distancia.toFixed(0)}m do local. O limite é 60m.` });
        }

        // 3. VALIDAÇÃO 2: Trava de Aparelho (30 minutos)
        const trava = await pool.query(
            "SELECT id FROM frequencias WHERE device_key = $1 AND (data_entrada > NOW() - INTERVAL '30 minutes' OR data_saida > NOW() - INTERVAL '30 minutes') LIMIT 1",
            [device_key]
        );
        if (trava.rows.length > 0) {
            await pool.query(
                "INSERT INTO log_fraudes (matricula, evento_id, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, $4, $5)",
                [matricula, evento.id, lat, lng, 'DISPOSITIVO_BLOQUEADO_30MIN']
            );
            return res.status(403).json({ error: "Bloqueio de segurança: Este aparelho já registrou uma presença nos últimos 30 minutos." });
        }

        // 4. Registro de Entrada ou Saída
        const checkOpen = await pool.query(
            "SELECT id FROM frequencias WHERE matricula = $1 AND evento_id = $2 AND data_saida IS NULL",
            [matricula, evento.id]
        );

        if (checkOpen.rows.length > 0) {
            await pool.query("UPDATE frequencias SET data_saida = NOW() WHERE id = $1", [checkOpen.rows[0].id]);
            res.json({ message: "SAÍDA REGISTRADA" });
        } else {
            await pool.query(
                "INSERT INTO frequencias (matricula, evento_id, data_entrada, device_key) VALUES ($1, $2, NOW(), $3)",
                [matricula, evento.id, device_key]
            );
            res.json({ message: "ENTRADA REGISTRADA" });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- RELATÓRIOS ---
app.get('/api/admin/relatorio-geral', async (req, res) => {
  const sql = `
    SELECT f.*, p.nome_completo, p.matricula, e.titulo, e.carga_horaria,
    EXTRACT(EPOCH FROM (f.data_saida - f.data_entrada))/3600 as permanencia_horas
    FROM frequencias f
    JOIN participantes p ON f.participante_id = p.id
    JOIN eventos e ON f.evento_id = e.id
    ORDER BY f.data_entrada DESC`;
  const result = await pool.query(sql);
  res.json(result.rows);
});

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raio da Terra em metros
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raio da Terra em metros
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// NOVO: Relatório de Eventos por Período
app.get('/api/admin/relatorio-periodo', async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT e.titulo, e.data_evento, e.carga_horaria, COUNT(f.id) as total_presentes
        FROM eventos e
        LEFT JOIN frequencias f ON e.id = f.evento_id
        WHERE e.data_evento BETWEEN $1 AND $2
        GROUP BY e.id ORDER BY e.data_evento ASC`;
    const result = await pool.query(sql, [inicio, fim]);
    res.json(result.rows);
});

app.get('/api/admin/relatorio-oferta', async (req, res) => {
    const { inicio, fim } = req.query;
    const sql = `
        SELECT titulo, data_evento, carga_horaria, endereco 
        FROM eventos 
        WHERE data_evento BETWEEN $1 AND $2 
        ORDER BY data_evento ASC`;
    const r = await pool.query(sql, [inicio, fim]);
    res.json(r.rows);
});

app.get('/api/admin/dossie-professor', async (req, res) => {
    const { professor_id, inicio, fim } = req.query;
    const sql = `
        SELECT e.titulo, f.data_entrada, f.data_saida,
        EXTRACT(EPOCH FROM (f.data_saida - f.data_entrada))/3600 as permanencia
        FROM frequencias f
        JOIN eventos e ON f.evento_id = e.id
        WHERE f.participante_id = $1 AND e.data_evento BETWEEN $2 AND $3
        ORDER BY e.data_evento DESC`;
    const r = await pool.query(sql, [professor_id, inicio, fim]);
    res.json(r.rows);
});

app.get('/api/admin/locais', async (req, res) => {
    const r = await pool.query("SELECT * FROM locais ORDER BY nome ASC");
    res.json(r.rows);
});

app.post('/api/admin/locais', async (req, res) => {
    const { id, nome, endereco, latitude, longitude, ativo } = req.body;
    if (id) {
        await pool.query("UPDATE locais SET nome=$1, endereco=$2, latitude=$3, longitude=$4, ativo=$5 WHERE id=$6", [nome, endereco, latitude, longitude, ativo, id]);
    } else {
        await pool.query("INSERT INTO locais (nome, endereco, latitude, longitude) VALUES ($1, $2, $3, $4)", [nome, endereco, latitude, longitude]);
    }
    res.json({ success: true });
});

// --- CRUD EVENTOS MODIFICADO ---
app.get('/api/admin/eventos', async (req, res) => {
    const r = await pool.query(`
        SELECT e.*, l.nome as local_nome 
        FROM eventos e 
        LEFT JOIN locais l ON e.local_id = l.id 
        ORDER BY e.data_evento DESC`);
    res.json(r.rows);
});

app.post('/api/verificar-localizacao', async (req, res) => {
    const { matricula, lat, lng, device_key } = req.body;

    try {
        let profId = null;
        let profMatricula = matricula;
        let profNome = "";

        // 1. Tenta identificar automaticamente o professor pelo ID único do aparelho
        if (device_key) {
            const profRes = await pool.query(
                "SELECT id, matricula, nome_completo FROM participantes WHERE device_key = $1 AND ativo = TRUE", 
                [device_key]
            );
            if (profRes.rows.length > 0) {
                profId = profRes.rows[0].id;
                profMatricula = profRes.rows[0].matricula;
                profNome = profRes.rows[0].nome_completo;
            }
        }

        // 2. Se o aparelho não for reconhecido e o usuário enviou a matrícula, busca e vincula o aparelho
        if (!profId && profMatricula) {
            const profRes = await pool.query(
                "SELECT id, nome_completo FROM participantes WHERE matricula = $1 AND ativo = TRUE", 
                [profMatricula]
            );
            if (profRes.rows.length > 0) {
                profId = profRes.rows[0].id;
                profNome = profRes.rows[0].nome_completo;
                // Salva o vínculo do aparelho para os próximos acessos ser automático
                await pool.query("UPDATE participantes SET device_key = $1 WHERE id = $2", [device_key, profId]);
            } else {
                return res.status(400).json({ error: "Matrícula não cadastrada ou inativa no sistema administrativo." });
            }
        }

        // 3. Se não achou por nenhum dos dois, avisa o app que precisa pedir a matrícula
        if (!profId) {
            return res.json({ requere_matricula: true, message: "Identificamos que é seu primeiro acesso neste dispositivo. Por favor, informe sua matrícula." });
        }

        // 4. Busca as formações agendadas para HOJE forçando o fuso horário de Brasília (contorna erro de servidor internacional)
        const eventosHoje = await pool.query(`
            SELECT e.*, l.latitude, l.longitude, l.nome as local_nome 
            FROM eventos e
            JOIN locais l ON e.local_id = l.id
            WHERE e.data_evento = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
              AND l.ativo = TRUE
        `);

        if (eventosHoje.rows.length === 0) {
            return res.json({ success: false, message: "Não existe nenhuma Formação agendada no sistema para o dia de hoje." });
        }

        // 5. Validação de Raio Geográfico (60 metros)
        let eventoAlvo = null;
        for (let ev of eventosHoje.rows) {
            const distancia = calcularDistancia(parseFloat(lat), parseFloat(lng), parseFloat(ev.latitude), parseFloat(ev.longitude));
            if (distancia <= 60) {
                eventoAlvo = ev;
                break;
            }
        }

        if (!eventoAlvo) {
            // Loga a tentativa fora do raio para fins de auditoria antifraude
            await pool.query(
                "INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, 'FORA_DO_RAIO_DE_QUALQUER_EVENTO')",
                [profMatricula, lat, lng]
            );
            return res.json({ success: false, message: "Não existe nenhuma Formação ocorrendo no local exato onde você está. Aproxime-se do prédio polo." });
        }

        // 6. Verifica se este professor já possui uma ENTRADA ativa (sem saída gravada) para este evento
        const freqAberta = await pool.query(
            "SELECT id FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL",
            [profId, eventoAlvo.id]
        );

        if (freqAberta.rows.length === 0) {
            // --- REGISTRO DE ENTRADA ---
            // Grava apenas os dados de entrada, deixando a data_saida nula
            await pool.query(`
                INSERT INTO frequencias (participante_id, evento_id, data_entrada, lat_entrada, lng_entrada, device_key, matricula) 
                VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', $3, $4, $5, $6)`,
                [profId, eventoAlvo.id, lat, lng, device_key, profMatricula]
            );
            return res.json({ 
                success: true, 
                status: 'entrada_gravada', 
                professor: profNome, 
                evento: eventoAlvo.titulo 
            });
        } else {
            // --- SOLICITAÇÃO DE SAÍDA ---
            // Retorna o status informando que o app deve exibir a tela de avaliação
            return res.json({ 
                success: true, 
                status: 'requer_avaliacao', 
                frequencia_id: freqAberta.rows[0].id, 
                professor: profNome, 
                evento: eventoAlvo.titulo 
            });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/finalizar-saida', async (req, res) => {
    const { frequencia_id, avaliacao, lat, lng } = req.body;
    try {
        // Grava a saída com fuso horário de Brasília e a opinião do docente
        await pool.query(`
            UPDATE frequencias 
            SET data_saida = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 
                lat_saida = $1, 
                lng_saida = $2, 
                avaliacao = $3 
            WHERE id = $4`,
            [lat || null, lng || null, avaliacao, frequencia_id]
        );
        res.json({ success: true, message: "Sua saída e avaliação foram homologadas com sucesso! Carga horária calculada e creditada." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/relatorio-individual', async (req, res) => {
    const { inicio, fim } = req.query;
    try {
        const r = await pool.query(`
            SELECT p.nome_completo, p.matricula, count(f.id) as total_presencas,
                   coalesce(sum(extract(epoch from (f.data_saida - f.data_entrada))/3600), 0) as horas_validadas
            FROM participantes p
            JOIN frequencias f ON f.participante_id = p.id
            JOIN eventos e ON f.evento_id = e.id
            WHERE e.data_evento BETWEEN $1 AND $2 AND f.data_saida IS NOT NULL
            GROUP BY p.id, p.nome_completo, p.matricula
            ORDER BY p.nome_completo ASC`, [inicio, fim]);
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NOVO: RELATÓRIO POR LOCAL (POR ESPAÇO PÚBLICO) ---
app.get('/api/admin/relatorio-local', async (req, res) => {
    const { inicio, fim } = req.query;
    try {
        const r = await pool.query(`
            SELECT l.nome as local_nome, l.endereco, count(distinct e.id) as total_eventos,
                   count(f.id) as total_atendimentos
            FROM locais l
            JOIN eventos e ON e.local_id = l.id
            LEFT JOIN frequencias f ON f.evento_id = e.id
            WHERE e.data_evento BETWEEN $1 AND $2
            GROUP BY l.id, l.nome, l.endereco
            ORDER BY total_atendimentos DESC`, [inicio, fim]);
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3009, () => console.log("Servidor Formar v4 Ativo"));
