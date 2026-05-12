const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const app = express();

app.use(cors());
app.use(express.json());

// --- ROTA DO PROFESSOR (qrcode.paiva) ---

// Busca o evento que está acontecendo HOJE
app.get('/api/evento-atual', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM eventos WHERE data_evento = CURRENT_DATE LIMIT 1"
    );
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registro de Presença Simplificado
app.post('/api/registrar', async (req, res) => {
  const { nome, matricula, device_key, evento_id } = req.body;
  const finalKey = device_key || uuidv4();

  try {
    await pool.query('BEGIN');

    // 1. Upsert no Participante (Identifica ou Cria)
    const p = await pool.query(
      `INSERT INTO participantes (nome_completo, matricula, device_key) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (matricula) DO UPDATE SET device_key = EXCLUDED.device_key
       RETURNING id`,
      [nome, matricula, finalKey]
    );

    // 2. Registra Frequência (Ignora se já existir para este evento)
    await pool.query(
      `INSERT INTO frequencias (participante_id, evento_id) 
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [p.rows[0].id, evento_id]
    );

    await pool.query('COMMIT');
    res.json({ success: true, device_key: finalKey });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// --- ROTA DO ADMIN (formar.paiva) ---

// Relatório Completo com Filtros (Eventos, Datas, Professores)
app.get('/api/admin/relatorio-geral', async (req, res) => {
  const { inicio, fim, evento, busca } = req.query;
  let params = [];
  let sql = `
    SELECT f.id, p.nome_completo, p.matricula, e.titulo, e.carga_horaria, e.data_evento, f.data_assinatura
    FROM frequencias f
    JOIN participantes p ON f.participante_id = p.id
    JOIN eventos e ON f.evento_id = e.id
    WHERE 1=1
  `;

  if (inicio && fim) { params.push(inicio, fim); sql += ` AND e.data_evento BETWEEN $${params.length-1} AND $${params.length}`; }
  if (evento) { params.push(evento); sql += ` AND e.id = $${params.length}`; }
  if (busca) { params.push(`%${busca}%`); sql += ` AND (p.nome_completo ILIKE $${params.length} OR p.matricula ILIKE $${params.length})`; }

  sql += " ORDER BY f.data_assinatura DESC";
  
  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CRUD Eventos (Simples)
app.get('/api/admin/eventos', async (req, res) => {
  const r = await pool.query("SELECT * FROM eventos ORDER BY data_evento DESC");
  res.json(r.rows);
});

app.post('/api/admin/eventos', async (req, res) => {
  const { titulo, data, carga } = req.body;
  await pool.query("INSERT INTO eventos (titulo, data_evento, carga_horaria) VALUES ($1, $2, $3)", [titulo, data, carga]);
  res.json({ success: true });
});

app.listen(3009, () => console.log("Servidor Formar Rodando na 3009"));