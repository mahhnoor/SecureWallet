import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  const body = (
    <div className="not-found">
      <h1>Page not found</h1>
      <p className="page-sub" style={{ marginBottom: '1.5rem' }}>
        That page doesn't exist or may have moved.
      </p>
      <Link className="btn" to={isAuthenticated ? '/dashboard' : '/login'}>
        {isAuthenticated ? 'Back to dashboard' : 'Back to login'}
      </Link>
    </div>
  );

  return isAuthenticated ? <Layout>{body}</Layout> : <div className="auth-shell">{body}</div>;
}
