import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      console.log('call')
      const data = await res.json();
      if (res.ok) {
        setSuccess('Password reset successful! You can now log in.');
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(data.message || 'Password reset failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
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
        }
      `}</style>
      <div className="login-overlay">
        <h2>Reset Password</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
        </form>
        {error && <div className="login-message" style={{ color: 'red' }}>{error}</div>}
        {success && <div className="login-message" style={{ color: 'green' }}>{success}</div>}
      </div>
    </div>
  );
}

export default ResetPassword;
