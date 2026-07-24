const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3038;
const SECRET = 'lifyn_super_secret_key_2026_mobile';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração de Conexão com PostgreSQL
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'lifyn_db',
  password: process.env.POSTGRES_PASSWORD || 'Gatosap2009*2',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

// Sincronização e Criação do Schema de Tabelas no PostgreSQL
async function initDb() {
  let retries = 5;
  while (retries) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS owner (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          device_token TEXT
        );

        CREATE TABLE IF NOT EXISTS activities (
          id SERIAL PRIMARY KEY,
          type VARCHAR(100) NOT NULL,
          duration INT,
          distance NUMERIC(6,2),
          date VARCHAR(50),
          notes TEXT,
          active INT DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS vitals (
          id SERIAL PRIMARY KEY,
          systolic INT,
          diastolic INT,
          heart_rate INT,
          date VARCHAR(50),
          active INT DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS lab_exams (
          id SERIAL PRIMARY KEY,
          exam_name VARCHAR(150),
          parameter VARCHAR(150),
          value NUMERIC(10,2),
          unit VARCHAR(50),
          date VARCHAR(50),
          active INT DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS bills (
          id SERIAL PRIMARY KEY,
          title VARCHAR(150),
          amount NUMERIC(10,2),
          due_date VARCHAR(50),
          category VARCHAR(100),
          paid INT DEFAULT 0,
          active INT DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS medications (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150),
          dosage VARCHAR(100),
          schedule_time VARCHAR(50),
          frequency VARCHAR(100),
          active INT DEFAULT 1
        );
      `);
      console.log('PostgreSQL conectado e tabelas inicializadas!');
      break;
    } catch (err) {
      console.error('Aguardando inicialização do banco PostgreSQL...', err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}
initDb();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado.' });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sessão expirada.' });
    req.user = user;
    next();
  });
}

// 1. Checagem de Dispositivo e Registro
app.get('/api/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM owner LIMIT 1');
    res.json({ registered: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM owner LIMIT 1');
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe um proprietário registrado.' });
    }

    const { username, password, deviceToken } = req.body;
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO owner (username, password, device_token) VALUES ($1, $2, $3)',
      [username, hash, deviceToken]
    );

    const token = jwt.sign({ username, deviceToken }, SECRET);
    res.json({ token, message: 'Conta proprietária criada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password, deviceToken } = req.body;
    const result = await pool.query('SELECT * FROM owner WHERE username = $1', [username]);
    const owner = result.rows[0];

    if (!owner || !(await bcrypt.compare(password, owner.password))) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    await pool.query('UPDATE owner SET device_token = $1 WHERE id = $2', [deviceToken, owner.id]);

    const token = jwt.sign({ username, deviceToken }, SECRET);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas Genéricas CRUD (Com Suporte a Inativação / Reativação)
function createCrudRoutes(endpoint, tableName, fields) {
  app.get(`/api/${endpoint}`, authenticateToken, async (req, res) => {
    try {
      const showInactive = req.query.showInactive === 'true';
      const query = showInactive 
        ? `SELECT * FROM ${tableName} ORDER BY id DESC`
        : `SELECT * FROM ${tableName} WHERE active = 1 ORDER BY id DESC`;
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`/api/${endpoint}`, authenticateToken, async (req, res) => {
    try {
      const keys = fields.filter(f => req.body[f] !== undefined);
      const values = keys.map(f => req.body[f]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await pool.query(query, values);
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(`/api/${endpoint}/:id/toggle`, authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const current = await pool.query(`SELECT active FROM ${tableName} WHERE id = $1`, [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: 'Registro não encontrado' });
      
      const newStatus = current.rows[0].active === 1 ? 0 : 1;
      await pool.query(`UPDATE ${tableName} SET active = $1 WHERE id = $2`, [newStatus, id]);
      res.json({ success: true, active: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

createCrudRoutes('activities', 'activities', ['type', 'duration', 'distance', 'date', 'notes']);
createCrudRoutes('vitals', 'vitals', ['systolic', 'diastolic', 'heart_rate', 'date']);
createCrudRoutes('lab-exams', 'lab_exams', ['exam_name', 'parameter', 'value', 'unit', 'date']);
createCrudRoutes('bills', 'bills', ['title', 'amount', 'due_date', 'category', 'paid']);
createCrudRoutes('medications', 'medications', ['name', 'dosage', 'schedule_time', 'frequency']);

// Dados do Painel
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const actCount = await pool.query('SELECT COUNT(*) as c FROM activities WHERE active = 1');
    const billsSum = await pool.query('SELECT SUM(amount) as s FROM bills WHERE active = 1 AND paid = 0');
    const medsCount = await pool.query('SELECT COUNT(*) as c FROM medications WHERE active = 1');
    const lastBP = await pool.query('SELECT systolic, diastolic, heart_rate FROM vitals WHERE active = 1 ORDER BY id DESC LIMIT 1');

    res.json({
      activitiesCount: parseInt(actCount.rows[0].c || 0),
      unpaidBills: parseFloat(billsSum.rows[0].s || 0),
      medsCount: parseInt(medsCount.rows[0].c || 0),
      lastBP: lastBP.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lifyn Mobile Server ativo na porta ${PORT}`);
});