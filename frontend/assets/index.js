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
    const { titulo, data_evento, carga_horaria, local_id } = req.body;
    await pool.query("INSERT INTO eventos (titulo, data_evento, carga_horaria, local_id) VALUES ($1, $2, $3, $4)", [titulo, data_evento, carga_horaria, local_id]);
    res.json({ success: true });
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
            "SELECT id FROM frequencias WHERE matricula_prof = $1 AND evento_id = $2 AND data_saida IS NULL",
            [matricula, evento.id]
        );

        if (checkOpen.rows.length > 0) {
            await pool.query("UPDATE frequencias SET data_saida = NOW() WHERE id = $1", [checkOpen.rows[0].id]);
            res.json({ message: "SAÍDA REGISTRADA" });
        } else {
            await pool.query(
                "INSERT INTO frequencias (matricula_prof, evento_id, data_entrada, device_key) VALUES ($1, $2, NOW(), $3)",
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
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
    const { matricula, lat, lng, device_key, evento_selecionado_id } = req.body;

    try {
        // 1. Validar Professor Ativo
        const prof = await pool.query("SELECT id FROM participantes WHERE matricula = $1 AND ativo = TRUE", [matricula]);
        if (prof.rows.length === 0) return res.status(403).json({ error: "Professor não localizado ou cadastro inativo." });
        const participante_id = prof.rows[0].id;

        // 2. Trava de Dispositivo Antifraude
        const travaDispositivo = await pool.query(
            "SELECT id FROM frequencias WHERE device_key = $1 AND matricula_prof != $2 AND data_entrada > NOW() - INTERVAL '30 minutes' LIMIT 1",
            [device_key, matricula]
        );
        if (travaDispositivo.rows.length > 0) {
            await pool.query("INSERT INTO log_fraudes (matricula, motivo) VALUES ($1, 'DISPOSITIVO_MULTIPLAS_MATRICULAS')", [matricula]);
            return res.status(403).json({ error: "Fraude: Este dispositivo foi utilizado por outra matrícula recentemente." });
        }

        // 3. Buscar eventos do dia de hoje
        const eventosHoje = await pool.query(`
            SELECT e.id, e.titulo, l.latitude, l.longitude, l.nome as local_nome
            FROM eventos e
            JOIN locais l ON e.local_id = l.id
            WHERE e.data_evento = CURRENT_DATE AND l.ativo = TRUE
        `);

        // Filtrar eventos dentro do raio de 60 metros
        let eventosNoRaio = eventosHoje.rows.filter(ev => {
            const dist = getDistancia(lat, lng, ev.latitude, ev.longitude);
            return dist <= 60;
        });

        // Caso o usuário já tenha escolhido uma formação da lista múltipla
        if (evento_selecionado_id) {
            eventosNoRaio = eventosNoRaio.filter(e => e.id === parseInt(evento_selecionado_id));
        }

        // CÉLULA DE DECISÃO A: Nenhuma formação encontrada no raio
        if (eventosNoRaio.length === 0) {
            await pool.query("INSERT INTO log_fraudes (matricula, lat_tentativa, lng_tentativa, motivo) VALUES ($1, $2, $3, 'FORA_DO_RAIO_DE_QUALQUER_EVENTO')", [matricula, lat, lng]);
            return res.json({ status: 'NENHUM_EVENTO', message: "Não existe nenhuma Formação ocorrendo no local onde você está." });
        }

        // CÉLULA DE DECISÃO B: Mais de uma formação no mesmo espaço/tempo
        if (eventosNoRaio.length > 1) {
            return res.json({ status: 'MULTIPLOS_EVENTOS', lista: eventosNoRaio });
        }

        // CÉLULA DE DECISÃO C: Um evento exato identificado. Processar Entrada/Saída
        const eventoAlvo = eventosNoRaio[0];
        
        const checkOpen = await pool.query(
            "SELECT id, data_entrada FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL",
            [participante_id, eventoAlvo.id]
        );

        if (checkOpen.rows.length > 0) {
            // Processo de Checkout - Validar regra de 1 hora mínima de permanência
            const entrada = new Date(checkOpen.rows[0].data_entrada);
            const agora = new Date();
            const diferencaHoras = (agora - entrada) / (1000 * 60 * 60);

            if (diferencaHoras < 1.0) {
                return res.status(403).json({ error: "Registro de Saída Bloqueado. A permanência mínima exigida é de 1 hora." });
            }

            await pool.query("UPDATE frequencias SET data_saida = NOW() WHERE id = $1", [checkOpen.rows[0].id]);
            return res.json({ status: 'SAIDA', titulo: eventoAlvo.titulo });
        } else {
            // Processo de Checkin
            await pool.query(
                "INSERT INTO frequencias (participante_id, evento_id, data_entrada, device_key, matricula_prof) VALUES ($1, $2, NOW(), $3, $4)",
                [participante_id, eventoAlvo.id, device_key, matricula]
            );
            return res.json({ status: 'ENTRADA', titulo: eventoAlvo.titulo });
        }

    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3009, () => console.log("Servidor Formar v4 Ativo"));
