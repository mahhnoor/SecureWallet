const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateSecret, generateURI, verify } = require('otplib');
const QRCode = require('qrcode');
const pool = require('../db/pool');
const { logAudit } = require('../utils/audit');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MFA_CHALLENGE_EXPIRY = '5m';

async function register(req, res) {
  const { username, email, password, fullName } = req.body;
  const ip = req.ip;

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      // SEC: identical response whether username or email collided —
      // avoids confirming to an attacker which specific field exists.
      return res.status(409).json({
        error: 'An account with these details already exists.',
      });
    }

    // SEC: passwords are hashed with bcrypt (salted, adaptive cost).
    // Plaintext passwords are never stored or logged.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, full_name`,
        [username, email, passwordHash, fullName]
      );

      const user = userResult.rows[0];

      // SEC: secure default — every new account starts with a zero
      // balance and is created atomically with the user.
      await client.query(
        `INSERT INTO wallets (user_id, balance_minor) VALUES ($1, 0)`,
        [user.id]
      );

      await client.query('COMMIT');

      await logAudit({
        userId: user.id,
        action: 'REGISTER',
        ip,
        detail: { username },
      });

      return res.status(201).json({
        message: 'Account created successfully.',
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Register error:', err);

    // SEC: generic error to client, full detail only in server logs.
    return res.status(500).json({
      error: 'Registration failed. Please try again.',
    });
  }
}

