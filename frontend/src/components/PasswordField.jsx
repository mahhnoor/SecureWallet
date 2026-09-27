import React, { useState } from 'react';

// Small eye / eye-off icons inlined as SVG so the project has zero extra
// icon-library dependency to install.
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

export default function PasswordField({ id, label, value, onChange, hint, showStrength, required, minLength, autoComplete }) {
  const [visible, setVisible] = useState(false);

  const strength = showStrength ? scoreStrength(value) : null;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-row">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
      {showStrength && value && (
        <div className="strength-meter" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < strength.level ? `filled ${strength.label}` : ''} />
          ))}
        </div>
      )}
    </div>
  );
}

function scoreStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (password.length >= 12 && /[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['weak', 'fair', 'strong'];
  return { level: score, label: labels[Math.max(score - 1, 0)] };
}
