import React, { useState } from 'react';
import Users from './Users';
import Transactions from './Transactions';
import Reports from './Reports';

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      <h1>Accounting Software</h1>
      <nav>
        <button onClick={() => setPage('dashboard')}>Dashboard</button>
        <button onClick={() => setPage('users')}>Users</button>
        <button onClick={() => setPage('transactions')}>Transactions</button>
        <button onClick={() => setPage('reports')}>Reports</button>
      </nav>
      <div>
        {page === 'dashboard' && <p>Welcome to your accounting dashboard.</p>}
        {page === 'users' && <Users />}
        {page === 'transactions' && <Transactions />}
        {page === 'reports' && <Reports />}
      </div>
    </div>
  );
}

export default App;
