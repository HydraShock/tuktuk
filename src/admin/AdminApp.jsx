import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import Dashboard from './Dashboard';
import { adminLogin, adminLogout, fetchAdminMe } from './api';
import './admin.css';

const ADMIN_TOKEN_KEY = 'tuk_admin_token';
const ADMIN_EMAIL_KEY = 'tuk_admin_email';
const ADMIN_EXPIRES_KEY = 'tuk_admin_expires_at';

const AdminAuthContext = createContext(null);

function readStoredSession() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  const email = localStorage.getItem(ADMIN_EMAIL_KEY) || '';
  const expiresAt = localStorage.getItem(ADMIN_EXPIRES_KEY) || '';
  if (!token || !email || !expiresAt) {
    return null;
  }
  if (new Date(expiresAt).getTime() <= Date.now()) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    localStorage.removeItem(ADMIN_EXPIRES_KEY);
    return null;
  }
  return { token, email, expiresAt };
}

function persistSession(session) {
  localStorage.setItem(ADMIN_TOKEN_KEY, session.token);
  localStorage.setItem(ADMIN_EMAIL_KEY, session.email);
  localStorage.setItem(ADMIN_EXPIRES_KEY, session.expiresAt);
}

function clearSessionStorage() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
  localStorage.removeItem(ADMIN_EXPIRES_KEY);
}

function AdminLoginScreen() {
  const navigate = useNavigate();
  const { session, login } = useAdminAuth();
  const [email, setEmail] = useState('admin.bab236@tuktukroma.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/admin', { replace: true });
    }
  }, [navigate, session]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Accesso non riuscito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <header>
          <h1>Hydra Dashboard</h1>
          <p>Accedi alla dashboard amministrativa protetta.</p>
        </header>

        <form onSubmit={onSubmit} className="admin-login-form">
          <label htmlFor="admin-email">
            <span>Email</span>
            <div className="admin-login-input">
              <Mail size={16} />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </label>

          <label htmlFor="admin-password">
            <span>Password</span>
            <div className="admin-login-input">
              <LockKeyhole size={16} />
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error ? <p className="admin-login-error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Accesso in corso...' : 'Accedi al pannello'}
          </button>
        </form>
      </section>
    </main>
  );
}

function RequireAdmin({ children }) {
  const { session, checking } = useAdminAuth();
  if (checking) {
    return (
      <main className="admin-loading-page">
        <p>Verifica autenticazione...</p>
      </main>
    );
  }
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) {
    throw new Error('useAdminAuth must be used within AdminAuthContext');
  }
  return value;
}

export default function AdminApp() {
  const [session, setSession] = useState(() => readStoredSession());
  const [checking, setChecking] = useState(Boolean(readStoredSession()));

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await adminLogout(session.token);
      } catch (error) {
        // Ignore logout network errors in client cleanup.
      }
    }
    clearSessionStorage();
    setSession(null);
    setChecking(false);
  }, [session]);

  const login = useCallback(async (email, password) => {
    const payload = await adminLogin(email, password);
    const nextSession = {
      token: payload.token,
      email: payload.email,
      expiresAt: payload.expiresAt,
    };
    persistSession(nextSession);
    setSession(nextSession);
    setChecking(false);
    return nextSession;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      if (!session?.token) {
        setChecking(false);
        return;
      }

      try {
        const me = await fetchAdminMe(session.token);
        if (cancelled) {
          return;
        }
        const refreshedSession = {
          token: session.token,
          email: me.email,
          expiresAt: me.expiresAt,
        };
        persistSession(refreshedSession);
        setSession(refreshedSession);
      } catch (error) {
        if (!cancelled) {
          clearSessionStorage();
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const authValue = useMemo(
    () => ({
      session,
      checking,
      login,
      logout,
    }),
    [checking, login, logout, session]
  );

  return (
    <AdminAuthContext.Provider value={authValue}>
      <Routes>
        <Route path="login" element={<AdminLoginScreen />} />
        <Route
          index
          element={(
            <RequireAdmin>
              <Dashboard />
            </RequireAdmin>
          )}
        />
        <Route path="*" element={<Navigate to={session ? '/admin' : '/admin/login'} replace />} />
      </Routes>
    </AdminAuthContext.Provider>
  );
}
