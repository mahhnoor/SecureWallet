import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

// BUGFIX: the original version kept a single `error` string in this
// top-level context and had both Login and Register write to it. Because
// context state persists across route changes, a failed registration
// attempt would still be showing on the Login page the moment you
// navigated there (and vice versa) — before you'd even submitted
// anything. Fixed by no longer keeping any error state here at all:
// login()/register() now resolve to { ok, error } and each page keeps
// its own local error state, scoped to that page only.

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() => sessionStorage.getItem('username'));
  const [profile, setProfile] = useState(null); // { id, username, email, fullName, memberSince }

  const refreshProfile = useCallback(async () => {
    if (!sessionStorage.getItem('token')) return;
    try {
      const { data } = await client.get('/auth/me');
      setProfile(data);
    } catch {
      // 401s are already handled globally by the axios interceptor
      // (clears session + redirects to /login), so nothing to do here.
    }
  }, []);

  // On first load, if a session already exists (e.g. page refresh), fetch
  // the full profile in the background. `username` itself already comes
  // from sessionStorage synchronously above, so there's no flash/redirect
  // while this resolves — it only fills in fullName/email for display.
  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (usernameInput, password) => {
    try {
      const { data } = await client.post('/auth/login', { username: usernameInput, password });
      // SEC: token kept in sessionStorage, not localStorage — it is cleared
      // when the tab closes, limiting the window an attacker (e.g. via a
      // later XSS bug) has to steal a lingering session. This is a
      // mitigation, not a substitute for output-encoding/XSS prevention.
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('username', data.user.username);
      setUsername(data.user.username);
      refreshProfile();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || 'Login failed.' };
    }
  }, [refreshProfile]);

  const register = useCallback(async (payload) => {
    try {
      await client.post('/auth/register', payload);
      return { ok: true };
    } catch (err) {
      const details = err.response?.data?.details;
      const message = details?.length
        ? details.map((d) => d.message).join(' ')
        : (err.response?.data?.error || 'Registration failed.');
      return { ok: false, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    setUsername(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        username,
        profile,
        isAuthenticated: !!username,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
