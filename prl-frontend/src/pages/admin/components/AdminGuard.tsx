/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getAdminPassword, setAdminPassword, clearAdminPassword } from '../utils/adminAuth';

const API_URL = import.meta.env.VITE_ADMIN_API_URL;
const SESSION_KEY = 'admin-authenticated';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for existing session — require both the flag and the stored password
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === 'true' && getAdminPassword()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthenticated(true);
    } else {
      // Clear stale session without a stored password
      sessionStorage.removeItem(SESSION_KEY);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (username !== 'admin') {
      setError('Invalid username');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        setAdminPassword(password);
        sessionStorage.setItem(SESSION_KEY, 'true');
        setAuthenticated(true);
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Login failed — check your connection');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    clearAdminPassword();
    setAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="p-8 rounded-xl w-full max-w-md"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <h1 className="text-xl font-bold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
            Admin Login
          </h1>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-base"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-base"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm mb-4" style={{ color: '#ef4444' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'Checking...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-authenticated" data-logout={handleLogout}>
      {children}
    </div>
  );
}

export function useAdminLogout() {
  return () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  };
}
