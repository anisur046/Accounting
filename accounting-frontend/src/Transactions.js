import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Transactions.css';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    amount: '',
    type: 'income',
    description: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    date: today
  });

  useEffect(() => {
    fetch('http://localhost:3001/api/transactions')
      .then(res => res.json())
      .then(setTransactions);

    fetch('http://localhost:3001/api/customers')
      .then(res => res.json())
      .then(setCustomers);
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === 'customerName') {
      setSearchTerm(value);
      setShowResults(true);
    }
  };

  const handleSelectCustomer = (customer) => {
    setForm({
      ...form,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.address
    });
    setSearchTerm(customer.name);
    setShowResults(false);
  };

  const handleSubmit = e => {
    e.preventDefault();
    fetch('http://localhost:3001/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then(res => res.json())
      .then(tx => {
        setTransactions([...transactions, tx]);
        setForm({
          amount: '',
          type: 'income',
          description: '',
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          customerAddress: '',
          date: today
        });
        setSearchTerm('');
      });
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="transactions-bg">
      <div className="transactions-container">
        <h2>Transactions</h2>
        <form className="transactions-form" onSubmit={handleSubmit}>
          <div className="search-container">
            <input
              name="customerName"
              placeholder="Search Customer Name"
              value={form.customerName}
              onChange={handleChange}
              onFocus={() => setShowResults(true)}
              autoComplete="off"
            />
            {showResults && searchTerm && filteredCustomers.length > 0 && (
              <div className="search-results">
                {filteredCustomers.map(c => (
                  <div key={c.id} onClick={() => handleSelectCustomer(c)}>
                    {c.name} ({c.email})
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="transaction-row">
            <input name="customerEmail" placeholder="Customer Email" value={form.customerEmail} onChange={handleChange} readOnly />
            <input name="customerPhone" placeholder="Customer Phone" value={form.customerPhone} onChange={handleChange} readOnly />
          </div>
          <input name="customerAddress" placeholder="Customer Address" value={form.customerAddress} onChange={handleChange} readOnly />

          <div className="transaction-row">
            <div className="form-group-inline">
              <label>Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div className="form-group-inline">
              <label>Amount</label>
              <input name="amount" placeholder="Amount" value={form.amount} onChange={handleChange} required />
            </div>
          </div>
          <div className="transaction-row">
            <div className="form-group-inline">
              <label>Type</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="form-group-inline">
              <label>Description</label>
              <input name="description" placeholder="Description" value={form.description} onChange={handleChange} />
            </div>
          </div>

          <button type="submit">Add Transaction</button>
        </form>
      </div>
    </div>
  );
}

export default Transactions;
