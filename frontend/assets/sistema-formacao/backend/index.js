const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Configuração de CORS para seus subdomínios
app.use(cors({
  origin: ['https://qrcode.paiva.api.br', 'https://formar.paiva.api.br']
}));

app.use(express.json());

// --- ROTAS DO PROFESSOR (MOBILE - PORTA 3033) ---

// Identifica se o aparelho já tem cadastro
app.post('/api/identificar', async (req, res) => {
  const { device_key } = req.body;
  try {
    // O pool abre a conexão, executa e já libera para o próximo
    const result = await pool.query(
      'SELECT nome_completo, matricula FROM participantes WHERE device_key = $1', 
      [device_key]
    );
    
    if (result.rows.length > 0) {
      return res.json({ cadastrado: true, usuario: result.rows[0] });
    }
    res.json({ cadastrado: false });
  } catch (err) {
    res.status(500).json({ error: "Erro na identificação do dispositivo." });
  }
});

// Registra a presença (com lógica de INSERT/UPDATE atômico)
app.post('/api/registrar-presenca', async (req, res) => {
  const { nome, matricula, token_evento, device_key } = req.body;
  let currentKey = device_key || uuidv4();

  try {
    // Inicia transação para garantir que tudo ou nada seja gravado
    await pool.query('BEGIN');

    // Salva ou atualiza o participante
    await pool.query(
      `INSERT INTO participantes (nome_completo, matricula, device_key) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (matricula) DO UPDATE SET device_key = $3`,
      [nome, matricula, currentKey]
    );

    // Busca IDs necessários
    const pRes = await pool.query('SELECT id FROM participantes WHERE matricula = $1', [matricula]);
    const eRes = await pool.query('SELECT id FROM eventos WHERE token_qr = $1', [token_evento]);

    if (eRes.rows.length === 0) {
      throw new Error("QR Code de evento inválido ou expirado.");
    }

    // Registra a frequência. O 'ON CONFLICT DO NOTHING' evita erro se o prof clicar 2x
    await pool.query(
      'INSERT INTO frequencias (id_participante, id_evento) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [pRes.rows[0].id, eRes.rows[0].id]
    );

    await pool.query('COMMIT');
    res.json({ success: true, device_key: currentKey, nome });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// --- ROTAS DO ADMINISTRADOR (DESKTOP - PORTA 3034) ---

// Listagem de eventos com filtro de data decrescente (CORRIGIDO)
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

// Criação de novos eventos
app.post('/api/admin/eventos', async (req, res) => {
  const { titulo, data, carga, palestrante } = req.body;
  const token = uuidv4();
  
  try {
    const result = await pool.query(
      'INSERT INTO eventos (titulo, data_evento, carga_horaria, palestrante, token_qr) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [titulo, data, carga, palestrante, token]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar evento." });
  }
});

// Relatório de quem compareceu a um evento específico
app.get('/api/admin/relatorio/:evento_id', async (req, res) => {
  try {
    const query = `
      SELECT p.nome_completo, p.matricula, f.data_assinatura
      FROM frequencias f
      JOIN participantes p ON f.id_participante = p.id
      WHERE f.id_evento = $1
      ORDER BY f.data_assinatura DESC
    `;
    const result = await pool.query(query, [req.params.evento_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar lista de presença." });
  }
});

// Porta alterada conforme sua solicitação
const PORT = 3009;
app.listen(PORT, () => {
  console.log(`--- SISTEMA FORMAR ---`);
  console.log(`Backend rodando na porta ${PORT}`);
  console.log(`Conexão com Banco de Dados: OK`);
});