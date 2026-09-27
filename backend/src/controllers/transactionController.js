const pool = require('../db/pool');
const { logAudit } = require('../utils/audit');

/**
 * Transfer funds from the authenticated user to another registered user.
 *
 * SEC (integrity — the most important control in this whole app):
 * The debit, credit, and transaction record are wrapped in a single
 * PostgreSQL transaction using SELECT ... FOR UPDATE row locks on both
 * wallets. Without this:
 *   - Two concurrent transfers from the same account could both read the
 *     same starting balance and both succeed, letting a user spend money
 *     they don't have (a race condition / double-spend bug).
 *   - A crash mid-transfer could debit the sender without crediting the
 *     receiver (partial failure -> money "disappears").
 * Locking wallets in a fixed order (lower wallet id first) prevents
 * deadlocks when two transfers happen between the same pair of accounts
 * in opposite directions at the same time.
 */
async function transfer(req, res) {
  const senderUserId = req.user.id;
  const { receiverUsername, amount } = req.body;
  const ip = req.ip;

  // amount is already validated as a positive number by express-validator,
  // convert to integer minor units (cents) to avoid floating point errors.
  const amountMinor = Math.round(Number(amount) * 100);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const senderWalletRes = await client.query(
      `SELECT w.id, w.balance_minor, u.username
       FROM wallets w JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1`,
      [senderUserId]
    );
    const senderWallet = senderWalletRes.rows[0];

    const receiverRes = await client.query(
      `SELECT w.id, u.id AS user_id, u.username
       FROM wallets w JOIN users u ON u.id = w.user_id
       WHERE u.username = $1`,
      [receiverUsername]
    );
    const receiverWallet = receiverRes.rows[0];

    if (!receiverWallet) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipient not found. Check the username and try again.' });
    }

    // SEC: business-rule check — a user cannot "transfer" to themselves,
    // which would otherwise be a no-op that pollutes transaction history
    // or could be abused for wash transactions.
    if (receiverWallet.user_id === senderUserId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot transfer funds to yourself.' });
    }

    // SEC: lock both wallet rows in a deterministic order (by id) to
    // prevent deadlocks, and FOR UPDATE so no other transaction can read
    // or modify these rows until this one commits or rolls back.
    const idsInOrder = [senderWallet.id, receiverWallet.id].sort((a, b) => a - b);
    for (const id of idsInOrder) {
      await client.query('SELECT id FROM wallets WHERE id = $1 FOR UPDATE', [id]);
    }

    // Re-read the sender's balance AFTER acquiring the lock — this is the
    // value that is actually authoritative once the lock is held.
    const freshSender = await client.query('SELECT balance_minor FROM wallets WHERE id = $1', [senderWallet.id]);
    const currentBalance = freshSender.rows[0].balance_minor;

    if (currentBalance < amountMinor) {
      const txResult = await client.query(
        `INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount_minor, status, failure_reason)
         VALUES ($1, $2, $3, 'FAILED', 'INSUFFICIENT_FUNDS') RETURNING reference`,
        [senderWallet.id, receiverWallet.id, amountMinor]
      );
      await client.query('COMMIT'); // commit the FAILED record for a complete audit trail
      await logAudit({ userId: senderUserId, action: 'TRANSFER_FAILED', ip, detail: { reason: 'insufficient_funds', amount } });
      return res.status(400).json({ error: 'Insufficient balance.', reference: txResult.rows[0].reference });
    }

    // Perform the debit and credit atomically. The CHECK (balance_minor >= 0)
    // constraint on the wallets table is a last-resort database-level
    // guard even if application logic above were ever bypassed.
    await client.query(
      'UPDATE wallets SET balance_minor = balance_minor - $1, updated_at = now() WHERE id = $2',
      [amountMinor, senderWallet.id]
    );
    await client.query(
      'UPDATE wallets SET balance_minor = balance_minor + $1, updated_at = now() WHERE id = $2',
      [amountMinor, receiverWallet.id]
    );

    const txResult = await client.query(
      `INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount_minor, status)
       VALUES ($1, $2, $3, 'SUCCESS') RETURNING reference, created_at`,
      [senderWallet.id, receiverWallet.id, amountMinor]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: senderUserId,
      action: 'TRANSFER_SUCCESS',
      ip,
      detail: { to: receiverUsername, amount, reference: txResult.rows[0].reference },
    });

    return res.status(201).json({
      message: `Transfer of ${amount} to ${receiverUsername} successful.`,
      reference: txResult.rows[0].reference,
      createdAt: txResult.rows[0].created_at,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer error:', err);
    return res.status(500).json({ error: 'Transfer failed. Please try again.' });
  } finally {
    client.release();
  }
}

/**
 * SEC: authorization scoping again — only transactions where the
 * authenticated user's wallet is sender OR receiver are returned. A user
 * can never pass another user's id/wallet id to see their history.
 */
async function getHistory(req, res) {
  try {
    const walletRes = await pool.query('SELECT id FROM wallets WHERE user_id = $1', [req.user.id]);
    if (walletRes.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }
    const walletId = walletRes.rows[0].id;

    const result = await pool.query(
      `SELECT t.reference, t.amount_minor, t.currency, t.status, t.created_at, t.failure_reason,
              su.username AS sender_username, ru.username AS receiver_username,
              CASE WHEN t.sender_wallet_id = $1 THEN 'DEBIT' ELSE 'CREDIT' END AS direction
       FROM transactions t
       LEFT JOIN wallets sw ON sw.id = t.sender_wallet_id
       LEFT JOIN users su ON su.id = sw.user_id
       LEFT JOIN wallets rw ON rw.id = t.receiver_wallet_id
       LEFT JOIN users ru ON ru.id = rw.user_id
       WHERE t.sender_wallet_id = $1 OR t.receiver_wallet_id = $1
       ORDER BY t.created_at DESC
       LIMIT 100`,
      [walletId]
    );

    const transactions = result.rows.map(r => ({
      reference: r.reference,
      amount: r.amount_minor / 100,
      currency: r.currency,
      status: r.status,
      direction: r.direction,
      counterparty: r.direction === 'DEBIT' ? r.receiver_username : r.sender_username,
      createdAt: r.created_at,
      failureReason: r.failure_reason,
    }));

    return res.json({ transactions });
  } catch (err) {
    console.error('Get history error:', err);
    return res.status(500).json({ error: 'Could not retrieve transaction history.' });
  }
}

module.exports = { transfer, getHistory };
