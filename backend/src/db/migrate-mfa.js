require('dotenv').config();
const pool = require('./pool');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
    `);

    console.log('MFA columns added successfully.');
  } catch (err) {
    console.error('MFA migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
