import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Users from './Users';
import Transactions from './Transactions';
import Navbar from './Navbar';
import Login from './Login';
import ResetPassword from './ResetPassword';
import Customer from './Customer';
import CashAccountUpload from './CashAccountUpload';
import Reports from './Reports';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('accounting_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('accounting_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('accounting_user');
  };

  if (loading) return null; // Or a loading spinner

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div>
        <Navbar onLogout={handleLogout} />
        <hr />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<Users />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/cash-account" element={<CashAccountUpload />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/customers" element={<Customer />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
