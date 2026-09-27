const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { logAudit } = require('../utils/audit');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function register(req, res) {
  const { username, email, password, fullName } = req.body;
  const ip = req.ip;

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      // SEC: identical response whether username or email collided — avoids
      // confirming to an attacker which specific field already exists
      // (user enumeration protection).
      return res.status(409).json({ error: 'An account with these details already exists.' });
    }

    // SEC: passwords are hashed with bcrypt (salted, adaptive cost) —
    // plaintext passwords are never stored or logged anywhere.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name`,
        [username, email, passwordHash, fullName]
      );
      const user = userResult.rows[0];

      // SEC: secure default — every new account starts at a known, safe
      // balance of 0, opened atomically with the user record so no user
      // ever exists without a wallet.
      await client.query(
        `INSERT INTO wallets (user_id, balance_minor) VALUES ($1, 0)`,
        [user.id]
      );
      await client.query('COMMIT');

      await logAudit({ userId: user.id, action: 'REGISTER', ip, detail: { username } });

      return res.status(201).json({
        message: 'Account created successfully.',
        user: { id: user.id, username: user.username, fullName: user.full_name },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Register error:', err);
    // SEC: generic error to client, full detail only in server logs
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

async function login(req, res) {
  const { username, password } = req.body;
  const ip = req.ip;

  try {
    const result = await pool.query(
      `SELECT id, username, password_hash, failed_login_attempts, locked_until
       FROM users WHERE username = $1`,
      [username]
    );

    // SEC: constant shape of response whether the user exists or not.
    // We still do a dummy bcrypt compare to keep timing roughly consistent
    // and avoid leaking account existence via response time.
    const dummyHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOgxYE1L0YfCq7Y1r9v8DjZG5X9J2b3Nq';
    const user = result.rows[0];

    if (!user) {
      await bcrypt.compare(password, dummyHash);
      await logAudit({ action: 'LOGIN_FAILED', ip, detail: { username, reason: 'no_such_user' } });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // SEC: account lockout — after repeated failures, block further
    // attempts for a cooldown period regardless of whether the password
    // given is now correct. Mitigates brute force at the account level.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logAudit({ userId: user.id, action: 'LOGIN_BLOCKED_LOCKED', ip });
      return res.status(423).json({ error: 'Account temporarily locked due to repeated failed attempts. Try again later.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      const attempts = user.failed_login_attempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await pool.query(
        `UPDATE users SET failed_login_attempts = $1,
           locked_until = $2
         WHERE id = $3`,
        [
          shouldLock ? 0 : attempts,
          shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
          user.id,
        ]
      );
      await logAudit({ userId: user.id, action: 'LOGIN_FAILED', ip, detail: { attempts } });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Successful login — reset failure counters (secure default: clean slate)
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    );

    // SEC: short-lived JWT, signed server-side. Contains only non-sensitive
    // identifiers (no password, no balance) — the token itself is not a
    // place to store sensitive data since it's held client-side.
    const token = jwt.sign(
      { sub: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    await logAudit({ userId: user.id, action: 'LOGIN_SUCCESS', ip });

    return res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

/**
 * SEC: authorization — identical pattern to every other endpoint in this
 * app: the row returned is scoped by req.user.id from the verified JWT,
 * never by an id supplied by the client. Returns only non-sensitive
 * profile fields (never password_hash).
 */
async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = result.rows[0];
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      memberSince: user.created_at,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Could not retrieve profile.' });
  }
}

module.exports = { register, login, getMe };
