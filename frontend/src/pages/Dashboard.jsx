import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { formatMoney, relativeTime } from '../utils/format';

function EyeIcon({ off }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function Dashboard() {
  const { username, profile } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    client.get('/wallet/balance')
      .then(({ data }) => { if (mounted) setWallet(data); })
      .catch((err) => { if (mounted) setError(err.response?.data?.error || 'Could not load balance.'); })
      .finally(() => { if (mounted) setLoading(false); });

    client.get('/transactions/history')
      .then(({ data }) => { if (mounted) setRecent(data.transactions.slice(0, 3)); })
      .catch(() => {})
      .finally(() => { if (mounted) setRecentLoading(false); });

    return () => { mounted = false; };
  }, []);

  const displayName = profile?.fullName?.split(' ')[0] || username;

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Welcome, {displayName}</h1>
          <p className="page-sub">Here's where things stand today.</p>
        </div>
      </div>

      <div className="statement-panel">
        <div className="statement-top">
          <div>
            <p className="statement-label">Available balance</p>
            {loading && <p style={{ color: '#a9b8c4' }}>Loading…</p>}
            {error && <p style={{ color: '#f3b3b0' }}>{error}</p>}
            {wallet && (
              <div className="balance-row">
                <span className="balance-amount">
                  {hidden ? '••••••' : formatMoney(wallet.balance, wallet.currency)}
                </span>
                <span className="balance-currency">{wallet.currency}</span>
                <button className="balance-toggle" onClick={() => setHidden((h) => !h)} aria-label={hidden ? 'Show balance' : 'Hide balance'}>
                  <EyeIcon off={hidden} />
                </button>
              </div>
            )}
          </div>
        </div>
        {wallet && <p className="statement-updated">Updated {relativeTime(wallet.updatedAt)}</p>}
        <div className="statement-actions">
          <Link className="btn accent" to="/transfer">Send money</Link>
          <Link className="btn secondary" to="/history">View history</Link>
        </div>
      </div>

      <div className="section-head">
        <h2>Recent activity</h2>
        <Link to="/history" className="btn-plain">View all</Link>
      </div>

      {recentLoading && (
        <div className="ledger">
          <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
        </div>
      )}

      {!recentLoading && recent.length === 0 && (
        <div className="empty-state">
          <p>No activity yet</p>
          <p>Send your first transfer to see it show up here.</p>
        </div>
      )}

      {!recentLoading && recent.length > 0 && (
        <div className="ledger">
          {recent.map((tx) => (
            <div className="ledger-row" key={tx.reference}>
              <div className={`ledger-icon ${tx.direction === 'DEBIT' ? 'debit' : 'credit'}`}>
                {tx.direction === 'DEBIT' ? '↑' : '↓'}
              </div>
              <div className="ledger-main">
                <div className="ledger-counterparty">{tx.counterparty || 'Unknown'}</div>
                <div className="ledger-meta">{tx.direction === 'DEBIT' ? 'Sent' : 'Received'} · {relativeTime(tx.createdAt)}</div>
              </div>
              <div className={`ledger-amount ${tx.direction === 'DEBIT' ? 'debit' : 'credit'}`}>
                {tx.direction === 'DEBIT' ? '-' : '+'}{tx.currency} {formatMoney(tx.amount, tx.currency)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
