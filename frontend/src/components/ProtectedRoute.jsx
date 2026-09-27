import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// SEC: client-side route guard. This is a UX convenience only — it is NOT
// the actual security boundary. The real authorization enforcement lives
// server-side (requireAuth middleware + per-user scoped queries), since a
// client-side check can always be bypassed by a motivated user.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
