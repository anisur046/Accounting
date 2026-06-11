import React, { useEffect, useState } from 'react';

const isDebitNormal = (category) => [
  'Balance with MDDCCB Bank',
  'Balance with Other Banks',
  'Investment',
  'Loan and Advance',
  'Closing Stock',
  'Fixed Assets',
  'Other Assets',
  'Expense',
  'Asset'
].includes(category);

function Customer() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [records, setRecords] = useState([]);

  const [form, setForm] = useState({
    code: '',
    head: '',
    openingBalance: 0,
    totalCredit: 0,
    totalDebit: 0,
    endingBalance: 0,
    detailListBalance: 0
  });

  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // States for manually registering a new society/period
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newPeriod, setNewPeriod] = useState('');
  const [addCompanyError, setAddCompanyError] = useState('');

  // 1. Fetch Companies list on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setError('');
    try {
      const res = await fetch('http://localhost:3001/api/ledger-balances/companies');
      if (!res.ok) throw new Error('Failed to fetch societies');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies);
        if (data.companies.length > 0) {
          setSelectedCompany(data.companies[0]);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // 2. Fetch Periods when selected company changes
  useEffect(() => {
    if (selectedCompany) {
      fetchPeriods(selectedCompany);
    } else {
      setPeriods([]);
      setSelectedPeriod('');
      setRecords([]);
    }
  }, [selectedCompany]);

  const fetchPeriods = async (companyName) => {
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/ledger-balances/periods?companyName=${encodeURIComponent(companyName)}`);
      if (!res.ok) throw new Error('Failed to fetch periods');
      const data = await res.json();
      if (data.success) {
        setPeriods(data.periods);
        if (data.periods.length > 0) {
          setSelectedPeriod(data.periods[0]);
        } else {
          setSelectedPeriod('');
          setRecords([]);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // 3. Fetch Ledger Balance records when selected period/company changes
  useEffect(() => {
    if (selectedCompany && selectedPeriod) {
      fetchLedgerRecords(selectedCompany, selectedPeriod);
    } else {
      setRecords([]);
    }
  }, [selectedCompany, selectedPeriod]);

  const fetchLedgerRecords = async (companyName, period) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/ledger-balances/by-period?companyName=${encodeURIComponent(companyName)}&period=${encodeURIComponent(period)}`);
      if (!res.ok) throw new Error('Failed to fetch ledger records');
      const data = await res.json();
      if (data.success && data.records) {
        // Exclude non-ledger system metadata records (like registration number and address), keep cash balances
        const ledgerRecords = data.records.filter(r => 
          r.type !== 'SystemMetadata' || 
          r.code === 'SYS_OP_CASH' || 
          r.code === 'SYS_CL_CASH'
        );
        setRecords(ledgerRecords);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompanySubmit = async (e) => {
    e.preventDefault();
    setAddCompanyError('');
    if (!newCompanyName.trim() || !newPeriod.trim()) {
      setAddCompanyError('Both fields are required.');
      return;
    }
    
    try {
      // Create SYS_OP_CASH
      const res1 = await fetch('http://localhost:3001/api/ledger-balances/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: newCompanyName.trim(),
          period: newPeriod.trim(),
          code: 'SYS_OP_CASH',
          head: 'Opening Cash Balance',
          openingBalance: 0,
          totalCredit: 0,
          totalDebit: 0,
          endingBalance: 0,
          type: 'SystemMetadata'
        })
      });
      if (!res1.ok) throw new Error('Failed to create opening cash balance');

      // Create SYS_CL_CASH
      const res2 = await fetch('http://localhost:3001/api/ledger-balances/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: newCompanyName.trim(),
          period: newPeriod.trim(),
          code: 'SYS_CL_CASH',
          head: 'Closing Cash Balance',
          openingBalance: 0,
          totalCredit: 0,
          totalDebit: 0,
          endingBalance: 0,
          type: 'SystemMetadata'
        })
      });
      if (!res2.ok) throw new Error('Failed to create closing cash balance');

      // Refresh list
      const res = await fetch('http://localhost:3001/api/ledger-balances/companies');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCompanies(data.companies);
          // Set selection
          setSelectedCompany(newCompanyName.trim());
          // Fetch periods to load this new period
          fetchPeriods(newCompanyName.trim());
          setSelectedPeriod(newPeriod.trim());
        }
      }

      setSuccess(`Society "${newCompanyName.trim()}" created successfully!`);
      setShowAddCompany(false);
      setNewCompanyName('');
      setNewPeriod('');
    } catch (err) {
      setAddCompanyError(err.message);
    }
  };

  const handleCompanyChange = e => {
    setSelectedCompany(e.target.value);
  };

  const handlePeriodChange = e => {
    setSelectedPeriod(e.target.value);
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = {
        ...prev,
        [name]: ['openingBalance', 'totalCredit', 'totalDebit', 'endingBalance', 'detailListBalance'].includes(name)
          ? parseFloat(value || 0)
          : value
      };
      
      // Auto-calculate endingBalance (Closing Balance) if openingBalance, totalCredit, or totalDebit changes
      if (['openingBalance', 'totalCredit', 'totalDebit'].includes(name)) {
        const ob = parseFloat(updated.openingBalance || 0);
        const cr = parseFloat(updated.totalCredit || 0);
        const db = parseFloat(updated.totalDebit || 0);
        
        // Find the record type to determine if it is debit normal
        let isDebit = false;
        const record = records.find(r => r.id === editingId || (editingId === null && String(r.code) === String(updated.code)));
        if (record) {
          isDebit = isDebitNormal(record.type);
        } else {
          // fallback checks on code or name
          const codeStr = String(updated.code);
          if (codeStr.startsWith('2') || codeStr.startsWith('6')) {
            isDebit = true; // typical assets/expenses
          }
        }

        const calculatedEnding = isDebit
          ? Math.round((ob + db - cr) * 100) / 100
          : Math.round((ob + cr - db) * 100) / 100;

        updated.endingBalance = calculatedEnding;
        updated.detailListBalance = calculatedEnding;
      }
      
      return updated;
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    
    if (!selectedCompany || !selectedPeriod) {
      setError('Please select a company and period first.');
      return;
    }

    try {
      const url = editingId 
        ? `http://localhost:3001/api/ledger-balances/${editingId}`
        : 'http://localhost:3001/api/ledger-balances/single';
      
      const payload = editingId
        ? form
        : {
            companyName: selectedCompany,
            period: selectedPeriod,
            ...form
          };

      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save ledger record.');
      }

      setSuccess(editingId ? 'Ledger entry updated!' : 'Ledger entry added!');
      setForm({
        code: '',
        head: '',
        openingBalance: 0,
        totalCredit: 0,
        totalDebit: 0,
        endingBalance: 0,
        detailListBalance: 0
      });
      setEditingId(null);
      fetchLedgerRecords(selectedCompany, selectedPeriod);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = record => {
    setForm({
      code: record.code || '',
      head: record.head || '',
      openingBalance: record.openingBalance || 0,
      totalCredit: record.totalCredit || 0,
      totalDebit: record.totalDebit || 0,
      endingBalance: record.endingBalance || 0,
      detailListBalance: record.detailListBalance || 0
    });
    setEditingId(record.id);
    setError(''); setSuccess('');
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this ledger entry?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`http://localhost:3001/api/ledger-balances/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete ledger record');
      setSuccess('Ledger entry deleted!');
      fetchLedgerRecords(selectedCompany, selectedPeriod);
    } catch (err) {
      setError(err.message);
    }
  };

  const isFormDisabled = !selectedCompany || !selectedPeriod;

  return (
    <div className="customer-container">
      <style>{`
        .customer-container { max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .selector-panel { display: flex; gap: 1.5rem; background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); padding: 20px; margin-bottom: 24px; border: 1px solid #eef2f3; }
        .selector-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
        .selector-group label { font-size: 0.8rem; font-weight: 700; color: #7f8c8d; text-transform: uppercase; }
        .selector-group select { padding: 0.75rem; border: 1px solid #dcdde1; border-radius: 8px; font-size: 0.95rem; background: #f8f9fa; color: #2c3e50; font-weight: 500; cursor: pointer; transition: all 0.2s; width: 100%; box-sizing: border-box; }
        .selector-group select:focus { background: #fff; border-color: #3498db; outline: none; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15); }
        
        .customer-form { background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); padding: 24px; margin-bottom: 32px; border: 1px solid #eef2f3; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.2rem; margin-bottom: 1.5rem; }
        .form-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-field label { font-size: 0.8rem; font-weight: 600; color: #7f8c8d; text-transform: uppercase; }
        .customer-form input { padding: 0.75rem; border: 1px solid #dcdde1; border-radius: 8px; font-size: 0.95rem; background: #f8f9fa; transition: all 0.2s; color: #2f3640; width: 100%; box-sizing: border-box; }
        .customer-form input:focus { background: #fff; border-color: #3498db; outline: none; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15); }
        .customer-form input:disabled { background: #eef2f3; cursor: not-allowed; color: #95a5a6; }
        
        .button-group { display: flex; gap: 0.8rem; }
        .customer-form button { background: #3498db; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .customer-form button:hover:not(:disabled) { background: #2980b9; }
        .customer-form button:disabled { background: #bdc3c7; cursor: not-allowed; }
        .cancel-btn { background: #95a5a6 !important; }
        .cancel-btn:hover { background: #7f8c8d !important; }
        
        .customer-table-wrapper { background: #fff; border-radius: 12px; overflow-x: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.02); border: 1px solid #eef2f3; }
        .customer-table { width: 100%; border-collapse: collapse; }
        .customer-table th, .customer-table td { padding: 14px 16px; border-bottom: 1px solid #f1f2f6; text-align: left; font-size: 0.92rem; }
        .customer-table th { background: #f8f9fa; color: #2c3e50; font-weight: 600; }
        .customer-table tr:last-child td { border-bottom: none; }
        .customer-table button { padding: 6px 12px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; transition: opacity 0.2s; font-size: 0.85rem; }
        .customer-table button:hover { opacity: 0.9; }
        .edit-btn { background: #f1c40f; color: #2c3e50; margin-right: 8px; }
        .delete-btn { background: #e74c3c; color: #fff; }
        
        .alert-banner { padding: 16px; border-radius: 8px; background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; font-weight: 500; margin-bottom: 24px; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
        
        @media (max-width: 768px) {
          .selector-panel { flex-direction: column; gap: 1rem; }
          .form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#2c3e50', fontWeight: 700 }}>General Ledger Detail List Manager</h2>
        <button 
          onClick={() => {
            setShowAddCompany(!showAddCompany);
            setAddCompanyError('');
          }} 
          style={{ 
            background: '#2ecc71', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            padding: '10px 18px', 
            fontWeight: '600', 
            cursor: 'pointer',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {showAddCompany ? '✕ Close Form' : '➕ Add New Society'}
        </button>
      </div>

      {showAddCompany && (
        <form onSubmit={handleAddCompanySubmit} style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #2ecc71',
          transition: 'all 0.3s ease-in-out'
        }}>
          <h3 style={{ margin: '0 0 1.2rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>Register New Society / Company</h3>
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
            <div style={{ flex: '2', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#7f8c8d', textTransform: 'uppercase' }}>Society / Company Name</label>
              <input 
                type="text" 
                placeholder="e.g. BALARAMPUR COOPERATIVE SOCIETY"
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                required
                style={{ padding: '0.75rem', border: '1px solid #dcdde1', borderRadius: '8px', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ flex: '1', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#7f8c8d', textTransform: 'uppercase' }}>Financial Year / Period</label>
              <input 
                type="text" 
                placeholder="e.g. 2026-27"
                value={newPeriod}
                onChange={e => setNewPeriod(e.target.value)}
                required
                style={{ padding: '0.75rem', border: '1px solid #dcdde1', borderRadius: '8px', fontSize: '0.95rem' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <button type="submit" style={{ background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer' }}>Create Society</button>
            <button type="button" onClick={() => setShowAddCompany(false)} style={{ background: '#95a5a6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
          </div>
          {addCompanyError && <div style={{ color: 'red', marginTop: 12, fontWeight: 500 }}>⚠️ {addCompanyError}</div>}
        </form>
      )}

      {/* Society / Company and Period Selector */}
      <div className="selector-panel">
        <div className="selector-group">
          <label>Select Society / Company</label>
          <select value={selectedCompany} onChange={handleCompanyChange} disabled={companies.length === 0}>
            {companies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            {companies.length === 0 && <option value="">No companies found</option>}
          </select>
        </div>
        <div className="selector-group">
          <label>Select Period</label>
          <select value={selectedPeriod} onChange={handlePeriodChange} disabled={periods.length === 0}>
            {periods.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
            {periods.length === 0 && <option value="">No periods found</option>}
          </select>
        </div>
      </div>

      {isFormDisabled && (
        <div className="alert-banner">
          ⚠️ <strong>Notice:</strong> No uploaded cash accounts found in the database. Please navigate to the <strong>Cash Account PDF</strong> section to upload a PDF and save it first.
        </div>
      )}

      {/* Form */}
      <form className="customer-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>GL Code</label>
            <input 
              name="code" 
              placeholder="e.g. 12216" 
              value={form.code} 
              onChange={handleChange} 
              required 
              disabled={isFormDisabled || editingId !== null} 
            />
          </div>
          <div className="form-field">
            <label>GL Head Name</label>
            <input 
              name="head" 
              placeholder="e.g. Provident Fund Reserve" 
              value={form.head} 
              onChange={handleChange} 
              required 
              disabled={isFormDisabled || (editingId !== null && form.code.startsWith('SYS_'))} 
            />
          </div>
          <div className="form-field">
            <label>Opening Balance</label>
            <input name="openingBalance" type="number" step="0.01" value={form.openingBalance} onChange={handleChange} disabled={isFormDisabled} />
          </div>
          <div className="form-field">
            <label>Credit Balance</label>
            <input name="totalCredit" type="number" step="0.01" value={form.totalCredit} onChange={handleChange} disabled={isFormDisabled} />
          </div>
          <div className="form-field">
            <label>Debit Balance</label>
            <input name="totalDebit" type="number" step="0.01" value={form.totalDebit} onChange={handleChange} disabled={isFormDisabled} />
          </div>
          <div className="form-field">
            <label>Closing Balance</label>
            <input name="endingBalance" type="number" step="0.01" value={form.endingBalance} onChange={handleChange} disabled={isFormDisabled} />
          </div>
          <div className="form-field">
            <label>Detail List Balance</label>
            <input name="detailListBalance" type="number" step="0.01" value={form.detailListBalance} onChange={handleChange} disabled={isFormDisabled} />
          </div>
        </div>
        <div className="button-group">
          <button type="submit" disabled={isFormDisabled}>{editingId ? 'Update' : 'Add'} Ledger Entry</button>
          {editingId && (
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setEditingId(null);
                setForm({
                  code: '',
                  head: '',
                  openingBalance: 0,
                  totalCredit: 0,
                  totalDebit: 0,
                  endingBalance: 0,
                  detailListBalance: 0
                });
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {error && <div style={{ color: 'red', marginTop: 12, fontWeight: 500 }}>⚠️ {error}</div>}
        {success && <div style={{ color: 'green', marginTop: 12, fontWeight: 500 }}>✅ {success}</div>}
      </form>

      {/* Table */}
      <div className="customer-table-wrapper">
        <table className="customer-table">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>Sl No</th>
              <th style={{ width: '12%' }}>GL Code</th>
              <th style={{ width: '26%' }}>GL Head Name</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Opening Balance</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Credit</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Debit</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Closing Balance</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Detail List Balance</th>
              <th style={{ width: '12%', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
                  Loading ledger balances...
                </td>
              </tr>
            ) : records.map((r, idx) => (
              <tr key={r.id}>
                <td>{idx + 1}</td>
                <td style={{ fontWeight: '600', color: '#2980b9' }}>{r.code}</td>
                <td style={{ fontWeight: '500' }}>{r.head}</td>
                <td style={{ textAlign: 'right' }}>{Number(r.openingBalance || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{Number(r.totalCredit || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{Number(r.totalDebit || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(r.endingBalance || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{Number(r.detailListBalance || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="edit-btn" onClick={() => handleEdit(r)}>Edit</button>
                  {r.type !== 'SystemMetadata' && (
                    <button className="delete-btn" onClick={() => handleDelete(r.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#95a5a6', fontStyle: 'italic' }}>
                  {isFormDisabled 
                    ? 'No ledger records available. Upload a statement first.' 
                    : 'No ledger records found for this period. Add one above!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Customer;
