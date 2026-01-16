import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './Reports.css';

function Reports() {
  const [reportType, setReportType] = useState('General');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dayFromDate, setDayFromDate] = useState('');
  const [dayToDate, setDayToDate] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    opening: 0,
    income: 0,
    expense: 0,
    closing: 0
  });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleFetchReport = async (e, customFrom, customTo) => {
    if (e) e.preventDefault();
    const fDate = customFrom || fromDate;
    const tDate = customTo || toDate;

    if (!fDate || !tDate) return;

    setLoading(true);
    setError('');
    try {
      const fetchWithTimeout = async (url, options = {}) => {
        const { timeout = 10000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      };

      // If Daybook, also fetch opening balance
      let openingBal = 0;
      if (reportType === 'Daybook') {
        const balRes = await fetchWithTimeout(`http://localhost:3001/api/transactions/balance?toDate=${fDate}`);
        const balData = await balRes.json();
        openingBal = balData.balance || 0;
      }

      const res = await fetchWithTimeout(`http://localhost:3001/api/transactions/report?fromDate=${fDate}&toDate=${tDate}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${res.status}`);
      }
      const data = await res.json();

      // Sanitize data: Ensure amounts are numeric
      const sanitizedData = data.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount || 0)
      }));

      // Calculate totals
      const incomeTotal = sanitizedData
        .filter(tx => tx.type === 'income')
        .reduce((acc, tx) => acc + tx.amount, 0);

      const expenseTotal = sanitizedData
        .filter(tx => tx.type === 'expense')
        .reduce((acc, tx) => acc + tx.amount, 0);

      const openingValue = parseFloat(openingBal || 0);

      setSummary({
        opening: openingValue,
        income: incomeTotal,
        expense: expenseTotal,
        closing: parseFloat((openingValue + incomeTotal - expenseTotal).toFixed(2))
      });
      setTransactions(sanitizedData);
      setSearched(true);
    } catch (err) {
      console.error('Error fetching report:', err);
      let msg = err.message;
      if (err.name === 'AbortError') {
        msg = 'Request timed out. Please check if the backend server is running and your database is connected.';
      } else if (msg.includes('Failed to fetch')) {
        msg = 'Could not connect to the backend. Please ensure the backend server is running on port 3001.';
      }
      setError(msg);
      setSearched(false); // Hide report results if there's an error
    } finally {
      setLoading(false);
    }
  };

  const handleDaybookFetch = (e) => {
    e.preventDefault();
    if (!dayFromDate || !dayToDate) return;
    handleFetchReport(null, dayFromDate, dayToDate);
  };

  const handleExportExcel = () => {
    let exportData = [];
    if (reportType === 'Daybook') {
      // Add Summary Row
      exportData.push({
        'Section': 'SUMMARY',
        'Opening Balance': summary.opening,
        'Total Receipts': summary.income,
        'Total Payments': summary.expense,
        'Closing Balance': summary.closing
      });
      exportData.push({}); // Empty row

      // Add Debit Side
      exportData.push({ 'Section': 'DEBIT (INCOME/RECEIPTS)' });
      transactions.filter(tx => tx.type === 'income').forEach(tx => {
        exportData.push({
          'Date': formatDate(tx.date),
          'Name': tx.customerName || '',
          'Description': tx.description,
          'Amount': tx.amount
        });
      });
      exportData.push({ 'Description': 'Total Receipts', 'Amount': summary.income });
      exportData.push({ 'Description': 'Opening Balance', 'Amount': summary.opening });
      exportData.push({});

      // Add Credit Side
      exportData.push({ 'Section': 'CREDIT (EXPENSE/PAYMENTS)' });
      transactions.filter(tx => tx.type === 'expense').forEach(tx => {
        exportData.push({
          'Date': formatDate(tx.date),
          'Name': tx.customerName || '',
          'Description': tx.description,
          'Amount': tx.amount
        });
      });
      exportData.push({ 'Description': 'Total Payments', 'Amount': summary.expense });
      exportData.push({ 'Description': 'Closing Balance', 'Amount': summary.closing });
    } else {
      exportData = transactions.map(tx => ({
        'Date': formatDate(tx.date),
        'Type': tx.type,
        'Customer': tx.customerName || '',
        'Email': tx.customerEmail || '',
        'Phone': tx.customerPhone || '',
        'Description': tx.description,
        'Amount': tx.amount
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${reportType}_Report`);
    XLSX.writeFile(wb, `${reportType}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Reports</h2>
        <div className="report-selector">
          <label>Select Report Type: </label>
          <select value={reportType} onChange={(e) => {
            setReportType(e.target.value);
            setSearched(false);
            setTransactions([]);
          }}>
            <option value="General">General (Date Range)</option>
            <option value="Daybook">Daybook (Daily View)</option>
          </select>
        </div>
      </div>

      <div className="reports-filter-section">
        {reportType === 'General' ? (
          <form className="reports-form" onSubmit={handleFetchReport}>
            <div className="form-group">
              <label>From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate General Report'}
            </button>
          </form>
        ) : (
          <form className="reports-form" onSubmit={handleDaybookFetch}>
            <div className="form-group">
              <label>From Date</label>
              <input type="date" value={dayFromDate} onChange={(e) => setDayFromDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input type="date" value={dayToDate} onChange={(e) => setDayToDate(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Daybook'}
            </button>
          </form>
        )}
      </div>

      {searched && (
        <div className="reports-actions no-print">
          <button onClick={handleExportExcel} className="export-btn">Export to Excel</button>
          <button onClick={handlePrint} className="print-btn">Print PDF</button>
        </div>
      )}

      {error && <div style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>{error}</div>}

      {searched && (
        <div className="reports-results">
          {reportType === 'Daybook' && (
            <div className="daybook-summary-grid no-print">
              <div className="summary-card opening-bal">
                <span className="card-label">Opening Balance</span>
                <span className="card-value">{Number(summary.opening).toFixed(2)}</span>
              </div>
              <div className="summary-card total-receipts">
                <span className="card-label">Total Receipts (Debit)</span>
                <span className="card-value">{Number(summary.income).toFixed(2)}</span>
              </div>
              <div className="summary-card total-payments">
                <span className="card-label">Total Payments (Credit)</span>
                <span className="card-value">{Number(summary.expense).toFixed(2)}</span>
              </div>
              <div className="summary-card closing-bal">
                <span className="card-label">Closing Balance</span>
                <span className="card-value">{Number(summary.closing).toFixed(2)}</span>
              </div>
            </div>
          )}

          {reportType === 'Daybook' ? (
            <div className="daybook-dual-view">
              {transactions.length > 0 ? (
                (() => {
                  const incomeTx = transactions.filter(tx => tx.type === 'income');
                  const expenseTx = transactions.filter(tx => tx.type === 'expense');
                  const maxRows = Math.max(incomeTx.length, expenseTx.length);
                  const paddingRows = (count) => Array.from({ length: maxRows - count }).map((_, i) => (
                    <tr key={`pad-${i}`} className="padding-row">
                      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                    </tr>
                  ));

                  return (
                    <>
                      <div className="daybook-column debit-side">
                        <h3>Debit (Income/Receipts)</h3>
                        <table className="reports-table daybook-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Name</th>
                              <th>Type</th>
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incomeTx.map(tx => (
                              <tr key={tx.id}>
                                <td>{formatDate(tx.date)}</td>
                                <td>{tx.customerName || ''}</td>
                                <td>{tx.type}</td>
                                <td>{Number(tx.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                            {paddingRows(incomeTx.length)}
                            <tr className="subtotal-row">
                              <td colSpan="3">Total Receipts</td>
                              <td>{Number(summary.income).toFixed(2)}</td>
                            </tr>
                            <tr className="balance-row">
                              <td colSpan="3">Opening Balance</td>
                              <td>{Number(summary.opening).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="daybook-column credit-side">
                        <h3>Credit (Expense/Payments)</h3>
                        <table className="reports-table daybook-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Name</th>
                              <th>Type</th>
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenseTx.map(tx => (
                              <tr key={tx.id}>
                                <td>{formatDate(tx.date)}</td>
                                <td>{tx.customerName || ''}</td>
                                <td>{tx.type}</td>
                                <td>{Number(tx.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                            {paddingRows(expenseTx.length)}
                            <tr className="subtotal-row">
                              <td colSpan="3">Total Payments</td>
                              <td>{Number(summary.expense).toFixed(2)}</td>
                            </tr>
                            <tr className="balance-row">
                              <td colSpan="3">Closing Balance</td>
                              <td>{Number(summary.closing).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="no-data">No transactions found for the Daybook for the selected period.</div>
              )}
            </div>
          ) : (
            <>
              <h3>{reportType} Results</h3>
              {transactions.length > 0 ? (
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{formatDate(tx.date)}</td>
                        <td>
                          <span className={`type-badge type-${tx.type}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td>{tx.customerName || ''}</td>
                        <td>{tx.customerEmail || ''}</td>
                        <td>{tx.customerPhone || ''}</td>
                        <td>{tx.description}</td>
                        <td>{Number(tx.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data">No transactions found for the selected {reportType === 'General' ? 'range' : 'period'}.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
