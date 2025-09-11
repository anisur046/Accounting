import React, { useState } from 'react';

function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const resetFields = () => {
    setName(''); setEmail(''); setPassword(''); setError(''); setSuccess('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        setError('Invalid server response');
        setLoading(false);
        return;
      }
      if (res.ok && data.user) {
        setSuccess('Login successful!');
        if (typeof onLogin === 'function') onLogin(data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Registration successful! You can now log in.');
        setMode('login');
        resetFields();
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('http://localhost:3001/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      // Always show a generic message for security
      setSuccess('If your email exists, a reset link has been sent. Please check your inbox.');
      setMode('login');
      resetFields();
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="login-container">
      <style>{`
        .login-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
          justify-content: center;
          /* Responsive background image */
          background: url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1500&q=80') no-repeat center center fixed;
          background-size: cover;
        }
        .login-overlay {
          background: rgba(255,255,255,0.85);
          border-radius: 12px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.08);
          padding: 32px 24px;
          margin-top: 40px;
        }
        .login-tabs {
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .login-tabs button {
          padding: 8px 16px;
          border: 1px solid #ccc;
          background: #fff;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .login-tabs button.active {
          background: #007bff;
          color: #fff;
          border-color: #007bff;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          width: 350px;
          max-width: 90vw;
          background: transparent;
          padding: 0;
          border-radius: 8px;
          box-shadow: none;
        }
        .login-form input {
          margin-bottom: 14px;
          padding: 10px;
          font-size: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .login-form button[type="submit"] {
          padding: 10px;
          background: #007bff;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          cursor: pointer;
          margin-top: 4px;
        }
        .login-form button[type="submit"]:hover {
          background: #0056b3;
        }
        .login-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
        }
        .secondary-btn {
          background: #f1f1f1;
          color: #007bff;
          border: 1px solid #007bff;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .secondary-btn:hover {
          background: #007bff;
          color: #fff;
        }
        .left-btn {
          margin-right: 8px;
        }
        .right-btn {
          margin-left: 8px;
        }
        .login-message {
          margin-top: 12px;
          font-size: 1rem;
        }
        @media (max-width: 500px) {
          .login-form {
            padding: 0;
            width: 100%;
          }
          .login-overlay {
            padding: 18px 6vw;
          }
          .login-actions {
            flex-direction: column;
            gap: 8px;
          }
          .left-btn, .right-btn {
            margin: 0;
          }
        }
      `}</style>
      <div className="login-overlay">
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
            <div className="login-actions">
              <button type="button" onClick={() => { setMode('register'); resetFields(); }} className="secondary-btn left-btn" disabled={loading}>Register</button>
              <button type="button" onClick={() => { setMode('forgot'); resetFields(); }} className="secondary-btn right-btn" disabled={loading}>Forgot Password</button>
            </div>
          </form>
        )}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="submit">Register</button>
          </form>
        )}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="login-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit">Send Reset Link</button>
          </form>
        )}
        {error && <div className="login-message" style={{ color: 'red' }}>{error}</div>}
        {success && <div className="login-message" style={{ color: 'green' }}>{success}</div>}
      </div>
    </div>
  );
}

export default Login;
