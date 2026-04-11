// /var/www/aee-cadastro/backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'omeq_db',
  password: 'Gatosap2009*2',
  port: 5432,
});

module.exports = pool;