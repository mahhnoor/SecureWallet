import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { formatMoney, relativeTime } from '../utils/format';

function EyeIcon({ off }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(
    profile?.mfaEnabled === true
  );
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    setMfaEnabled(profile?.mfaEnabled === true);
  }, [profile?.mfaEnabled]);

  useEffect(() => {
    let mounted = true;

    client
      .get('/wallet/balance')
      .then(({ data }) => {
        if (mounted) {
          setWallet(data);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err.response?.data?.error || 'Could not load balance.'
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    client
      .get('/transactions/history')
      .then(({ data }) => {
        if (mounted) {
          setRecent(data.transactions.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setRecentLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function startMfaSetup() {
    setMfaLoading(true);
    setMfaError('');
    setMfaMessage('');

    try {
      const { data } = await client.post('/auth/mfa/setup');
      setMfaSetup(data);
    } catch (err) {
      setMfaError(
        err.response?.data?.error || 'Could not start MFA setup.'
      );
    } finally {
      setMfaLoading(false);
    }
  }

  async function verifyMfaSetup() {
    setMfaLoading(true);
    setMfaError('');
    setMfaMessage('');

    try {
      const { data } = await client.post('/auth/mfa/verify-setup', {
        code: mfaCode,
      });

      setMfaMessage(data.message);
      setMfaCode('');
      setMfaSetup(null);

      // Immediately update the dashboard UI.
      setMfaEnabled(true);

      // Close the modal shortly after successful setup.
      setTimeout(() => {
        setMfaModalOpen(false);
        setMfaMessage('');
      }, 1000);
    } catch (err) {
      setMfaError(
        err.response?.data?.error || 'Could not verify MFA code.'
      );
    } finally {
      setMfaLoading(false);
    }
  }

  function openMfaModal() {
    setMfaModalOpen(true);
    setMfaError('');
    setMfaMessage('');
    setMfaSetup(null);
    setMfaCode('');
  }

  function closeMfaModal() {
    if (mfaLoading) return;

    setMfaModalOpen(false);
    setMfaError('');
    setMfaMessage('');
    setMfaSetup(null);
    setMfaCode('');
  }

  const displayName =
    profile?.fullName?.split(' ')[0] || username;

  return (
    <Layout>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1>Welcome, {displayName}</h1>
          <p className="page-sub">
            Here's where things stand today.
          </p>
        </div>

        {/* Small MFA status / setup link */}
        {!mfaEnabled ? (
          <button
            type="button"
            onClick={openMfaModal}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#a9b8c4',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.35rem 0',
              whiteSpace: 'nowrap',
            }}
          >
            2FA not enabled · Set up
          </button>
        ) : (
          <span
            style={{
              color: '#a9b8c4',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              opacity: 0.8,
            }}
          >
            ✓ 2FA enabled
          </span>
        )}
      </div>

      {/* BALANCE */}
      <div className="statement-panel">
        <div className="statement-top">
          <div>
            <p className="statement-label">Available balance</p>

            {loading && (
              <p style={{ color: '#a9b8c4' }}>
                Loading…
              </p>
            )}

            {error && (
              <p style={{ color: '#f3b3b0' }}>
                {error}
              </p>
            )}

            {wallet && (
              <div className="balance-row">
                <span className="balance-amount">
                  {hidden
                    ? '••••••'
                    : formatMoney(
                        wallet.balance,
                        wallet.currency
                      )}
                </span>

                <span className="balance-currency">
                  {wallet.currency}
                </span>

                <button
                  className="balance-toggle"
                  onClick={() =>
                    setHidden((h) => !h)
                  }
                  aria-label={
                    hidden
                      ? 'Show balance'
                      : 'Hide balance'
                  }
                >
                  <EyeIcon off={hidden} />
                </button>
              </div>
            )}
          </div>
        </div>

        {wallet && (
          <p className="statement-updated">
            Updated {relativeTime(wallet.updatedAt)}
          </p>
        )}

        <div className="statement-actions">
          <Link
            className="btn accent"
            to="/transfer"
          >
            Send money
          </Link>

          <Link
            className="btn secondary"
            to="/history"
          >
            View history
          </Link>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="section-head">
        <h2>Recent activity</h2>

        <Link
          to="/history"
          className="btn-plain"
        >
          View all
        </Link>
      </div>

      {recentLoading && (
        <div className="ledger">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      )}

      {!recentLoading && recent.length === 0 && (
        <div className="empty-state">
          <p>No activity yet</p>
          <p>
            Send your first transfer to see it show up here.
          </p>
        </div>
      )}

      {!recentLoading && recent.length > 0 && (
        <div className="ledger">
          {recent.map((tx) => (
            <div
              className="ledger-row"
              key={tx.reference}
            >
              <div
                className={`ledger-icon ${
                  tx.direction === 'DEBIT'
                    ? 'debit'
                    : 'credit'
                }`}
              >
                {tx.direction === 'DEBIT'
                  ? '↑'
                  : '↓'}
              </div>

              <div className="ledger-main">
                <div className="ledger-counterparty">
                  {tx.counterparty || 'Unknown'}
                </div>

                <div className="ledger-meta">
                  {tx.direction === 'DEBIT'
                    ? 'Sent'
                    : 'Received'}{' '}
                  · {relativeTime(tx.createdAt)}
                </div>
              </div>

              <div
                className={`ledger-amount ${
                  tx.direction === 'DEBIT'
                    ? 'debit'
                    : 'credit'
                }`}
              >
                {tx.direction === 'DEBIT'
                  ? '-'
                  : '+'}
                {tx.currency}{' '}
                {formatMoney(
                  tx.amount,
                  tx.currency
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MFA SETUP MODAL */}
{mfaModalOpen && (
  <div
    onClick={closeMfaModal}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      zIndex: 1000,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: '#18232d',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      {/* Modal header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#ffffff',
            }}
          >
            Two-factor authentication
          </h2>

          <p
            style={{
              marginTop: '0.5rem',
              color: '#d7e0e7',
            }}
          >
            Protect your wallet with an authenticator app.
          </p>
        </div>

        <button
          type="button"
          onClick={closeMfaModal}
          disabled={mfaLoading}
          aria-label="Close"
          style={{
            border: 'none',
            background: 'transparent',
            color: '#ffffff',
            fontSize: '1.5rem',
            cursor: mfaLoading ? 'not-allowed' : 'pointer',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Before QR code is generated */}
      {!mfaSetup && (
        <div>
          <p style={{ color: '#ffffff' }}>
            Two-factor authentication adds an extra login step after your
            password.
          </p>

          <p
            style={{
              marginTop: '0.75rem',
              color: '#d7e0e7',
            }}
          >
            You will scan a QR code using Google Authenticator or another
            compatible authenticator app.
          </p>

          <button
            className="btn accent"
            onClick={startMfaSetup}
            disabled={mfaLoading}
            style={{
              marginTop: '1.25rem',
            }}
          >
            {mfaLoading ? 'Preparing…' : 'Continue setup'}
          </button>
        </div>
      )}

      {/* QR code setup */}
      {mfaSetup && (
        <div>
          <p
            style={{
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            1. Scan this QR code
          </p>

          <p
            style={{
              marginTop: '0.4rem',
              color: '#d7e0e7',
            }}
          >
            Open Google Authenticator and scan the QR code below.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '1.25rem 0',
            }}
          >
            <img
              src={mfaSetup.qrCode}
              alt="MFA setup QR code"
              style={{
                width: '220px',
                height: '220px',
                background: '#ffffff',
                padding: '10px',
                borderRadius: '8px',
              }}
            />
          </div>

          <p
            style={{
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            2. Enter the 6-digit code
          </p>

          <p
            style={{
              marginTop: '0.4rem',
              color: '#d7e0e7',
            }}
          >
            Enter the current code shown in your authenticator app to confirm
            the setup.
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength="6"
            value={mfaCode}
            onChange={(e) =>
              setMfaCode(e.target.value.replace(/\D/g, ''))
            }
            placeholder="123456"
            autoComplete="one-time-code"
            style={{
              width: '100%',
              marginTop: '1rem',
              padding: '0.75rem',
              fontSize: '1.1rem',
              letterSpacing: '0.25rem',
              textAlign: 'center',
              color: '#111827',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />

          <button
            className="btn accent"
            onClick={verifyMfaSetup}
            disabled={mfaLoading || mfaCode.length !== 6}
            style={{
              marginTop: '1rem',
              width: '100%',
            }}
          >
            {mfaLoading ? 'Verifying…' : 'Verify and enable 2FA'}
          </button>
        </div>
      )}

      {/* Success message */}
      {mfaMessage && (
        <div
          className="alert"
          role="status"
          style={{
            marginTop: '1rem',
            color: '#ffffff',
          }}
        >
          {mfaMessage}
        </div>
      )}

      {/* Error message */}
      {mfaError && (
        <div
          className="alert error"
          role="alert"
          style={{
            marginTop: '1rem',
          }}
        >
          {mfaError}
        </div>
      )}
    </div>
  </div>
)}

      </Layout>
    );
}
