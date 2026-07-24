const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Servir o index.html se estiver na pasta public

// CONFIGURAÇÃO DO POSTGRESQL (Ajuste a senha se necessário)
const pool = new Pool({
  user: process.env.DB_USER || 'opsemed',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lifyn_db',
  password: process.env.DB_PASSWORD || 'sua_senha_postgres', 
  port: process.env.DB_PORT || 5432,
});

const JWT_SECRET = 'lifyn_secret_key_2026_super_segura';

// AUTOMACÃO: Criação das Tabelas no PostgreSQL
async function initDB() {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      gender VARCHAR(20) DEFAULT 'Masculino',
      birth_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      type VARCHAR(50) NOT NULL,
      duration INT NOT NULL,
      distance NUMERIC(5,2),
      date DATE NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vitals (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      systolic INT NOT NULL,
      diastolic INT NOT NULL,
      heart_rate INT NOT NULL,
      date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS lab_exams (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      exam_name VARCHAR(100) NOT NULL,
      parameter VARCHAR(100) NOT NULL,
      value NUMERIC(8,2) NOT NULL,
      unit VARCHAR(20),
      ref_min NUMERIC(8,2),
      ref_max NUMERIC(8,2),
      date DATE NOT NULL,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS bill_types (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      name VARCHAR(100) NOT NULL,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      bill_type_id INT REFERENCES bill_types(id),
      title VARCHAR(100) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      due_date DATE NOT NULL,
      paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMP,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS medications (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      name VARCHAR(100) NOT NULL,
      dosage VARCHAR(50),
      schedule_time TIME NOT NULL,
      frequency VARCHAR(50),
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS med_logs (
      id SERIAL PRIMARY KEY,
      medication_id INT REFERENCES medications(id),
      taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(queryText);
    console.log('✅ Banco de dados sincronizado e tabelas verificadas/criadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar tabelas no PostgreSQL:', err.message);
  }
}

// Middleware de Autenticação JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado: Token ausente' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    req.user = user;
    next();
  });
}

// --- ROTAS DE AUTENTICAÇÃO ---

app.get('/api/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ registered: parseInt(result.rows[0].count) > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar status do banco.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password, gender, birth_date } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, gender, birth_date) VALUES ($1, $2, $3, $4) RETURNING id, username',
      [username, hashedPassword, gender || 'Masculino', birth_date || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Usuário já existe ou dados inválidos.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });

    const user = result.rows[0];
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// --- ROTAS DO DASHBOARD E MÓDULOS ---

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const act = await pool.query('SELECT COUNT(*) FROM activities WHERE user_id=$1 AND active=true', [userId]);
    const bills = await pool.query('SELECT SUM(amount) FROM bills WHERE user_id=$1 AND paid=false AND active=true', [userId]);
    const meds = await pool.query('SELECT COUNT(*) FROM medications WHERE user_id=$1 AND active=true', [userId]);
    const bp = await pool.query('SELECT systolic, diastolic FROM vitals WHERE user_id=$1 AND active=true ORDER BY date DESC LIMIT 1', [userId]);

    res.json({
      activitiesCount: parseInt(act.rows[0].count) || 0,
      unpaidBills: parseFloat(bills.rows[0].sum) || 0,
      medsCount: parseInt(meds.rows[0].count) || 0,
      lastBP: bp.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EXERCÍCIOS
app.get('/api/activities', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM activities WHERE user_id=$1 ORDER BY date DESC', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/activities', authenticateToken, async (req, res) => {
  const { type, duration, distance, date } = req.body;
  const result = await pool.query(
    'INSERT INTO activities (user_id, type, duration, distance, date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, type, duration, distance || null, date]
  );
  res.json(result.rows[0]);
});

app.patch('/api/activities/:id/toggle', authenticateToken, async (req, res) => {
  await pool.query('UPDATE activities SET active = NOT active WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// PRESSÃO E SINAIS VITAIS
app.get('/api/vitals', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM vitals WHERE user_id=$1 ORDER BY date DESC', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/vitals', authenticateToken, async (req, res) => {
  const { systolic, diastolic, heart_rate, date } = req.body;
  const result = await pool.query(
    'INSERT INTO vitals (user_id, systolic, diastolic, heart_rate, date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, systolic, diastolic, heart_rate, date || new Date()]
  );
  res.json(result.rows[0]);
});

app.patch('/api/vitals/:id/toggle', authenticateToken, async (req, res) => {
  await pool.query('UPDATE vitals SET active = NOT active WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// EXAMES LABORATORIAIS
app.get('/api/lab-exams', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM lab_exams WHERE user_id=$1 ORDER BY date DESC', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/lab-exams', authenticateToken, async (req, res) => {
  const { exam_name, parameter, value, unit, ref_min, ref_max, date } = req.body;
  const result = await pool.query(
    'INSERT INTO lab_exams (user_id, exam_name, parameter, value, unit, ref_min, ref_max, date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.user.id, exam_name, parameter, value, unit, ref_min, ref_max, date]
  );
  res.json(result.rows[0]);
});

app.patch('/api/lab-exams/:id/toggle', authenticateToken, async (req, res) => {
  await pool.query('UPDATE lab_exams SET active = NOT active WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// CONTAS E TIPOS DE CONTAS
app.get('/api/bills', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM bills WHERE user_id=$1 ORDER BY due_date DESC', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/bills', authenticateToken, async (req, res) => {
  const { title, amount, due_date, bill_type_id } = req.body;
  const result = await pool.query(
    'INSERT INTO bills (user_id, title, amount, due_date, bill_type_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, title, amount, due_date, bill_type_id || null]
  );
  res.json(result.rows[0]);
});

app.patch('/api/bills/:id/pay', authenticateToken, async (req, res) => {
  await pool.query('UPDATE bills SET paid = true, paid_at = CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

app.patch('/api/bills/:id/toggle', authenticateToken, async (req, res) => {
  await pool.query('UPDATE bills SET active = NOT active WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// MEDICAMENTOS E HISTÓRICO DIÁRIO
app.get('/api/medications', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM medications WHERE user_id=$1 ORDER BY schedule_time ASC', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/medications', authenticateToken, async (req, res) => {
  const { name, dosage, schedule_time, frequency } = req.body;
  const result = await pool.query(
    'INSERT INTO medications (user_id, name, dosage, schedule_time, frequency) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, name, dosage, schedule_time, frequency]
  );
  res.json(result.rows[0]);
});

// Registrar que o remédio foi tomado no dia/hora atual
app.post('/api/medications/:id/take', authenticateToken, async (req, res) => {
  await pool.query('INSERT INTO med_logs (medication_id) VALUES ($1)', [req.params.id]);
  res.json({ success: true, message: 'Remédio registrado como tomado!' });
});

app.patch('/api/medications/:id/toggle', authenticateToken, async (req, res) => {
  await pool.query('UPDATE medications SET active = NOT active WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  await initDB();
  console.log(`🚀 Servidor Lifyn rodando em http://0.0.0.0:${PORT}`);
});