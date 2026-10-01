import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const {
    login,
    verifyLoginMfa,
  } = useAuth();

  const toast = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState(null);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(e) {
    e.preventDefault();

    setError('');
    setSubmitting(true);

    const result = await login(username, password);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.mfaRequired) {
      setMfaChallenge(result.mfaChallenge);
      setMfaCode('');
      return;
    }

    toast.success(`Welcome back, ${username}.`);
    navigate('/dashboard');
  }

  async function handleMfaSubmit(e) {
    e.preventDefault();

    setError('');

    if (mfaCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setSubmitting(true);

    const result = await verifyLoginMfa(
      mfaChallenge,
      mfaCode
    );

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(`Welcome back, ${username}.`);
    navigate('/dashboard');
  }

  if (mfaChallenge) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-mark">SecureWallet</div>

          <h1>Two-factor authentication</h1>

          <p className="subtitle">
            Enter the 6-digit code from your authenticator app.
          </p>

          <form onSubmit={handleMfaSubmit} noValidate>
            <div className="field">
              <label htmlFor="mfaCode">
                Authentication code
              </label>

              <input
                id="mfaCode"
                name="mfaCode"
                type="text"
                inputMode="numeric"
                maxLength="6"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(
                    e.target.value.replace(/\D/g, '')
                  )
                }
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn full"
              style={{ marginTop: '1.4rem' }}
              disabled={submitting || mfaCode.length !== 6}
            >
              {submitting
                ? 'Verifying…'
                : 'Verify and log in'}
            </button>
          </form>

          <p
            className="switch-link"
            style={{ marginTop: '1rem' }}
          >
            Open your authenticator app to get the current code.
          </p>

          <button
            type="button"
            className="btn-plain"
            onClick={() => {
              setMfaChallenge(null);
              setMfaCode('');
              setError('');
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-mark">SecureWallet</div>

        <h1>Log in</h1>

        <p className="subtitle">
          Access your account
        </p>

        <form
          onSubmit={handlePasswordSubmit}
          noValidate
        >
          <div className="field">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              name="username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn full"
            style={{ marginTop: '1.4rem' }}
            disabled={submitting}
          >
            {submitting
              ? 'Logging in…'
              : 'Log in'}
          </button>
        </form>

        <p className="switch-link">
          No account?{' '}
          <Link to="/register">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}