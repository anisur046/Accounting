import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Reports() {
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ title: '', content: '' });

  useEffect(() => {
    fetch('http://localhost:3001/api/reports')
      .then(res => res.json())
      .then(setReports);
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = e => {
    e.preventDefault();
    fetch('http://localhost:3001/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then(res => res.json())
      .then(report => setReports([...reports, report]));
  };

  return (
    <div>
      <h2>Reports</h2>
      <form onSubmit={handleSubmit}>
        <input name="title" placeholder="Title" value={form.title} onChange={handleChange} />
        <textarea name="content" placeholder="Content" value={form.content} onChange={handleChange} />
        <button type="submit">Add Report</button>
      </form>
      <ul>
        {reports.map(report => (
          <li key={report.id}>{report.title}: {report.content}</li>
        ))}
      </ul>
    </div>
  );
}

export default Reports;
