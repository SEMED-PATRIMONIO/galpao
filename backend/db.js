const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'estoque_central',
    password: 'Gatosap2009*2',
    port: 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};