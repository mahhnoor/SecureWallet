import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSessionCountdown } from '../hooks/useSessionCountdown';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Layout({ children }) {
  const { logout, username, profile } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef(null);
  const secondsLeft = useSessionCountdown();

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const displayName = profile?.fullName || username;
  const showSessionWarning = secondsLeft !== null && secondsLeft <= 120;

  return (
    <div className="app-shell">
      <nav className="navbar">
        <Link to="/dashboard" className="brand">SecureWallet</Link>

        <button className="nav-burger" aria-label="Toggle menu" onClick={() => setNavOpen((o) => !o)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>

        <div className={`nav-links ${navOpen ? 'open' : ''}`}>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setNavOpen(false)}>Dashboard</NavLink>
          <NavLink to="/transfer" className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setNavOpen(false)}>Send</NavLink>
          <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setNavOpen(false)}>History</NavLink>

          {showSessionWarning && (
            <span className="nav-session">
              Session ends in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
          )}

          <div className="nav-user-menu" ref={menuRef}>
            <button className="nav-user-btn" onClick={() => setMenuOpen((o) => !o)}>
              <span className="nav-avatar">{initials(displayName)}</span>
              {displayName}
            </button>
            {menuOpen && (
              <div className="nav-dropdown">
                <div className="dd-header">
                  <div className="name">{displayName}</div>
                  {profile?.email && <div className="email">{profile.email}</div>}
                </div>
                <button onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
