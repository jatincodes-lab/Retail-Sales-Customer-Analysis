import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import LoadingButton from '../components/LoadingButton';
import useActionLoading from '../hooks/useActionLoading';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { run, isLoading } = useActionLoading();
  const { login, user, isReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isReady && user) navigate('/', { replace: true });
  }, [isReady, user, navigate]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your username and password.');
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="RetailIQ introduction">
        <div className="login-brand-logo">
          <span className="login-brand-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M7 20.5 10.5 9h27L41 20.5M8 20.5h32v20H8zM18 40.5V28h12v12.5M7 20.5a6 6 0 0 0 12 0 6 6 0 0 0 12 0 6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>RetailIQ</span>
        </div>

        <div className="login-brand-message">
          <p className="login-brand-kicker">RETAIL, WITH CLARITY</p>
          <h1>Every sale<br />tells a story.</h1>
          <p>Understand your sales and customers with clarity, so you can grow with confidence.</p>
        </div>

        <p className="login-brand-footer">SALES · CUSTOMERS · INVENTORY</p>
        <div className="login-brand-orbit login-brand-orbit-one" aria-hidden="true" />
        <div className="login-brand-orbit login-brand-orbit-two" aria-hidden="true" />
      </section>

      <section className="login-panel" aria-label="Sign in">
        <div className="login-form-shell">
          <p className="login-eyebrow">WELCOME BACK</p>
          <h2>Sign in to your account</h2>
          <p className="login-intro">Enter your RetailIQ username and password to continue.</p>

          <form className="login-form" onSubmit={run('login', handleSubmit)}>
            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input id="login-username" className="form-input" autoComplete="username"
                placeholder="Enter your username" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-password-wrap">
                <input id="login-password" className="form-input" type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="Enter your password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required />
                <button type="button" className="login-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="2.7" />
                    {showPassword && <path d="m4 4 16 16" />}
                  </svg>
                </button>
              </div>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}
            <LoadingButton type="submit" className="login-submit" loading={isLoading('login')}
              disabled={!isReady} loadingLabel="Signing in…">Sign in</LoadingButton>
          </form>
        </div>

        <footer className="login-copyright">Copyright {new Date().getFullYear()} RetailIQ</footer>
      </section>
    </main>
  );
}
