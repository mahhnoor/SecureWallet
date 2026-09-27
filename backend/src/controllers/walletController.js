const pool = require('../db/pool');

async function getBalance(req, res) {
  try {
    // SEC: authorization — always scope by req.user.id (from the verified
    // JWT), NEVER by an id supplied in the request body/query. This is
    // what prevents one customer from reading another customer's balance
    // (an IDOR — Insecure Direct Object Reference — vulnerability).
    const result = await pool.query(
      `SELECT balance_minor, currency, updated_at FROM wallets WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = result.rows[0];
    return res.json({
      balance: wallet.balance_minor / 100,
      currency: wallet.currency,
      updatedAt: wallet.updated_at,
    });
  } catch (err) {
    console.error('Get balance error:', err);
    return res.status(500).json({ error: 'Could not retrieve balance.' });
  }
}

module.exports = { getBalance };
