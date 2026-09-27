import React, { useState, useEffect } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { formatMoney } from '../utils/format';

export default function Transfer() {
  const toast = useToast();
  const [step, setStep] = useState('form'); // 'form' | 'review' | 'done'
  const [receiverUsername, setReceiverUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState('PKR');

  useEffect(() => {
    client.get('/wallet/balance').then(({ data }) => setCurrency(data.currency)).catch(() => {});
  }, []);

  function handleReview(e) {
    e.preventDefault();
    setError('');
    setStep('review');
  }

  async function handleConfirm() {
    setError('');
    setSubmitting(true);
    try {
      const { data } = await client.post('/transactions/transfer', { receiverUsername, amount });
      setResult(data);
      setStep('done');
      toast.success('Transfer sent.');
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details ? details.map((d) => d.message).join(' ') : (err.response?.data?.error || 'Transfer failed.'));
      setStep('form'); // let them fix the recipient/amount rather than retry blindly
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setReceiverUsername('');
    setAmount('');
    setResult(null);
    setError('');
    setStep('form');
  }

  function copyReference() {
    navigator.clipboard?.writeText(result.reference);
    toast.info('Reference copied.');
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Send money</h1>
          <p className="page-sub">Transfer to any registered SecureWallet user.</p>
        </div>
      </div>

      {step === 'form' && (
        <form className="form-card" onSubmit={handleReview} noValidate>
          <div className="field">
            <label htmlFor="receiver">Recipient username</label>
            <input
              id="receiver"
              value={receiverUsername}
              onChange={(e) => setReceiverUsername(e.target.value)}
              required
              pattern="[a-zA-Z0-9_]{3,30}"
              title="3-30 characters: letters, numbers and underscores"
            />
          </div>

          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {error && <div className="alert error" role="alert">{error}</div>}

          <button type="submit" className="btn full" style={{ marginTop: '1.4rem' }}>
            Review transfer
          </button>
        </form>
      )}

      {step === 'review' && (
        <div className="form-card review-block">
          <div className="review-hero">
            <div className="amt">{currency} {formatMoney(Number(amount) || 0)}</div>
            <div className="to">to <strong>@{receiverUsername}</strong></div>
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>
            Double-check the username — transfers can't be reversed once sent.
          </p>
          <div className="review-actions">
            <button className="btn secondary" onClick={() => setStep('form')} disabled={submitting}>Edit</button>
            <button className="btn accent" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Sending…' : 'Confirm & send'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="form-card review-block">
          <div className="review-hero">
            <div className="amt">{currency} {formatMoney(Number(amount))}</div>
            <div className="to">sent to <strong>@{receiverUsername}</strong></div>
          </div>
          <div className="alert success">Transfer completed successfully.</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Reference: {result.reference}{' '}
            <button className="copy-btn" onClick={copyReference}>Copy</button>
          </div>
          <div className="review-actions">
            <button className="btn secondary" onClick={startOver}>Send another</button>
          </div>
        </div>
      )}
    </Layout>
  );
}
