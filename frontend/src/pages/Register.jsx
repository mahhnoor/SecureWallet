import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', email: '', fullName: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side confirmation check — a UX convenience only. The
    // authoritative password rules (min length, uppercase, number) are
    // still enforced server-side via express-validator regardless.
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await register(form);
    setSubmitting(false);

    if (result.ok) {
      toast.success('Account created. Please log in.');
      navigate('/login');
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-mark">SecureWallet</div>
        <h1>Create your wallet</h1>
        <p className="subtitle">Takes less than a minute</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" value={form.fullName} onChange={update('fullName')} required autoComplete="name" />
          </div>

          <div className="field">
            <label htmlFor="regUsername">Username</label>
            <input
              id="regUsername"
              name="username"
              value={form.username}
              onChange={update('username')}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              title="Letters, numbers and underscores only"
              autoComplete="username"
            />
            <p className="hint">3–30 characters: letters, numbers and underscores only.</p>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={form.email} onChange={update('email')} required autoComplete="email" />
          </div>

          <PasswordField
            id="regPassword"
            label="Password"
            value={form.password}
            onChange={update('password')}
            required
            minLength={8}
            hint="At least 8 characters, including an uppercase letter and a number."
            showStrength
            autoComplete="new-password"
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && <div className="alert error" role="alert">{error}</div>}

          <button type="submit" className="btn full" style={{ marginTop: '1.4rem' }} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="switch-link">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
