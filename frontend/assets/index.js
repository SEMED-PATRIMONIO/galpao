const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const app = express();

app.use(cors());
app.use(express.json());

// --- ROTAS DO ADMIN (formar.paiva.api.br) ---

// Listar Eventos
app.get('/api/admin/eventos', async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM eventos ORDER BY data_evento DESC");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Criar Evento (Ajustado com seus campos: titulo, data_evento, carga_horaria)
app.post('/api/admin/eventos', async (req, res) => {
  const { titulo, data_evento, carga_horaria } = req.body;
  try {
    const token = uuidv4().substring(0, 8); // Gera um token curto
    await pool.query(
      "INSERT INTO eventos (titulo, data_evento, carga_horaria, token_qr) VALUES ($1, $2, $3, $4)",
      [titulo, data_evento, carga_horaria, token]
    );
    res.json({ success: true });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
});

// Relatório Geral de Presenças (JOIN entre as 3 tabelas)
app.get('/api/admin/relatorio-geral', async (req, res) => {
  try {
    const sql = `
      SELECT 
        f.id, 
        p.nome_completo, 
        p.matricula, 
        e.titulo, 
        e.carga_horaria, 
        e.data_evento, 
        f.data_assinatura
      FROM frequencias f
      JOIN participantes p ON f.participante_id = p.id
      JOIN eventos e ON f.evento_id = e.id
      ORDER BY f.data_assinatura DESC
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROTAS DO PROFESSOR (qrcode.paiva.api.br) ---

app.get('/api/evento-atual', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM eventos WHERE data_evento = CURRENT_DATE LIMIT 1"
    );
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/registrar', async (req, res) => {
  const { nome, matricula, device_key, evento_id } = req.body;
  const finalKey = device_key || uuidv4();
  try {
    await pool.query('BEGIN');
    const p = await pool.query(
      `INSERT INTO participantes (nome_completo, matricula, device_key) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (matricula) DO UPDATE SET device_key = EXCLUDED.device_key
       RETURNING id`,
      [nome, matricula, finalKey]
    );
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

app.listen(3009, () => console.log("Servidor Formar Rodando na 3009"));