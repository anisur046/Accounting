import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Users from './Users';
import Transactions from './Transactions';
import Reports from './Reports';
import Navbar from './Navbar';
import Login from './Login';
import ResetPassword from './ResetPassword';
import Customer from './Customer';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
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
          <Route path="/reports" element={<Reports />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/customers" element={<Customer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
