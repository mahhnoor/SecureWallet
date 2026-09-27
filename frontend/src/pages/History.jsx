import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { formatMoney, relativeTime } from '../utils/format';

export default function History() {
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState('all'); // all | DEBIT | CREDIT

  useEffect(() => {
    client.get('/transactions/history')
      .then(({ data }) => setTransactions(data.transactions))
      .catch((err) => setError(err.response?.data?.error || 'Could not load transactions.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (direction !== 'all' && tx.direction !== direction) return false;
      if (query && !(tx.counterparty || '').toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [transactions, query, direction]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.status !== 'SUCCESS') return acc;
        if (tx.direction === 'DEBIT') acc.sent += tx.amount;
        else acc.received += tx.amount;
        return acc;
      },
      { sent: 0, received: 0 }
    );
  }, [transactions]);

  function copyRef(ref) {
    navigator.clipboard?.writeText(ref);
    toast.info('Reference copied.');
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Transaction history</h1>
          <p className="page-sub">Every transfer in or out of your wallet.</p>
        </div>
      </div>

      {!loading && !error && transactions.length > 0 && (
        <div className="summary-strip">
          <div className="summary-item credit">
            <div className="n">+{transactions[0].currency} {formatMoney(totals.received)}</div>
            <div className="l">Total received</div>
          </div>
          <div className="summary-item debit">
            <div className="n">-{transactions[0].currency} {formatMoney(totals.sent)}</div>
            <div className="l">Total sent</div>
          </div>
        </div>
      )}

      {!loading && !error && transactions.length > 0 && (
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search by counterparty…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search transactions"
          />
          <div className="chip-group">
            <button className={`chip ${direction === 'all' ? 'active' : ''}`} onClick={() => setDirection('all')}>All</button>
            <button className={`chip ${direction === 'DEBIT' ? 'active' : ''}`} onClick={() => setDirection('DEBIT')}>Sent</button>
            <button className={`chip ${direction === 'CREDIT' ? 'active' : ''}`} onClick={() => setDirection('CREDIT')}>Received</button>
          </div>
        </div>
      )}

      {loading && (
        <div className="ledger">
          <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
        </div>
      )}

      {error && <div className="alert error" role="alert">{error}</div>}

      {!loading && !error && transactions.length === 0 && (
        <div className="empty-state">
          <p>No transactions yet</p>
          <p>Sent and received transfers will appear here.</p>
        </div>
      )}

      {!loading && !error && transactions.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <p>No matches</p>
          <p>Try a different search or filter.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="ledger">
          {filtered.map((tx) => (
            <div className="ledger-row" key={tx.reference}>
              <div className={`ledger-icon ${tx.direction === 'DEBIT' ? 'debit' : 'credit'}`}>
                {tx.direction === 'DEBIT' ? '↑' : '↓'}
              </div>
              <div className="ledger-main">
                <div className="ledger-counterparty">{tx.counterparty || '—'}</div>
                <div className="ledger-meta">
                  {new Date(tx.createdAt).toLocaleString()} · {relativeTime(tx.createdAt)}
                  {' · '}
                  <button className="copy-btn" onClick={() => copyRef(tx.reference)}>Copy ref</button>
                </div>
                {tx.failureReason && <div className="ledger-meta" style={{ color: 'var(--danger)' }}>{tx.failureReason.replaceAll('_', ' ').toLowerCase()}</div>}
              </div>
              <div className="ledger-status">
                <div className={`ledger-amount ${tx.direction === 'DEBIT' ? 'debit' : 'credit'}`}>
                  {tx.direction === 'DEBIT' ? '-' : '+'}{tx.currency} {formatMoney(tx.amount, tx.currency)}
                </div>
                <span className={`status-badge ${tx.status.toLowerCase()}`}>{tx.status.toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
