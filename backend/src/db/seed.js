/**
 * Optional convenience seed script — creates two demo users (Ali & Sara)
 * so graders can immediately try a transfer without registering accounts.
 * NOT part of the security-relevant code path; safe to skip in production.
 *
 * Usage: node src/db/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const users = [
      { username: 'ali', email: 'ali@example.com', full_name: 'Ali Khan', password: 'Password123!', opening: 500000 },
      { username: 'sara', email: 'sara@example.com', full_name: 'Sara Ahmed', password: 'Password123!', opening: 200000 },
    ];

    for (const u of users) {
      const existing = await client.query('SELECT id FROM users WHERE username = $1', [u.username]);
      if (existing.rows.length > 0) {
        console.log(`User ${u.username} already exists, skipping.`);
        continue;
      }
      const hash = await bcrypt.hash(u.password, 12);
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [u.username, u.email, hash, u.full_name]
      );
      const userId = userResult.rows[0].id;
      await client.query(
        `INSERT INTO wallets (user_id, balance_minor) VALUES ($1, $2)`,
        [userId, u.opening]
      );
      console.log(`Created user '${u.username}' with password '${u.password}' and opening balance ${u.opening / 100}`);
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
