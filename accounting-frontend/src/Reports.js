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
    setSearched(true);
    setError('');
    try {
      // If Daybook, also fetch opening balance
      let openingBal = 0;
      if (reportType === 'Daybook') {
        const balRes = await fetch(`http://localhost:3001/api/transactions/balance?toDate=${fDate}`);
        const balData = await balRes.json();
        openingBal = balData.balance || 0;
      }

      const res = await fetch(`http://localhost:3001/api/transactions/report?fromDate=${fDate}&toDate=${tDate}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${res.status}`);
      }
      const data = await res.json();

      // Calculate totals with explicit numeric casting and parseFloat for safety
      const incomeTotal = data
        .filter(tx => tx.type === 'income')
        .reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);

      const expenseTotal = data
        .filter(tx => tx.type === 'expense')
        .reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);

      const openingValue = parseFloat(openingBal || 0);

      setSummary({
        opening: openingValue,
        income: incomeTotal,
        expense: expenseTotal,
        closing: parseFloat((openingValue + incomeTotal - expenseTotal).toFixed(2))
      });
      setTransactions(data);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.message);
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
        'Total Income': summary.income,
        'Expenditure': summary.expense,
        'Closing Balance': summary.closing
      });
      exportData.push({}); // Empty row

      // Add Credit Side
      exportData.push({ 'Section': 'CREDIT (INCOME)' });
      transactions.filter(tx => tx.type === 'income').forEach(tx => {
        exportData.push({
          'Date': formatDate(tx.date),
          'Name': tx.customerName || '',
          'Description': tx.description,
          'Amount': tx.amount
        });
      });
      exportData.push({});

      // Add Debit Side
      exportData.push({ 'Section': 'DEBIT (EXPENSE)' });
      transactions.filter(tx => tx.type === 'expense').forEach(tx => {
        exportData.push({
          'Date': formatDate(tx.date),
          'Name': tx.customerName || '',
          'Description': tx.description,
          'Amount': tx.amount
        });
      });
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
          {reportType === 'Daybook' ? (
            <div className="daybook-dual-view">
              {(() => {
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
                    <div className="daybook-column credit-side">
                      <h3>Credit (Income)</h3>
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
                              <td>${tx.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                          {paddingRows(incomeTx.length)}
                          <tr className="balance-row">
                            <td colSpan="3">Opening Balance</td>
                            <td>${summary.opening.toFixed(2)}</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="total-row">
                            <td colSpan="3">Total Credit</td>
                            <td>${(Number(summary.opening) + Number(summary.income)).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="daybook-column debit-side">
                      <h3>Debit (Expense)</h3>
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
                              <td>${Number(tx.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                          {paddingRows(expenseTx.length)}
                          <tr className="balance-row">
                            <td colSpan="3">Closing Balance</td>
                            <td>${Number(summary.closing).toFixed(2)}</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="total-row">
                            <td colSpan="3">Total Debit</td>
                            <td>${(Number(summary.expense) + Number(summary.closing)).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                );
              })()}
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
                        <td>${tx.amount.toFixed(2)}</td>
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
