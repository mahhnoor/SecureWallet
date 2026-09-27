const pool = require('../db/pool');

/**
 * SEC: Accountability / logging control.
 * Records security-relevant events (logins, transfers, authorization
 * failures) to an append-only audit table so actions can be traced back
 * to a user, and so tampering or misuse can be investigated after the fact.
 *
 * This never throws — a logging failure must not block or crash the
 * primary operation (availability), it only prints to stderr for ops visibility.
 */
async function logAudit({ userId = null, action, ip = null, detail = {} }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, ip_address, detail) VALUES ($1, $2, $3, $4)`,
      [userId, action, ip, JSON.stringify(detail)]
    );
  } catch (err) {
    console.error('Failed to write audit log entry:', err.message);
  }
}

module.exports = { logAudit };