async function login(req, res) {
  const { username, password } = req.body;
  const ip = req.ip;

  try {
    const result = await pool.query(
      `SELECT id, username, password_hash,
              failed_login_attempts, locked_until,
              mfa_enabled
       FROM users
       WHERE username = $1`,
      [username]
    );

    // SEC: constant response shape whether the user exists or not.
    // Dummy bcrypt comparison helps reduce username-enumeration timing leaks.
    const dummyHash =
      '$2b$12$C6UzMDM.H6dfI/f/IKcEeOgxYE1L0YfCq7Y1r9v8DjZG5X9J2b3Nq';

    const user = result.rows[0];

    if (!user) {
      await bcrypt.compare(password, dummyHash);

      await logAudit({
        action: 'LOGIN_FAILED',
        ip,
        detail: {
          username,
          reason: 'no_such_user',
        },
      });

      return res.status(401).json({
        error: 'Invalid username or password.',
      });
    }

    // SEC: account lockout after repeated password failures.
    if (
      user.locked_until &&
      new Date(user.locked_until) > new Date()
    ) {
      await logAudit({
        userId: user.id,
        action: 'LOGIN_BLOCKED_LOCKED',
        ip,
      });

      return res.status(423).json({
        error:
          'Account temporarily locked due to repeated failed attempts. Try again later.',
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      const attempts = user.failed_login_attempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             locked_until = $2
         WHERE id = $3`,
        [
          shouldLock ? 0 : attempts,
          shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
          user.id,
        ]
      );

      await logAudit({
        userId: user.id,
        action: 'LOGIN_FAILED',
        ip,
        detail: { attempts },
      });

      return res.status(401).json({
        error: 'Invalid username or password.',
      });
    }

    // Successful password verification — reset password failure counters.
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [user.id]
    );

    /*
     * SEC: MFA enforcement.
     *
     * If MFA is enabled, DO NOT issue the normal session JWT yet.
     * Instead issue a short-lived MFA challenge token.
     *
     * This prevents a user with only the correct password from
     * accessing the account when MFA is enabled.
     */
    if (user.mfa_enabled) {
      const mfaChallenge = jwt.sign(
        {
          sub: user.id,
          username: user.username,
          type: 'mfa_challenge',
        },
        process.env.JWT_SECRET,
        {
          expiresIn: MFA_CHALLENGE_EXPIRY,
        }
      );

      await logAudit({
        userId: user.id,
        action: 'LOGIN_MFA_REQUIRED',
        ip,
      });

      return res.json({
        mfaRequired: true,
        mfaChallenge,
        user: {
          id: user.id,
          username: user.username,
        },
      });
    }

    // SEC: only accounts without MFA receive a normal session JWT here.
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '30m',
      }
    );

    await logAudit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ip,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('Login error:', err);

    return res.status(500).json({
      error: 'Login failed. Please try again.',
    });
  }
}

/*
 * SEC: complete the second authentication factor.
 *
 * This endpoint accepts only the short-lived MFA challenge created
 * after successful password verification. It does NOT accept a
 * normal session token as proof of MFA.
 */
async function verifyLoginMfa(req, res) {
  const { mfaChallenge, code } = req.body;
  const ip = req.ip;

  if (!mfaChallenge || !/^\d{6}$/.test(code || '')) {
    return res.status(401).json({
      error: 'Invalid MFA code.',
    });
  }

  try {
    let challenge;

    try {
      challenge = jwt.verify(
        mfaChallenge,
        process.env.JWT_SECRET
      );
    } catch (err) {
      return res.status(401).json({
        error: 'MFA session expired. Please log in again.',
      });
    }

    // SEC: prevent a normal JWT from being used as an MFA challenge.
    if (challenge.type !== 'mfa_challenge') {
      return res.status(401).json({
        error: 'Invalid MFA session. Please log in again.',
      });
    }

    const userResult = await pool.query(
      `SELECT id, username, mfa_enabled, mfa_secret
       FROM users
       WHERE id = $1`,
      [challenge.sub]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid MFA session. Please log in again.',
      });
    }

    const user = userResult.rows[0];

    // SEC: MFA must still be enabled on the account.
    if (!user.mfa_enabled || !user.mfa_secret) {
      return res.status(401).json({
        error: 'MFA is not enabled for this account.',
      });
    }

    const result = await verify({
      secret: user.mfa_secret,
      token: code,
    });

    if (!result.valid) {
      await logAudit({
        userId: user.id,
        action: 'LOGIN_MFA_FAILED',
        ip,
      });

      // 401 is intentionally used here because the second
      // authentication factor was not successfully verified.
      return res.status(401).json({
        error: 'Invalid MFA code.',
      });
    }

    // SEC: only after both password AND TOTP are successfully
    // verified do we issue the real authenticated session JWT.
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '30m',
      }
    );

    await logAudit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ip,
      detail: { mfa: true },
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('MFA login verification error:', err);

    return res.status(500).json({
      error: 'MFA verification failed. Please try again.',
    });
  }
}

async function setupMfa(req, res) {
  try {
    const userResult = await pool.query(
      'SELECT id, username, mfa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    const user = userResult.rows[0];

    if (user.mfa_enabled) {
      return res.status(400).json({
        error: 'MFA is already enabled.',
      });
    }

    // Generate a new random secret for this user's authenticator app.
    const secret = generateSecret();

    // Store the secret temporarily. MFA remains disabled until
    // the user proves possession of the authenticator.
    await pool.query(
      'UPDATE users SET mfa_secret = $1 WHERE id = $2',
      [secret, user.id]
    );

    const uri = generateURI({
      issuer: 'SecureWallet',
      label: user.username,
      secret,
    });

    const qrCode = await QRCode.toDataURL(uri);

    return res.json({
      uri,
      qrCode,
    });
  } catch (err) {
    console.error('MFA setup error:', err);

    return res.status(500).json({
      error: 'Could not set up MFA.',
    });
  }
}

async function verifyMfaSetup(req, res) {
  try {
    console.log('MFA setup verification started');
    console.log('Authenticated user ID:', req.user?.id);

    const { code } = req.body;

    if (!/^\d{6}$/.test(code || '')) {
      console.log('MFA setup failed: invalid code format');

      return res.status(400).json({
        error: 'Invalid MFA code.',
      });
    }

    const userResult = await pool.query(
      `SELECT id, mfa_secret, mfa_enabled
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    console.log('MFA user query completed');

    if (userResult.rows.length === 0) {
      console.log('MFA setup failed: user not found');

      return res.status(404).json({
        error: 'User not found.',
      });
    }

    const user = userResult.rows[0];

    console.log('MFA enabled:', user.mfa_enabled);
    console.log('MFA secret exists:', !!user.mfa_secret);

    if (user.mfa_enabled) {
      return res.status(400).json({
        error: 'MFA is already enabled.',
      });
    }

    if (!user.mfa_secret) {
      return res.status(400).json({
        error: 'MFA setup has not been started.',
      });
    }

    console.log('Starting TOTP verification');

    const result = await verify({
      secret: user.mfa_secret,
      token: code,
    });

    console.log('TOTP verification result:', result);

    if (!result.valid) {
      return res.status(400).json({
        error: 'Invalid MFA code.',
      });
    }

    console.log('TOTP valid. Updating MFA status...');

    await pool.query(
      'UPDATE users SET mfa_enabled = TRUE WHERE id = $1',
      [user.id]
    );

    console.log('MFA status updated successfully');

    await logAudit({
      userId: user.id,
      action: 'MFA_ENABLED',
      ip: req.ip,
    });

    console.log('MFA audit logged successfully');

    return res.json({
      message: 'MFA enabled successfully.',
    });
  } catch (err) {
    console.error('MFA verification error:', err);

    return res.status(500).json({
      error: 'Could not verify MFA setup.',
    });
  }
}

/**
 * SEC: authorization — the profile row is always scoped by
 * req.user.id from the verified JWT, never by an ID supplied
 * by the client. Sensitive password fields are never returned.
 */
async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, created_at, mfa_enabled
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    const user = result.rows[0];

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      memberSince: user.created_at,
      mfaEnabled: user.mfa_enabled,
    });
  } catch (err) {
    console.error('Get profile error:', err);

    return res.status(500).json({
      error: 'Could not retrieve profile.',
    });
  }
}

module.exports = {
  register,
  login,
  verifyLoginMfa,
  getMe,
  setupMfa,
  verifyMfaSetup,
};