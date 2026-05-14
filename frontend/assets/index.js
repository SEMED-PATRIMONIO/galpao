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
  const { titulo, data_evento, carga_horaria } = req.body;
  const token = uuidv4().substring(0, 8); 
  await pool.query(
    "INSERT INTO eventos (titulo, data_evento, carga_horaria, token_qr) VALUES ($1, $2, $3, $4)",
    [titulo, data_evento, carga_horaria, token]
  );
  res.json({ success: true });
});

// --- PROFESSOR: ENTRADA/SAÍDA VIA QR ---
app.post('/api/registrar-check', async (req, res) => {
  const { matricula, token_qr, lat, lng } = req.body;
  
  try {
    // 1. Validar Professor
    const prof = await pool.query("SELECT id FROM participantes WHERE matricula = $1 AND ativo = TRUE", [matricula]);
    if (prof.rows.length === 0) return res.status(403).json({ error: "Professor não encontrado ou inativo" });

    // 2. Validar Evento pelo Token do QR
    const evento = await pool.query("SELECT id FROM eventos WHERE token_qr = $1", [token_qr]);
    if (evento.rows.length === 0) return res.status(404).json({ error: "Evento inválido" });

    const participante_id = prof.rows[0].id;
    const evento_id = evento.rows[0].id;

    // 3. Verificar se já existe entrada sem saída (Check-out pendente)
    const check = await pool.query(
      "SELECT id FROM frequencias WHERE participante_id = $1 AND evento_id = $2 AND data_saida IS NULL",
      [participante_id, evento_id]
    );

    if (check.rows.length > 0) {
      // Registrar SAÍDA
      await pool.query(
        "UPDATE frequencias SET data_saida = CURRENT_TIMESTAMP, lat_saida = $1, lng_saida = $2 WHERE id = $3",
        [lat, lng, check.rows[0].id]
      );
      res.json({ type: 'SAIDA' });
    } else {
      // Registrar ENTRADA
      await pool.query(
        "INSERT INTO frequencias (participante_id, evento_id, data_entrada, lat_entrada, lng_entrada) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)",
        [participante_id, evento_id, lat, lng]
      );
      res.json({ type: 'ENTRADA' });
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

app.listen(3009, () => console.log("Servidor Formar v2 Rodando"));