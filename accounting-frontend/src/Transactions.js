import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({ amount: '', type: 'income', description: '' });

  useEffect(() => {
    fetch('http://localhost:3001/api/transactions')
      .then(res => res.json())
      .then(setTransactions);
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = e => {
    e.preventDefault();
    fetch('http://localhost:3001/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then(res => res.json())
      .then(tx => setTransactions([...transactions, tx]));
  };

  return (
    <div>
      <h2>Transactions</h2>
      <form onSubmit={handleSubmit}>
        <input name="amount" placeholder="Amount" value={form.amount} onChange={handleChange} />
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input name="description" placeholder="Description" value={form.description} onChange={handleChange} />
        <button type="submit">Add Transaction</button>
      </form>
      <ul>
        {transactions.map(tx => (
          <li key={tx.id}>{tx.type}: ${tx.amount} - {tx.description}</li>
        ))}
      </ul>
    </div>
  );
}

export default Transactions;
