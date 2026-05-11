const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['https://qrcode.paiva.api.br', 'https://formar.paiva.api.br']
}));

app.use(express.json());

// --- ROTAS DO PROFESSOR ---

app.post('/api/identificar', async (req, res) => {
  const { device_key } = req.body;
  try {
    const result = await pool.query(
      'SELECT nome_completo, matricula FROM participantes WHERE device_key = $1', 
      [device_key]
    );
    if (result.rows.length > 0) return res.json({ cadastrado: true, usuario: result.rows[0] });
    res.json({ cadastrado: false });
  } catch (err) {
    res.status(500).json({ error: "Erro na identificação." });
  }
});

app.post('/api/registrar-presenca', async (req, res) => {
  const { nome, matricula, token_evento, device_key } = req.body;
  let currentKey = device_key || uuidv4();

  try {
    await pool.query('BEGIN');

    // Salva ou atualiza participante
    await pool.query(
      `INSERT INTO participantes (nome_completo, matricula, device_key) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (matricula) DO UPDATE SET device_key = $3`,
      [nome, matricula, currentKey]
    );

    // Busca IDs usando os nomes REAIS das suas colunas
    const pRes = await pool.query('SELECT id FROM participantes WHERE matricula = $1', [matricula]);
    const eRes = await pool.query('SELECT id FROM eventos WHERE token_qr = $1', [token_evento]);

    if (eRes.rows.length === 0) throw new Error("QR Code inválido.");

    // Registro de frequência usando participante_id e evento_id
    await pool.query(
      'INSERT INTO frequencias (participante_id, evento_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [pRes.rows[0].id, eRes.rows[0].id]
    );

    await pool.query('COMMIT');
    res.json({ success: true, device_key: currentKey, nome });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// --- ROTAS DO ADMINISTRADOR ---

app.get('/api/admin/eventos', async (req, res) => {
  const { inicio, fim } = req.query;
  try {
    let query = 'SELECT * FROM eventos';
    let params = [];

    if (inicio && fim) {
      query += ' WHERE data_evento BETWEEN $1 AND $2';
      params = [inicio, fim];
    }
    query += ' ORDER BY data_evento DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao consultar eventos." });
  }
});

app.post('/api/admin/eventos', async (req, res) => {
  const { titulo, data, carga, palestrante, local } = req.body;
  const token = uuidv4();
  try {
    const result = await pool.query(
      'INSERT INTO eventos (titulo, data_evento, carga_horaria, palestrante, local, token_qr) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [titulo, data, carga, palestrante, local, token]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar evento." });
  }
});

app.get('/api/admin/relatorio/:evento_id', async (req, res) => {
  try {
    const query = `
      SELECT p.nome_completo, p.matricula, f.data_assinatura, f.funcao
      FROM frequencias f
      JOIN participantes p ON f.participante_id = p.id
      WHERE f.evento_id = $1
      ORDER BY f.data_assinatura DESC
    `;
    const result = await pool.query(query, [req.params.evento_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

const PORT = 3009;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));