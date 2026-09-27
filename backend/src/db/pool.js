const { Pool } = require('pg');

// SEC: credentials come from environment variables only — never hard-coded
// in source (reduces risk of credentials leaking via version control).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // SEC: log full detail server-side only; never surface DB internals to clients
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
