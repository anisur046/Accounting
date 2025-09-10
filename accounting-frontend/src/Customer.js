import React, { useEffect, useState } from 'react';

function Customer() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCustomers = async () => {
    const res = await fetch('http://localhost:3001/api/customers');
    setCustomers(await res.json());
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch(`http://localhost:3001/api/customers${editingId ? '/' + editingId : ''}`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      if (!res.ok) throw new Error((await res.json()).message);
      setSuccess(editingId ? 'Customer updated!' : 'Customer added!');
      setForm({ name: '', email: '', phone: '', address: '' });
      setEditingId(null);
      fetchCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = customer => {
    setForm({ name: customer.name, email: customer.email, phone: customer.phone, address: customer.address });
    setEditingId(customer.id);
    setError(''); setSuccess('');
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this customer?')) return;
    await fetch(`http://localhost:3001/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
  };

  return (
    <div className="customer-container">
      <style>{`
        .customer-container { max-width: 900px; margin: 0 auto; padding: 24px; }
        .customer-form { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 24px; margin-bottom: 32px; }
        .customer-form input, .customer-form textarea { width: 100%; margin-bottom: 12px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
        .customer-form button { background: #007bff; color: #fff; border: none; border-radius: 4px; padding: 10px 20px; cursor: pointer; }
        .customer-form button:hover { background: #0056b3; }
        .customer-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px #0001; }
        .customer-table th, .customer-table td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; }
        .customer-table th { background: #f8f9fa; }
        .customer-table tr:last-child td { border-bottom: none; }
        .customer-table button { margin-right: 8px; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; }
        .edit-btn { background: #ffc107; color: #222; }
        .edit-btn:hover { background: #e0a800; }
        .delete-btn { background: #e74c3c; color: #fff; }
        .delete-btn:hover { background: #c0392b; }
        @media (max-width: 700px) {
          .customer-container { padding: 8px; }
          .customer-form, .customer-table { font-size: 0.98rem; }
          .customer-table th, .customer-table td { padding: 8px; }
        }
        @media (max-width: 500px) {
          .customer-form, .customer-table { padding: 8px; }
          .customer-table th, .customer-table td { padding: 6px; }
        }
      `}</style>
      <h2>Customers</h2>
      <form className="customer-form" onSubmit={handleSubmit}>
        <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required type="email" />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
        <textarea name="address" placeholder="Address" value={form.address} onChange={handleChange} rows={2} />
        <button type="submit">{editingId ? 'Update' : 'Add'} Customer</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', email: '', phone: '', address: '' }); }}>Cancel</button>}
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginTop: 8 }}>{success}</div>}
      </form>
      <table className="customer-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.email}</td>
              <td>{c.phone}</td>
              <td>{c.address}</td>
              <td>
                <button className="edit-btn" onClick={() => handleEdit(c)}>Edit</button>
                <button className="delete-btn" onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Customer;

