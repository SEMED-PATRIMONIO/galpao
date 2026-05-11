const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Gatosap2009*2@localhost:5432/postgres'
});

module.exports = pool;