import React, { useState } from 'react';
import axios from 'axios';

function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const url = isSignup ? '/api/auth/register' : '/api/auth/login';
      const { data } = await axios.post(url, { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      onLogin(data.username);
    } catch (err) {
      setError(err.response?.data?.message || (isSignup ? 'Sign up failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setError('');
    setConfirmPassword('');
  };

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', textAlign: 'left' }}>
      <h2>{isSignup ? 'Sign up' : 'Login'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={isSignup ? 8 : undefined}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {isSignup && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
          {loading ? (isSignup ? 'Signing up…' : 'Signing in…') : (isSignup ? 'Sign up' : 'Sign in')}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={toggleMode}
          style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          {isSignup ? 'Have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </p>
    </div>
  );
}

export default Login;
