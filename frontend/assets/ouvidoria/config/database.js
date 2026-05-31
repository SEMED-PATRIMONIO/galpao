const { Pool } = require('pg');

// Lê a URL do banco a partir do arquivo .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("ERRO CRÍTICO: A variável DATABASE_URL não foi definida no arquivo .env");
  process.exit(1);
}

// Configuração otimizada do Pool de conexões para o ambiente Linux Ubuntu
const pool = new Pool({
  connectionString: connectionString,
  max: 15,                  // Máximo de conexões simultâneas abertas
  idleTimeoutMillis: 420000, // Tempo para encerrar conexões inativas (30 segundos)
  connectionTimeoutMillis: 2000, // Tempo limite para tentar conectar antes de dar erro (2 segundos)
});

// Eventos de monitoramento do banco de dados para segurança de log
pool.on('connect', () => {
  // Conexão bem-sucedida estabelecida com o Postgres
});

pool.on('error', (err) => {
  console.error('Erro inesperado no cliente do PostgreSQL Pool:', err);
});

// Exporta o pool para ser usado em qualquer lugar do projeto
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};