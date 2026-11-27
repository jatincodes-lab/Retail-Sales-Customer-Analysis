import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import LoadingButton from '../components/LoadingButton';
import useActionLoading from '../hooks/useActionLoading';

export default function Login() {
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const { run, isLoading } = useActionLoading();
  const { login, user, isReady } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (isReady && user) navigate('/', { replace: true });
  }, [isReady, user, navigate]);

  const handleSubmit = async e => {
    e.preventDefault(); setError('');
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏪</div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>RetailMS</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Retail Management System</p>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Sign In</h3>
          <form onSubmit={run('login', handleSubmit)}>
            <div className="form-group">
              <label>Username</label>
              <input className="form-input" placeholder="Username"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <LoadingButton type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} loading={isLoading('login')} disabled={!isReady} loadingLabel="Signing in…">Sign In</LoadingButton>
          </form>
          <p style={{ marginTop: 20, color: '#64748b', fontSize: 12, textAlign: 'center' }}>
            Contact your administrator to request an account.
          </p>
        </div>
      </div>
    </div>
  );
}
