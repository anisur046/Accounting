import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './Reports.css';

const getPreviousYear = (yearStr) => {
  if (!yearStr) return null;
  const parts = yearStr.split('-');
  if (parts.length === 2) {
    const y1 = parseInt(parts[0], 10);
    const y2 = parseInt(parts[1], 10);
    if (!isNaN(y1) && !isNaN(y2)) {
      const prevY1 = y1 - 1;
      const prevY2 = (y2 - 1 + 100) % 100;
      return `${prevY1}-${String(prevY2).padStart(2, '0')}`;
    }
  }
  return null;
};

const getNextYear = (yearStr) => {
  if (!yearStr) return null;
  const parts = yearStr.split('-');
  if (parts.length === 2) {
    const y1 = parseInt(parts[0], 10);
    const y2 = parseInt(parts[1], 10);
    if (!isNaN(y1) && !isNaN(y2)) {
      const nextY1 = y1 + 1;
      const nextY2 = (y2 + 1) % 100;
      return `${nextY1}-${String(nextY2).padStart(2, '0')}`;
    }
  }
  return null;
};

const getEndDate = (period) => {
  if (!period) return 'End of Period';
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const startYear = parseInt(match[1], 10);
    return `31-03-${startYear + 1}`;
  }
  return period.split(' To ')[1] || period;
};

const parseNpaExcelData = (rows) => {
  if (!rows || rows.length === 0) return [];

  // Find the header row
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowStr = row.map(cell => String(cell || '').toUpperCase());
    if (rowStr.some(c => c.includes('LOAN CODE') || c.includes('LOAN TYPE') || c.includes('STANDARD') || c.includes('SUB-STANDARD') || c.includes('DOUBTFUL') || c.includes('NPA') || c.includes('A/C NUMBER') || c.includes('ACCOUNT NUMBER') || c.includes('CIF ID') || c.includes('DISBURSE AMOUNT') || c.includes('OUTSTANDING'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const headers = rows[headerIndex].map(cell => String(cell || '').trim().toUpperCase());
  const dataRows = rows.slice(headerIndex + 1);

  const findCol = (keywords) => {
    for (const k of keywords) {
      const idx = headers.findIndex(h => h.includes(k));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const loanCodeIdx = findCol(['LOAN CODE', 'CODE', 'LOAN TYPE', 'TYPE', 'PRODUCT']);
  const loanHeadIdx = findCol(['LOAN HEAD', 'HEAD', 'LOAN NAME', 'PARTICULARS']);

  const standardIdx = findCol(['STANDARD', 'STD', 'STAGE 1']);
  const substandardIdx = findCol(['SUBSTANDARD', 'SUB-STANDARD', 'SUB_STANDARD', 'STAGE 2']);
  const d1Idx = findCol(['D1', 'DOUBTFUL-1', 'DOUBTFUL 1', 'STAGE 3']);
  const d2Idx = findCol(['D2', 'DOUBTFUL-2', 'DOUBTFUL 2', 'STAGE 4']);
  const d3Idx = findCol(['D3', 'DOUBTFUL-3', 'DOUBTFUL 3', 'STAGE 5', 'LOSS']);

  const findIntColAfter = (pIdx) => {
    if (pIdx === -1) return -1;
    for (let i = pIdx + 1; i < Math.min(headers.length, pIdx + 4); i++) {
      const h = headers[i];
      if (h.includes('INT') || h.includes('INTEREST') || h.includes('INTR')) {
        return i;
      }
    }
    return -1;
  };

  const standardIntIdx = findIntColAfter(standardIdx);
  const substandardIntIdx = findIntColAfter(substandardIdx);
  const d1IntIdx = findIntColAfter(d1Idx);
  const d2IntIdx = findIntColAfter(d2Idx);
  const d3IntIdx = findIntColAfter(d3Idx);

  const totalPrincipalIdx = findCol(['TOTAL PRINCIPAL', 'TOTAL_PRINCIPAL', 'TOTAL BAL', 'TOTAL OUTSTANDING', 'OUTSTANDING']);
  const totalIntIdx = findCol(['TOTAL INT', 'TOTAL_INT', 'TOTAL INTEREST', 'INTEREST OUTSTANDING', 'OUTSTANDING INT']);
  const dateIdx = findCol(['DATE', 'AS ON']);

  const hasSummaryCols = standardIdx !== -1 || substandardIdx !== -1 || d1Idx !== -1;

  if (hasSummaryCols) {
    const parsed = [];
    dataRows.forEach(row => {
      if (!row || row.length === 0) return;
      const getVal = (idx) => {
        if (idx === -1 || idx >= row.length) return 0;
        const val = parseFloat(row[idx]);
        return isNaN(val) ? 0 : val;
      };
      const getStr = (idx, fallback = '') => {
        if (idx === -1 || idx >= row.length) return fallback;
        return String(row[idx] || '').trim();
      };

      const code = getStr(loanCodeIdx);
      const head = getStr(loanHeadIdx);
      if (!code && !head) return;

      if (String(code || head).toUpperCase() === 'TOTAL' || String(code || head).toUpperCase().includes('TOTAL SUMS')) return;

      const standardVal = getVal(standardIdx);
      const standardIntVal = getVal(standardIntIdx);
      const substandardVal = getVal(substandardIdx);
      const substandardIntVal = getVal(substandardIntIdx);
      const d1Val = getVal(d1Idx);
      const d1IntVal = getVal(d1IntIdx);
      const d2Val = getVal(d2Idx);
      const d2IntVal = getVal(d2IntIdx);
      const d3Val = getVal(d3Idx);
      const d3IntVal = getVal(d3IntIdx);

      const totPrinc = totalPrincipalIdx !== -1 ? getVal(totalPrincipalIdx) : (standardVal + substandardVal + d1Val + d2Val + d3Val);
      const totInt = totalIntIdx !== -1 ? getVal(totalIntIdx) : (standardIntVal + substandardIntVal + d1IntVal + d2IntVal + d3IntVal);

      parsed.push({
        date: getStr(dateIdx, '31-03-2027'),
        loanCode: code || 'OTHER',
        loanHead: head || code || 'OTHER LOAN',
        standard: standardVal,
        standardInt: standardIntVal,
        substandard: substandardVal,
        substandardInt: substandardIntVal,
        d1: d1Val,
        d1Int: d1IntVal,
        d2: d2Val,
        d2Int: d2IntVal,
        d3: d3Val,
        d3Int: d3IntVal,
        totalPrincipal: totPrinc,
        totalInt: totInt
      });
    });
    return parsed;
  } else {
    // Detailed list
    let fileOrTitleCode = 'KCC';
    let fileOrTitleHead = 'SHORT TERM (KCC) LOAN';

    // Heuristics for Title/File code detection
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i];
      if (row && row.length > 0) {
        const txt = String(row[0] || '').toUpperCase();
        if (txt.includes('FARM-LOAN') || txt.includes('FARM LOAN') || txt.includes('KCC') || txt.includes('KISAN')) {
          fileOrTitleCode = 'KCC';
          fileOrTitleHead = 'SHORT TERM (KCC) LOAN';
        } else if (txt.includes('SHG') || txt.includes('SELF HELP')) {
          fileOrTitleCode = 'SHGL';
          fileOrTitleHead = 'SELF HELP GROUP LOAN';
        } else if (txt.includes('DAILY') || txt.includes('DSL')) {
          fileOrTitleCode = 'DSL';
          fileOrTitleHead = 'DAILY SAVINGS LOAN';
        } else if (txt.includes('STAFF') || txt.includes('STFL')) {
          fileOrTitleCode = 'STFL';
          fileOrTitleHead = 'STAFF LOAN';
        } else if (txt.includes('LAD') || txt.includes('DEPOSIT')) {
          fileOrTitleCode = 'LAD';
          fileOrTitleHead = 'LOAN AGAINST DEPOSIT';
        }
      }
    }

    const detailPrincipalIdx = findCol(['PRINCIPLE OUTSTANDING', 'OUTSTANDING', 'PRINCIPAL OUTSTANDING', 'BAL', 'AMOUNT', 'DEBIT', 'CLOSE']);
    const detailInterestIdx = findCol(['INTEREST OUTSTANDING', 'TOTAL INTEREST', 'INTEREST', 'INT']);
    const odDateIdx = findCol(['OD DATE', 'OD_DATE', 'OVERDUE DATE']);
    const intCurrentIdx = findCol(['INTEREST CURRENT', 'CURRENT INTEREST']);
    const intOverdueIdx = findCol(['INTEREST OVERDUE', 'OVERDUE INTEREST']);
    const princCurrentIdx = findCol(['PRINCIPLE CURRENT', 'CURRENT PRINCIPLE', 'CURRENT PRINCIPAL']);
    const princOverdueIdx = findCol(['PRINCIPLE OVERDUE', 'OVERDUE PRINCIPLE', 'OVERDUE PRINCIPAL']);

    // Overlap avoidance
    let finalPrincipalIdx = detailPrincipalIdx;
    if (finalPrincipalIdx === princCurrentIdx || finalPrincipalIdx === princOverdueIdx) {
      finalPrincipalIdx = -1;
    }
    let finalInterestIdx = detailInterestIdx;
    if (finalInterestIdx === intCurrentIdx || finalInterestIdx === intOverdueIdx) {
      finalInterestIdx = -1;
    }

    let statementYear = 2027;
    let statementMonth = 2; // March
    let statementDay = 31;

    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i];
      if (row && row.length > 0) {
        const txt = String(row[0] || '');
        const match = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          statementYear = parseInt(match[1]);
          statementMonth = parseInt(match[2]) - 1;
          statementDay = parseInt(match[3]);
          break;
        }
        const matchSlash = txt.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
        if (matchSlash) {
          statementYear = parseInt(matchSlash[3]);
          statementMonth = parseInt(matchSlash[2]) - 1;
          statementDay = parseInt(matchSlash[1]);
          break;
        }
      }
    }

    const statementDate = new Date(statementYear, statementMonth, statementDay);

    const groups = {};
    dataRows.forEach(row => {
      if (!row || row.length === 0) return;

      const isTotalRow = row.some(cell => {
        const str = String(cell || '').trim().toUpperCase();
        return str === 'TOTAL' || str === 'TOTAL SUMS' || str === 'GRAND TOTAL';
      });
      if (isTotalRow) return;

      const getVal = (idx) => {
        if (idx === -1 || idx >= row.length) return 0;
        const val = parseFloat(row[idx]);
        return isNaN(val) ? 0 : val;
      };
      const getStr = (idx, fallback = '') => {
        if (idx === -1 || idx >= row.length) return fallback;
        return String(row[idx] || '').trim();
      };

      const code = getStr(loanCodeIdx) || fileOrTitleCode;
      const head = getStr(loanHeadIdx) || fileOrTitleHead;

      const pCurrent = getVal(princCurrentIdx);
      const pOverdue = getVal(princOverdueIdx);
      const iCurrent = getVal(intCurrentIdx);
      const iOverdue = getVal(intOverdueIdx);

      const principal = finalPrincipalIdx !== -1 ? getVal(finalPrincipalIdx) : (pCurrent + pOverdue);
      const interest = finalInterestIdx !== -1 ? getVal(finalInterestIdx) : (iCurrent + iOverdue);

      if (principal === 0 && interest === 0) return;

      const odSerial = parseFloat(row[odDateIdx]);
      let yearsOverdue = 0;

      if (!isNaN(odSerial) && odSerial > 0) {
        const odDate = new Date(1899, 11, 30 + odSerial);
        yearsOverdue = (statementDate - odDate) / (1000 * 60 * 60 * 24 * 365.25);
      } else if (pOverdue > 0 || iOverdue > 0) {
        yearsOverdue = 0.5; // default to Substandard if we have overdue but no date
      }

      if (!groups[code]) {
        groups[code] = {
          date: statementDay.toString().padStart(2, '0') + '-' + (statementMonth + 1).toString().padStart(2, '0') + '-' + statementYear,
          loanCode: code,
          loanHead: head,
          standard: 0, standardInt: 0,
          substandard: 0, substandardInt: 0,
          d1: 0, d1Int: 0,
          d2: 0, d2Int: 0,
          d3: 0, d3Int: 0,
          totalPrincipal: 0,
          totalInt: 0
        };
      }

      if (yearsOverdue <= 0.25 && pOverdue === 0 && iOverdue === 0) {
        groups[code].standard += principal;
        groups[code].standardInt += interest;
      } else if (yearsOverdue <= 1.0) {
        groups[code].substandard += principal;
        groups[code].substandardInt += interest;
      } else if (yearsOverdue <= 2.0) {
        groups[code].d1 += principal;
        groups[code].d1Int += interest;
      } else if (yearsOverdue <= 4.0) {
        groups[code].d2 += principal;
        groups[code].d2Int += interest;
      } else {
        groups[code].d3 += principal;
        groups[code].d3Int += interest;
      }

      groups[code].totalPrincipal += principal;
      groups[code].totalInt += interest;
    });

    return Object.values(groups);
  }
};

function Reports() {
  // Main Navigation Tab
  const [activeMainTab, setActiveMainTab] = useState('coop'); // 'transactions' or 'coop'

  // Transactions Report State (Original Logic)
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
  const [loadingTx, setLoadingTx] = useState(false);
  const [searchedTx, setSearchedTx] = useState(false);
  const [errorTx, setErrorTx] = useState('');

  // Co-op Financial Statements State (Database Driven)
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [coopRecords, setCoopRecords] = useState([]);
  const [prevPeriodRecords, setPrevPeriodRecords] = useState([]);
  const [coopMetadata, setCoopMetadata] = useState(null);
  const [loadingCoop, setLoadingCoop] = useState(false);
  const [errorCoop, setErrorCoop] = useState('');
  const [activeCoopTab, setActiveCoopTab] = useState('bs'); // 'bs', 'assets_sch', 'liab_sch', 'pl_coop', 'pl_sch', 'npa', 'diff', 'tb'
  const [tbSubTab, setTbSubTab] = useState('assets_exp'); // 'assets_exp' or 'liab_inc'
  const [authorisedShareCapital, setAuthorisedShareCapital] = useState(2100000);
  const [prevAuthorisedShareCapital, setPrevAuthorisedShareCapital] = useState(2100000);
  const [savingCoop, setSavingCoop] = useState(false);
  const [saveSuccessCoop, setSaveSuccessCoop] = useState('');
  const [saveErrorCoop, setSaveErrorCoop] = useState('');

  const defaultNpaRows = [];
  const [npaRows, setNpaRows] = useState(defaultNpaRows);
  const [npaError, setNpaError] = useState('');
  const [npaSuccess, setNpaSuccess] = useState('');

  // Load Companies list for Co-op statements
  useEffect(() => {
    if (activeMainTab === 'coop') {
      fetchCompanies();
    }
  }, [activeMainTab]);

  const fetchCompanies = async () => {
    setLoadingCoop(true);
    setErrorCoop('');
    try {
      const res = await fetch('http://localhost:3001/api/ledger-balances/companies');
      if (!res.ok) throw new Error('Failed to fetch companies from backend');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies);
        if (data.companies.length > 0) {
          setSelectedCompany(data.companies[0]);
          fetchPeriods(data.companies[0]);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorCoop('Could not connect to the backend server to fetch companies.');
    } finally {
      setLoadingCoop(false);
    }
  };

  const fetchPeriods = async (companyName) => {
    setErrorCoop('');
    try {
      const res = await fetch(`http://localhost:3001/api/ledger-balances/periods?companyName=${encodeURIComponent(companyName)}`);
      if (!res.ok) throw new Error('Failed to fetch periods');
      const data = await res.json();
      if (data.success) {
        setPeriods(data.periods);
        if (data.periods.length > 0) {
          setSelectedPeriod(data.periods[0]);
          fetchLedgerData(companyName, data.periods[0]);
        } else {
          setSelectedPeriod('');
          setCoopRecords([]);
          setPrevPeriodRecords([]);
          setCoopMetadata(null);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorCoop('Failed to fetch financial statement periods.');
    }
  };

  const handleNpaExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNpaError('');
    setNpaSuccess('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const parsedRows = parseNpaExcelData(data);
        if (parsedRows && parsedRows.length > 0) {
          setNpaRows(prev => {
            const updated = [...prev];
            parsedRows.forEach(parsed => {
              const idx = updated.findIndex(r => r.loanCode.toUpperCase() === parsed.loanCode.toUpperCase());
              if (idx !== -1) {
                updated[idx] = parsed;
              } else {
                updated.push(parsed);
              }
            });
            return updated;
          });
          setNpaSuccess('NPA Summary calculated successfully from Excel! Click "Save Changes" at the top of the page to save to the database.');
        } else {
          setNpaError('Could not parse NPA data. Please check Excel format.');
        }
      } catch (err) {
        console.error(err);
        setNpaError('Error reading Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearNpaData = () => {
    setNpaRows(defaultNpaRows);
    setNpaSuccess('NPA data reset to defaults! Click "Save Changes" at the top of the page to save to the database.');
  };


  const fetchLedgerData = async (companyName, period) => {
    setLoadingCoop(true);
    setErrorCoop('');
    try {
      const res = await fetch(`http://localhost:3001/api/ledger-balances/by-period?companyName=${encodeURIComponent(companyName)}&period=${encodeURIComponent(period)}`);
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      if (data.success && data.records) {
        // Split metadata and ledger records
        const systemMetadata = data.records.filter(r => r.type === 'SystemMetadata');
        const normalRecords = data.records.filter(r => r.type !== 'SystemMetadata');

        // Parse meta
        const opCashRecord = systemMetadata.find(r => r.code === 'SYS_OP_CASH');
        const clCashRecord = systemMetadata.find(r => r.code === 'SYS_CL_CASH');
        const regRecord = systemMetadata.find(r => r.code === 'SYS_REG_NO');
        const addrRecord = systemMetadata.find(r => r.code === 'SYS_ADDR');

        let openingCash = opCashRecord ? opCashRecord.openingBalance : 0;
        let closingCash = clCashRecord ? clCashRecord.openingBalance : 0;
        let registrationNo = regRecord ? regRecord.head : '';
        let address = addrRecord ? addrRecord.head : '';

        // Fallback for legacy saved database periods without system metadata
        if (companyName.toUpperCase().includes('RANINAGAR') && openingCash === 0 && closingCash === 0) {
          openingCash = 180456;
          closingCash = 31418;
          registrationNo = '31/MSD DATED--07.09.2015';
          address = 'VILL-ISLAMPUR :: P.O.-ISLAMPUR :: MURSHIDABAD';
        }

        const getMetaVal = (code, defaultValue) => {
          const rec = systemMetadata.find(r => r.code === code);
          return rec ? parseFloat(rec.openingBalance || 0) : defaultValue;
        };

        const pySchDepositInt = getMetaVal('SYS_PY_SCH_DEP_INT', 287702.00);
        const pySchDepositDue = getMetaVal('SYS_PY_SCH_DEP_DUE', 154979.00);
        const pySchDepositLastDue = getMetaVal('SYS_PY_SCH_DEP_LDUE', 56973.00);
        const pySchBorrowingInt = getMetaVal('SYS_PY_SCH_BORR_INT', 247021.00);
        const pySchBorrowingDue = getMetaVal('SYS_PY_SCH_BORR_DUE', 21284.00);
        const pySchBorrowingLastDue = getMetaVal('SYS_PY_SCH_BORR_LDUE', 21582.00);
        const pySchLoanInt = getMetaVal('SYS_PY_SCH_LOAN_INT', 638949.00);
        const pySchLoanDue = getMetaVal('SYS_PY_SCH_LOAN_DUE', 108772.09);
        const pySchLoanLastDue = getMetaVal('SYS_PY_SCH_LOAN_LDUE', 108772.09);
        const pyPlInvestmentInterest = getMetaVal('SYS_PY_PL_INV_INT', 565098.00);
        const pyPlMiscIncome = getMetaVal('SYS_PY_PL_MISC_INC', 160963.68);
        const pyPlEstablishment = getMetaVal('SYS_PY_PL_EST', 390412.00);
        const pyPlDepreciation = getMetaVal('SYS_PY_PL_DEP', 22377.00);
        const pyPlProvisionStandard = getMetaVal('SYS_PY_PL_PROV_STD', 0.00);
        const pyPlProvisionNpa = getMetaVal('SYS_PY_PL_PROV_NPA', 0.00);
        const pyPlOverdueInterest = getMetaVal('SYS_PY_PL_OD_INT', 0.00);
        const pyPlAuditFees = getMetaVal('SYS_PY_PL_AUDIT', 9600.00);
        const pyPlProfit = getMetaVal('SYS_PY_PL_PROFIT', 348940.77);
        const pyPlLoss = getMetaVal('SYS_PY_PL_LOSS', 0.00);

        // Fetch previous period records chronologically for forwarding
        let prevRecords = [];
        let prevClosingCash = null;

        const prevPeriod = getPreviousYear(period);
        if (prevPeriod) {
          try {
            const prevRes = await fetch(`http://localhost:3001/api/ledger-balances/by-period?companyName=${encodeURIComponent(companyName)}&period=${encodeURIComponent(prevPeriod)}`);
            if (prevRes.ok) {
              const prevData = await prevRes.json();
              if (prevData.success && prevData.records && prevData.records.length > 0) {
                prevRecords = prevData.records;
                const prevClCash = prevRecords.find(r => r.code === 'SYS_CL_CASH');
                if (prevClCash) {
                  prevClosingCash = prevClCash.openingBalance;
                }
              }
            }
          } catch (err) {
            console.error('Error fetching previous period records:', err);
          }
        }

        setPrevPeriodRecords(prevRecords);

        if (prevRecords.length > 0 && prevClosingCash !== null) {
          openingCash = prevClosingCash;
        }

        const meta = {
          companyName,
          registrationNo,
          address,
          dateRange: period,
          openingCash,
          originalOpeningCash: openingCash,
          closingCash,
          pySchDepositInt,
          pySchDepositDue,
          pySchDepositLastDue,
          pySchBorrowingInt,
          pySchBorrowingDue,
          pySchBorrowingLastDue,
          pySchLoanInt,
          pySchLoanDue,
          pySchLoanLastDue,
          pyPlInvestmentInterest,
          pyPlMiscIncome,
          pyPlEstablishment,
          pyPlDepreciation,
          pyPlProvisionStandard,
          pyPlProvisionNpa,
          pyPlOverdueInterest,
          pyPlAuditFees,
          pyPlProfit,
          pyPlLoss,
        };

        setCoopMetadata(meta);

        const recordsWithOriginal = normalRecords.map(r => {
          let ob = r.openingBalance || 0;
          if (prevRecords.length > 0 && ob === 0) {
            let match = prevRecords.find(p => String(p.code) === String(r.code));
            if (!match) {
              match = prevRecords.find(p => p.head.toLowerCase().trim() === r.head.toLowerCase().trim());
            }
            if (match) {
              ob = match.endingBalance || 0;
            }
          }
          return {
            ...r,
            openingBalance: ob,
            originalOpeningBalance: ob
          };
        });
        setCoopRecords(recordsWithOriginal);

        // Find Capital and populate inputs
        const capRecord = normalRecords.find(r => r.type === 'Paid Up Share Capital');
        if (capRecord) {
          setAuthorisedShareCapital(2100000);
          setPrevAuthorisedShareCapital(2100000);
        }

        // Load saved NPA summary rows if present
        const npaRecord = systemMetadata.find(r => r.code === 'SYS_NPA_ROWS');
        if (npaRecord && npaRecord.head) {
          try {
            const parsedNpa = JSON.parse(npaRecord.head);
            setNpaRows(parsedNpa);
          } catch (e) {
            console.error("Error parsing saved NPA rows:", e);
            setNpaRows(defaultNpaRows);
          }
        } else {
          setNpaRows(defaultNpaRows);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorCoop('Failed to fetch ledger records for the selected period.');
    } finally {
      setLoadingCoop(false);
    }
  };

  const handleCompanyChange = (e) => {
    const val = e.target.value;
    setSelectedCompany(val);
    fetchPeriods(val);
  };

  const handlePeriodChange = (e) => {
    const val = e.target.value;
    setSelectedPeriod(val);
    fetchLedgerData(selectedCompany, val);
  };

  const handlePyCategoryChange = (category, val) => {
    const floatVal = parseFloat(val || 0);
    if (category === 'Cash in Hand') {
      setCoopMetadata(prev => ({ ...prev, openingCash: floatVal }));
      return;
    }

    // Also update prevPeriodRecords if it exists!
    setPrevPeriodRecords(prev => {
      let found = false;
      return prev.map(r => {
        if (r.type === category) {
          if (!found) {
            found = true;
            return {
              ...r,
              endingBalance: floatVal,
              openingBalance: r.openingBalance
            };
          } else {
            return {
              ...r,
              endingBalance: 0
            };
          }
        }
        return r;
      });
    });

    setCoopRecords(prev => {
      const existing = prev.filter(r => r.type === category);
      if (existing.length === 0) {
        const newRec = {
          code: 'SYS_' + category.toUpperCase().replace(/[^A-Z]/g, '_'),
          head: 'Carried ' + category,
          openingBalance: floatVal,
          originalOpeningBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          type: category
        };
        return [...prev, newRec];
      } else {
        let found = false;
        return prev.map(r => {
          if (r.type === category) {
            if (!found) {
              found = true;
              return {
                ...r,
                openingBalance: floatVal,
                originalOpeningBalance: r.originalOpeningBalance !== undefined ? r.originalOpeningBalance : (r.openingBalance || 0)
              };
            } else {
              return {
                ...r,
                openingBalance: 0,
                originalOpeningBalance: r.originalOpeningBalance !== undefined ? r.originalOpeningBalance : (r.openingBalance || 0)
              };
            }
          }
          return r;
        });
      }
    });
  };

  const handlePyMetadataChange = (key, val) => {
    const floatVal = parseFloat(val || 0);
    setCoopMetadata(prev => ({
      ...prev,
      [key]: floatVal
    }));
  };

  const handleSaveCoopEdits = async () => {
    if (!selectedCompany || !selectedPeriod || coopRecords.length === 0 || !coopMetadata) return;
    setSavingCoop(true);
    setSaveSuccessCoop('');
    setSaveErrorCoop('');

    const recordsToSave = coopRecords.map(r => ({
      code: r.code,
      head: r.head,
      openingBalance: parseFloat(r.openingBalance || 0),
      totalCredit: parseFloat(r.totalCredit || 0),
      totalDebit: parseFloat(r.totalDebit || 0),
      endingBalance: parseFloat(r.endingBalance || 0),
      detailListBalance: parseFloat(r.detailListBalance !== undefined ? r.detailListBalance : (r.endingBalance || 0)),
      type: r.type
    }));

    // Add System Metadata
    recordsToSave.push({
      code: 'SYS_OP_CASH',
      head: 'Opening Cash Balance',
      openingBalance: parseFloat(coopMetadata.openingCash || 0),
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: parseFloat(coopMetadata.openingCash || 0),
      type: 'SystemMetadata'
    });
    recordsToSave.push({
      code: 'SYS_CL_CASH',
      head: 'Closing Cash Balance',
      openingBalance: parseFloat(coopMetadata.closingCash || 0),
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: parseFloat(coopMetadata.closingCash || 0),
      type: 'SystemMetadata'
    });
    recordsToSave.push({
      code: 'SYS_REG_NO',
      head: coopMetadata.registrationNo || '',
      openingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: 0,
      type: 'SystemMetadata'
    });
    recordsToSave.push({
      code: 'SYS_ADDR',
      head: coopMetadata.address || '',
      openingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: 0,
      type: 'SystemMetadata'
    });

    const pushMeta = (code, val) => {
      recordsToSave.push({
        code,
        head: code,
        openingBalance: parseFloat(val || 0),
        totalCredit: 0,
        totalDebit: 0,
        endingBalance: parseFloat(val || 0),
        type: 'SystemMetadata'
      });
    };

    pushMeta('SYS_PY_SCH_DEP_INT', coopMetadata.pySchDepositInt);
    pushMeta('SYS_PY_SCH_DEP_DUE', coopMetadata.pySchDepositDue);
    pushMeta('SYS_PY_SCH_DEP_LDUE', coopMetadata.pySchDepositLastDue);
    pushMeta('SYS_PY_SCH_BORR_INT', coopMetadata.pySchBorrowingInt);
    pushMeta('SYS_PY_SCH_BORR_DUE', coopMetadata.pySchBorrowingDue);
    pushMeta('SYS_PY_SCH_BORR_LDUE', coopMetadata.pySchBorrowingLastDue);
    pushMeta('SYS_PY_SCH_LOAN_INT', coopMetadata.pySchLoanInt);
    pushMeta('SYS_PY_SCH_LOAN_DUE', coopMetadata.pySchLoanDue);
    pushMeta('SYS_PY_SCH_LOAN_LDUE', coopMetadata.pySchLoanLastDue);
    pushMeta('SYS_PY_PL_INV_INT', coopMetadata.pyPlInvestmentInterest);
    pushMeta('SYS_PY_PL_MISC_INC', coopMetadata.pyPlMiscIncome);
    pushMeta('SYS_PY_PL_EST', coopMetadata.pyPlEstablishment);
    pushMeta('SYS_PY_PL_DEP', coopMetadata.pyPlDepreciation);
    pushMeta('SYS_PY_PL_PROV_STD', coopMetadata.pyPlProvisionStandard);
    pushMeta('SYS_PY_PL_PROV_NPA', coopMetadata.pyPlProvisionNpa);
    pushMeta('SYS_PY_PL_OD_INT', coopMetadata.pyPlOverdueInterest);
    pushMeta('SYS_PY_PL_AUDIT', coopMetadata.pyPlAuditFees);
    pushMeta('SYS_PY_PL_PROFIT', coopMetadata.pyPlProfit);
    pushMeta('SYS_PY_PL_LOSS', coopMetadata.pyPlLoss);

    recordsToSave.push({
      code: 'SYS_NPA_ROWS',
      head: JSON.stringify(npaRows),
      openingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: 0,
      type: 'SystemMetadata'
    });

    try {
      const prevPeriod = getPreviousYear(selectedPeriod);
      if (prevPeriod) {
        if (prevPeriodRecords.length > 0) {
          // Map edited opening balances from coopRecords to endingBalance in prevPeriodRecords
          const prevRecordsToSave = prevPeriodRecords.map(pr => {
            let match = coopRecords.find(r => String(r.code) === String(pr.code));
            if (!match) {
              match = coopRecords.find(r => r.head.toLowerCase().trim() === pr.head.toLowerCase().trim());
            }

            let endingVal = pr.endingBalance;
            if (match) {
              endingVal = parseFloat(match.openingBalance || 0);
            }

            return {
              code: pr.code,
              head: pr.head,
              openingBalance: parseFloat(pr.openingBalance || 0),
              totalCredit: parseFloat(pr.totalCredit || 0),
              totalDebit: parseFloat(pr.totalDebit || 0),
              endingBalance: endingVal,
              detailListBalance: parseFloat(pr.detailListBalance !== undefined ? pr.detailListBalance : endingVal),
              type: pr.type
            };
          });

          // Forward cash! In prevRecordsToSave, the closing cash (SYS_CL_CASH) should be equal to the current year's opening cash (coopMetadata.openingCash).
          const prevClCashIdx = prevRecordsToSave.findIndex(pr => pr.code === 'SYS_CL_CASH');
          if (prevClCashIdx !== -1) {
            prevRecordsToSave[prevClCashIdx].openingBalance = parseFloat(coopMetadata.openingCash || 0);
            prevRecordsToSave[prevClCashIdx].endingBalance = parseFloat(coopMetadata.openingCash || 0);
          }

          const prevResponse = await fetch('http://localhost:3001/api/ledger-balances', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyName: selectedCompany,
              period: prevPeriod,
              records: prevRecordsToSave
            }),
          });

          if (!prevResponse.ok) {
            throw new Error('Failed to save previous year statement updates.');
          }
        } else {
          // Build previous year initial records using opening balances of current year
          const prevRecordsToSave = coopRecords.map(r => ({
            code: r.code,
            head: r.head,
            openingBalance: 0,
            totalCredit: 0,
            totalDebit: 0,
            endingBalance: parseFloat(r.openingBalance || 0),
            detailListBalance: parseFloat(r.openingBalance || 0),
            type: r.type
          }));

          prevRecordsToSave.push({
            code: 'SYS_OP_CASH',
            head: 'Opening Cash Balance',
            openingBalance: 0,
            totalCredit: 0,
            totalDebit: 0,
            endingBalance: 0,
            type: 'SystemMetadata'
          });
          prevRecordsToSave.push({
            code: 'SYS_CL_CASH',
            head: 'Closing Cash Balance',
            openingBalance: parseFloat(coopMetadata.openingCash || 0),
            totalCredit: 0,
            totalDebit: 0,
            endingBalance: parseFloat(coopMetadata.openingCash || 0),
            type: 'SystemMetadata'
          });
          prevRecordsToSave.push({
            code: 'SYS_REG_NO',
            head: coopMetadata.registrationNo || '',
            openingBalance: 0,
            totalCredit: 0,
            totalDebit: 0,
            endingBalance: 0,
            type: 'SystemMetadata'
          });
          prevRecordsToSave.push({
            code: 'SYS_ADDR',
            head: coopMetadata.address || '',
            openingBalance: 0,
            totalCredit: 0,
            totalDebit: 0,
            endingBalance: 0,
            type: 'SystemMetadata'
          });

          const pushPrevMeta = (code, val) => {
            prevRecordsToSave.push({
              code,
              head: code,
              openingBalance: parseFloat(val || 0),
              totalCredit: 0,
              totalDebit: 0,
              endingBalance: parseFloat(val || 0),
              type: 'SystemMetadata'
            });
          };

          pushPrevMeta('SYS_PY_SCH_DEP_INT', coopMetadata.pySchDepositInt);
          pushPrevMeta('SYS_PY_SCH_DEP_DUE', coopMetadata.pySchDepositDue);
          pushPrevMeta('SYS_PY_SCH_DEP_LDUE', coopMetadata.pySchDepositLastDue);
          pushPrevMeta('SYS_PY_SCH_BORR_INT', coopMetadata.pySchBorrowingInt);
          pushPrevMeta('SYS_PY_SCH_BORR_DUE', coopMetadata.pySchBorrowingDue);
          pushPrevMeta('SYS_PY_SCH_BORR_LDUE', coopMetadata.pySchBorrowingLastDue);
          pushPrevMeta('SYS_PY_SCH_LOAN_INT', coopMetadata.pySchLoanInt);
          pushPrevMeta('SYS_PY_SCH_LOAN_DUE', coopMetadata.pySchLoanDue);
          pushPrevMeta('SYS_PY_SCH_LOAN_LDUE', coopMetadata.pySchLoanLastDue);
          pushPrevMeta('SYS_PY_PL_INV_INT', coopMetadata.pyPlInvestmentInterest);
          pushPrevMeta('SYS_PY_PL_MISC_INC', coopMetadata.pyPlMiscIncome);
          pushPrevMeta('SYS_PY_PL_EST', coopMetadata.pyPlEstablishment);
          pushPrevMeta('SYS_PY_PL_DEP', coopMetadata.pyPlDepreciation);
          pushPrevMeta('SYS_PY_PL_PROV_STD', coopMetadata.pyPlProvisionStandard);
          pushPrevMeta('SYS_PY_PL_PROV_NPA', coopMetadata.pyPlProvisionNpa);
          pushPrevMeta('SYS_PY_PL_OD_INT', coopMetadata.pyPlOverdueInterest);
          pushPrevMeta('SYS_PY_PL_AUDIT', coopMetadata.pyPlAuditFees);
          pushPrevMeta('SYS_PY_PL_PROFIT', coopMetadata.pyPlProfit);
          pushPrevMeta('SYS_PY_PL_LOSS', coopMetadata.pyPlLoss);

          const prevResponse = await fetch('http://localhost:3001/api/ledger-balances', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyName: selectedCompany,
              period: prevPeriod,
              records: prevRecordsToSave
            }),
          });

          if (!prevResponse.ok) {
            throw new Error('Failed to save previous year statement updates.');
          }
        }
      }

      const response = await fetch('http://localhost:3001/api/ledger-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: selectedCompany,
          period: selectedPeriod,
          records: recordsToSave
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save statement updates to database.');
      }

      setSaveSuccessCoop('All balance updates successfully saved to the database!');
      setTimeout(() => setSaveSuccessCoop(''), 5000);
      
      // Re-fetch to synchronize state
      fetchLedgerData(selectedCompany, selectedPeriod);
    } catch (err) {
      console.error(err);
      setSaveErrorCoop(err.message || 'Error occurred while saving statements.');
    } finally {
      setSavingCoop(false);
    }
  };

  // Helper for original date formatting
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Fetch Transaction Reports (Original Logic)
  const handleFetchReport = async (e, customFrom, customTo) => {
    if (e) e.preventDefault();
    const fDate = customFrom || fromDate;
    const tDate = customTo || toDate;

    if (!fDate || !tDate) return;

    setLoadingTx(true);
    setErrorTx('');
    try {
      const fetchWithTimeout = async (url, options = {}) => {
        const { timeout = 10000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      };

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

      const sanitizedData = data.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount || 0)
      }));

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
      setSearchedTx(true);
    } catch (err) {
      console.error('Error fetching report:', err);
      let msg = err.message;
      if (err.name === 'AbortError') {
        msg = 'Request timed out. Please check if the backend server is running.';
      } else if (msg.includes('Failed to fetch')) {
        msg = 'Could not connect to the backend server.';
      }
      setErrorTx(msg);
      setSearchedTx(false);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleDaybookFetch = (e) => {
    e.preventDefault();
    if (!dayFromDate || !dayToDate) return;
    handleFetchReport(null, dayFromDate, dayToDate);
  };

  const handlePrint = () => {
    window.print();
  };

  // Financial Calculations for Statements (Database Derived)
  const calculateCoopReports = () => {
    if (!coopRecords || coopRecords.length === 0 || !coopMetadata) return null;

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

    // 1. Trial Balance Calculation
    // Pre-calculate sums for symmetric cash balancing
    const aeDebitSum = coopRecords.filter(r => isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalDebit || 0), 0);
    const aeCreditSum = coopRecords.filter(r => isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalCredit || 0), 0);
    const liDebitSum = coopRecords.filter(r => !isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalDebit || 0), 0);
    const liCreditSum = coopRecords.filter(r => !isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalCredit || 0), 0);

    const totalReceipts = aeCreditSum + liCreditSum;
    const totalPayments = aeDebitSum + liDebitSum;

    const standardizeLoanName = (name) => {
      if (!name) return '';
      let cleaned = name.trim();
      cleaned = cleaned.replace(/SELF-\s+HELP/gi, 'SELF-HELP');
      cleaned = cleaned.replace(/SELF\s+HELP/gi, 'SELF-HELP');
      cleaned = cleaned.replace(/\s*-\s*CURRENT\s*$/i, '');
      cleaned = cleaned.replace(/\s*-\s*OVERDUE\s*$/i, '');
      cleaned = cleaned.replace(/\s*\(\s*CURRENT\s*\)\s*$/i, '');
      cleaned = cleaned.replace(/\s*\(\s*OVERDUE\s*\)\s*$/i, '');
      cleaned = cleaned.replace(/\s*[-\/]\s*$/g, '');
      cleaned = cleaned.replace(/\s+/g, ' ');
      return cleaned.trim();
    };

    const normalLines = coopRecords.map(r => {
      const ob = r.openingBalance || 0;
      const originalOb = r.originalOpeningBalance !== undefined ? r.originalOpeningBalance : ob;
      const isDebit = isDebitNormal(r.type);
      
      const endingVal = isDebit 
        ? originalOb + (r.totalDebit - r.totalCredit)
        : originalOb + (r.totalCredit - r.totalDebit);

      return {
        code: r.code,
        head: r.head,
        openingBalance: ob,
        totalDebit: r.totalDebit || 0,
        totalCredit: r.totalCredit || 0,
        endingBalance: endingVal,
        type: r.type,
      };
    });

    const consolidatedNormalLines = [];
    const loanGroups = {};
    
    normalLines.forEach(l => {
      if (l.type === 'Loan and Advance') {
        const stdHead = standardizeLoanName(l.head);
        if (!loanGroups[stdHead]) {
          loanGroups[stdHead] = {
            codes: [],
            head: stdHead,
            openingBalance: 0,
            totalDebit: 0,
            totalCredit: 0,
            endingBalance: 0,
            type: 'Loan and Advance'
          };
        }
        loanGroups[stdHead].codes.push(l.code);
        loanGroups[stdHead].openingBalance += l.openingBalance;
        loanGroups[stdHead].totalDebit += l.totalDebit;
        loanGroups[stdHead].totalCredit += l.totalCredit;
        loanGroups[stdHead].endingBalance += l.endingBalance;
      } else {
        consolidatedNormalLines.push(l);
      }
    });

    Object.values(loanGroups).forEach(g => {
      const uniqueCodes = [...new Set(g.codes)].sort();
      let combinedCode = uniqueCodes.join(' / ');
      if (uniqueCodes.length === 2 && uniqueCodes[0].substring(0, 4) === uniqueCodes[1].substring(0, 4)) {
        const diffPart = uniqueCodes[1].substring(4);
        combinedCode = `${uniqueCodes[0]}/${diffPart}`;
      }
      consolidatedNormalLines.push({
        code: combinedCode,
        head: g.head,
        openingBalance: Math.round(g.openingBalance * 100) / 100,
        totalDebit: Math.round(g.totalDebit * 100) / 100,
        totalCredit: Math.round(g.totalCredit * 100) / 100,
        endingBalance: Math.round(g.endingBalance * 100) / 100,
        type: g.type
      });
    });

    const tbLines = consolidatedNormalLines.map(l => {
      const isDebit = isDebitNormal(l.type);
      return {
        ...l,
        debit: isDebit && l.endingBalance > 0 ? l.endingBalance : (!isDebit && l.endingBalance < 0 ? -l.endingBalance : 0),
        credit: !isDebit && l.endingBalance > 0 ? l.endingBalance : (isDebit && l.endingBalance < 0 ? -l.endingBalance : 0),
      };
    });

    // Add Cash in hand closing
    tbLines.push({
      code: 'CASH',
      head: 'Cash Account (Closing)',
      openingBalance: coopMetadata.openingCash,
      totalDebit: totalReceipts,
      totalCredit: totalPayments,
      endingBalance: coopMetadata.closingCash,
      type: 'Asset',
      debit: coopMetadata.closingCash,
      credit: 0,
    });
    
    // Add Cash in hand opening
    tbLines.push({
      code: 'OP_CASH',
      head: 'Cash in Hand (Opening)',
      openingBalance: coopMetadata.openingCash,
      totalDebit: aeDebitSum + aeCreditSum,
      totalCredit: aeDebitSum + aeCreditSum,
      endingBalance: coopMetadata.originalOpeningCash !== undefined ? coopMetadata.originalOpeningCash : coopMetadata.openingCash,
      type: 'Paid Up Share Capital',
      debit: 0,
      credit: coopMetadata.originalOpeningCash !== undefined ? coopMetadata.originalOpeningCash : coopMetadata.openingCash,
    });

    // Calculate P&L Opening Balance for Trial Balance injection
    let effectivePyPL = 0;
    {
      const isDebitNormalLocal = (category) => [
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

      let sumDebitNormalOB = 0;
      let sumCreditNormalOB = 0;
      let totalDebitSum = 0;
      let totalCreditSum = 0;

      coopRecords.forEach(r => {
        const isDebit = isDebitNormalLocal(r.type);
        const ob = r.openingBalance || 0;
        if (isDebit) {
          sumDebitNormalOB += ob;
        } else {
          sumCreditNormalOB += ob;
        }
        totalDebitSum += r.totalDebit || 0;
        totalCreditSum += r.totalCredit || 0;
      });

      const closingCash = coopMetadata.closingCash || 0;
      const openingCash = coopMetadata.openingCash || 0;

      effectivePyPL = (sumDebitNormalOB - sumCreditNormalOB) + (totalDebitSum - totalCreditSum) + (closingCash - openingCash);
    }

    // Add Profit & Loss Account (Opening/Carried)
    if (Math.abs(effectivePyPL) > 0.01) {
      const plIsLiability = effectivePyPL >= 0;
      tbLines.push({
        code: 'PL_OP',
        head: 'Profit & Loss Account (Opening)',
        openingBalance: Math.abs(effectivePyPL),
        totalDebit: 0,
        totalCredit: 0,
        endingBalance: Math.abs(effectivePyPL),
        type: plIsLiability ? 'Reserves' : 'Asset',
        debit: !plIsLiability ? Math.abs(effectivePyPL) : 0,
        credit: plIsLiability ? Math.abs(effectivePyPL) : 0,
      });
    }

    const tbTotalDebit = tbLines.reduce((acc, l) => acc + l.debit, 0);
    const tbTotalCredit = tbLines.reduce((acc, l) => acc + l.credit, 0);

    // 2. Profit & Loss Statement Calculation
    const incomeItems = coopRecords
      .filter(r => r.type === 'Income')
      .map(r => ({
        code: r.code,
        head: r.head,
        amount: r.totalCredit - r.totalDebit,
      }));
    const totalIncome = incomeItems.reduce((acc, i) => acc + i.amount, 0);

    const expenseItems = coopRecords
      .filter(r => r.type === 'Expense')
      .map(r => ({
        code: r.code,
        head: r.head,
        amount: r.totalDebit - r.totalCredit,
      }));
    const totalExpenses = expenseItems.reduce((acc, e) => acc + e.amount, 0);

    const netProfit = totalIncome - totalExpenses;

    // Helper functions for aggregations
    const getPrevSum = (category) => {
      return coopRecords
        .filter(r => r.type === category)
        .reduce((acc, r) => acc + (r.openingBalance || 0), 0);
    };

    const getCurrSum = (category) => {
      return coopRecords
        .filter(r => r.type === category)
        .reduce((acc, r) => {
          const ob = r.originalOpeningBalance !== undefined ? r.originalOpeningBalance : (r.openingBalance || 0);
          const net = r.totalDebit - r.totalCredit;
          const isDebit = isDebitNormal(category);
          return acc + (isDebit ? ob + net : ob - net);
        }, 0);
    };

    // Category aggregations for Balance Sheet
    const pyPaidUpShareCapital = getPrevSum('Paid Up Share Capital');
    const pyReserves = getPrevSum('Reserves');
    const pyGrants = getPrevSum('Grants and Other Funds');
    const pyDeposits = getPrevSum('Deposits');
    const pyBorrowings = getPrevSum('Borrowings');
    const pyOtherLiabilities = getPrevSum('Other Liabilities');
    const pyProvisions = getPrevSum('Provisions');
    const pyPL_Liability = getPrevSum('Profit and Loss Account (Liability)');

    const cyPaidUpShareCapital = getCurrSum('Paid Up Share Capital');
    const cyReserves = getCurrSum('Reserves');
    const cyGrants = getCurrSum('Grants and Other Funds');
    const cyDeposits = getCurrSum('Deposits');
    const cyBorrowings = getCurrSum('Borrowings');
    const cyOtherLiabilities = getCurrSum('Other Liabilities');
    const cyProvisions = getCurrSum('Provisions');

    const pyPL_Asset = getPrevSum('Profit and Loss Account (Asset)');


    // Assets for PY:
    const pyCashInHand = coopMetadata.openingCash;
    const pyBalanceMddccb = getPrevSum('Balance with MDDCCB Bank');
    const pyBalanceOtherBanks = getPrevSum('Balance with Other Banks');
    const pyInvestment = getPrevSum('Investment');
    const pyLoanAndAdvance = getPrevSum('Loan and Advance');
    const pyClosingStock = getPrevSum('Closing Stock');
    const pyFixedAssets = getPrevSum('Fixed Assets');
    const pyOtherAssets = getPrevSum('Other Assets');

    const cyCashInHand = coopMetadata.closingCash;
    const cyBalanceMddccb = getCurrSum('Balance with MDDCCB Bank');
    const cyBalanceOtherBanks = getCurrSum('Balance with Other Banks');
    const cyInvestment = getCurrSum('Investment');
    const cyLoanAndAdvance = getCurrSum('Loan and Advance');
    const cyClosingStock = getCurrSum('Closing Stock');
    const cyFixedAssets = getCurrSum('Fixed Assets');
    const cyOtherAssets = getCurrSum('Other Assets');

    // Balance opening cash against P&L liabilities/assets if no carrying balances exist
    const pyAssetsTotal_except_PL = 
      pyCashInHand + 
      pyBalanceMddccb + 
      pyBalanceOtherBanks + 
      pyInvestment + 
      pyLoanAndAdvance + 
      pyClosingStock + 
      pyFixedAssets + 
      pyOtherAssets;

    const pyLiabilitiesTotal_except_PL = 
      pyPaidUpShareCapital + 
      pyReserves + 
      pyGrants + 
      pyDeposits + 
      pyBorrowings + 
      pyOtherLiabilities + 
      pyProvisions;

    const calculatedPyPL = pyAssetsTotal_except_PL - pyLiabilitiesTotal_except_PL;
    let pyPL_Liability_effective = pyPL_Liability;
    let pyPL_Asset_effective = pyPL_Asset;

    if (pyPL_Liability === 0 && pyPL_Asset === 0) {
      if (calculatedPyPL >= 0) {
        pyPL_Liability_effective = calculatedPyPL;
      } else {
        pyPL_Asset_effective = -calculatedPyPL;
      }
    }

    const cyAssetsTotal_except_PL = 
      cyCashInHand + 
      cyBalanceMddccb + 
      cyBalanceOtherBanks + 
      cyInvestment + 
      cyLoanAndAdvance + 
      cyClosingStock + 
      cyFixedAssets + 
      cyOtherAssets;

    const cyLiabilitiesTotal_except_PL = 
      cyPaidUpShareCapital + 
      cyReserves + 
      cyGrants + 
      cyDeposits + 
      cyBorrowings + 
      cyOtherLiabilities + 
      cyProvisions;

    const netPLTotal = cyAssetsTotal_except_PL - cyLiabilitiesTotal_except_PL;
    const cyPL_Liability = netPLTotal >= 0 ? netPLTotal : 0;
    const cyPL_Asset = netPLTotal < 0 ? -netPLTotal : 0;

    const pyLiabilitiesTotal = 
      pyPaidUpShareCapital + 
      pyReserves + 
      pyGrants + 
      pyDeposits + 
      pyBorrowings + 
      pyOtherLiabilities + 
      pyProvisions + 
      pyPL_Liability_effective;

    const pyAssetsTotal = 
      pyCashInHand + 
      pyBalanceMddccb + 
      pyBalanceOtherBanks + 
      pyInvestment + 
      pyLoanAndAdvance + 
      pyClosingStock + 
      pyFixedAssets + 
      pyOtherAssets + 
      pyPL_Asset_effective;

    const cyLiabilitiesTotal = 
      cyPaidUpShareCapital + 
      cyReserves + 
      cyGrants + 
      cyDeposits + 
      cyBorrowings + 
      cyOtherLiabilities + 
      cyProvisions + 
      cyPL_Liability;

    const cyAssetsTotal = 
      cyCashInHand + 
      cyBalanceMddccb + 
      cyBalanceOtherBanks + 
      cyInvestment + 
      cyLoanAndAdvance + 
      cyClosingStock + 
      cyFixedAssets + 
      cyOtherAssets + 
      cyPL_Asset;

    const openingAssets = pyAssetsTotal;
    const openingLiabilities = pyLiabilitiesTotal;
    const openingDiff = Math.abs(openingAssets - openingLiabilities);
    const openingBalanced = openingDiff < 0.1;

    const aeTypes = [
      'Balance with MDDCCB Bank',
      'Balance with Other Banks',
      'Investment',
      'Loan and Advance',
      'Closing Stock',
      'Fixed Assets',
      'Other Assets',
      'Expense',
      'Asset'
    ];
    const aeLines = tbLines.filter(l => aeTypes.includes(l.type) || l.code === 'CASH');
    const aeOB = aeLines.reduce((acc, l) => acc + (l.openingBalance || 0), 0);
    const aeDr = aeLines.reduce((acc, l) => acc + (l.totalDebit || 0), 0);
    const aeCr = aeLines.reduce((acc, l) => acc + (l.totalCredit || 0), 0);
    const aeEnding = aeLines.reduce((acc, l) => acc + (l.endingBalance || 0), 0);

    const liTypes = [
      'Paid Up Share Capital',
      'Reserves',
      'Grants and Other Funds',
      'Deposits',
      'Borrowings',
      'Other Liabilities',
      'Provisions',
      'Profit and Loss Account (Liability)',
      'Income'
    ];
    const liLines = tbLines.filter(l => liTypes.includes(l.type) || l.code === 'OP_CASH');
    const liOB = liLines.reduce((acc, l) => acc + (l.openingBalance || 0), 0);
    const liDr = liLines.reduce((acc, l) => acc + (l.totalDebit || 0), 0);
    const liCr = liLines.reduce((acc, l) => acc + (l.totalCredit || 0), 0);
    const liEnding = liLines.reduce((acc, l) => acc + (l.endingBalance || 0), 0);

    // Filter sub-items for schedules
    const getSubitems = (category) => {
      const filtered = coopRecords.filter(r => r.type === category);
      if (category === 'Loan and Advance') {
        const groups = {};
        filtered.forEach(r => {
          const stdHead = standardizeLoanName(r.head);
          if (!groups[stdHead]) {
            groups[stdHead] = {
              codes: [],
              head: stdHead,
              cy: 0,
              py: 0,
              detailListBalance: 0
            };
          }
          const ob = r.openingBalance || 0;
          const net = r.totalDebit - r.totalCredit;
          const cyVal = ob + net;
          groups[stdHead].codes.push(r.code);
          groups[stdHead].cy += cyVal;
          groups[stdHead].py += ob;
          groups[stdHead].detailListBalance += r.detailListBalance !== undefined ? r.detailListBalance : cyVal;
        });

        return Object.values(groups).map(g => {
          const uniqueCodes = [...new Set(g.codes)].sort();
          let combinedCode = uniqueCodes.join(' / ');
          if (uniqueCodes.length === 2 && uniqueCodes[0].substring(0, 4) === uniqueCodes[1].substring(0, 4)) {
            const diffPart = uniqueCodes[1].substring(4);
            combinedCode = `${uniqueCodes[0]}/${diffPart}`;
          }
          return {
            code: combinedCode,
            head: g.head,
            cy: Math.round(g.cy * 100) / 100,
            py: Math.round(g.py * 100) / 100,
            detailListBalance: Math.round(g.detailListBalance * 100) / 100
          };
        });
      }

      return filtered.map(r => {
        const ob = r.openingBalance || 0;
        const net = r.totalDebit - r.totalCredit;
        const isDebit = isDebitNormal(category);
        const cyVal = isDebit ? ob + net : ob - net;
        return {
          code: r.code,
          head: r.head,
          cy: cyVal,
          py: ob,
          detailListBalance: r.detailListBalance !== undefined ? r.detailListBalance : cyVal
        };
      });
    };

    return {
      tbLines,
      tbTotalDebit,
      tbTotalCredit,
      tbSummary: {
        aeOB,
        aeDr,
        aeCr,
        aeEnding,
        liOB,
        liDr,
        liCr,
        liEnding,
        isBalanced: Math.abs(aeOB - liOB) < 0.1 && Math.abs(aeDr - liCr) < 0.1 && Math.abs(aeCr - liDr) < 0.1 && Math.abs(aeEnding - liEnding) < 0.1
      },
      incomeItems,
      totalIncome,
      expenseItems,
      totalExpenses,
      netProfit,
      
      pyPaidUpShareCapital,
      pyReserves,
      pyGrants,
      pyDeposits,
      pyBorrowings,
      pyOtherLiabilities,
      pyProvisions,
      pyPL_Liability,
      pyCashInHand,
      pyBalanceMddccb,
      pyBalanceOtherBanks,
      pyInvestment,
      pyLoanAndAdvance,
      pyClosingStock,
      pyFixedAssets,
      pyOtherAssets,
      pyPL_Asset,

      cyPaidUpShareCapital,
      cyReserves,
      cyGrants,
      cyDeposits,
      cyBorrowings,
      cyOtherLiabilities,
      cyProvisions,
      cyPL_Liability,
      cyCashInHand,
      cyBalanceMddccb,
      cyBalanceOtherBanks,
      cyInvestment,
      cyLoanAndAdvance,
      cyClosingStock,
      cyFixedAssets,
      cyOtherAssets,
      cyPL_Asset,

      pyLiabilitiesTotal,
      pyAssetsTotal,
      cyLiabilitiesTotal,
      cyAssetsTotal,
      
      openingAssets,
      openingLiabilities,
      openingDiff,
      openingBalanced,

      // Detail Breakups for Schedules
      subitems: {
        mddccb: getSubitems('Balance with MDDCCB Bank'),
        otherBanks: getSubitems('Balance with Other Banks'),
        investment: getSubitems('Investment'),
        loans: getSubitems('Loan and Advance'),
        fixed: getSubitems('Fixed Assets'),
        otherAssets: getSubitems('Other Assets'),
        paidup: getSubitems('Paid Up Share Capital'),
        reserves: getSubitems('Reserves'),
        grants: getSubitems('Grants and Other Funds'),
        deposits: getSubitems('Deposits'),
        borrowings: getSubitems('Borrowings'),
        otherLiabilities: getSubitems('Other Liabilities'),
        provisions: getSubitems('Provisions'),
      }
    };
  };

  const coopReports = calculateCoopReports();

  // Dynamic mapper helper for Profit and Loss
  const getPLValues = () => {
    if (!coopReports || !coopRecords) return null;

    const getExpenseVal = (keyword) => {
      return coopRecords
        .filter(r => r.type === 'Expense' && r.head.toLowerCase().includes(keyword.toLowerCase()))
        .reduce((acc, r) => acc + (r.totalDebit - r.totalCredit), 0);
    };

    const getIncomeVal = (keyword) => {
      return coopRecords
        .filter(r => r.type === 'Income' && r.head.toLowerCase().includes(keyword.toLowerCase()))
        .reduce((acc, r) => acc + (r.totalCredit - r.totalDebit), 0);
    };

    // Expenditure Mappings
    const depositInt = getExpenseVal('deposit');
    const borrowingInt = getExpenseVal('borrowing');
    const totalInterestPaid = depositInt + borrowingInt;

    const salaryExp = getExpenseVal('salary');
    // Compute Management Expenses as the remainder of non-interest, non-allocations expenses
    const depreciationVal = getExpenseVal('depreciation');
    const gratuityVal = getExpenseVal('gratuity');
    const leaveSalaryVal = getExpenseVal('leave salary');
    const staffWelfareVal = getExpenseVal('staff welfare');
    const memberWelfareVal = getExpenseVal('member welfare');
    const buildingFundVal = getExpenseVal('building');
    const provisionNpaVal = Math.round(npaRows.reduce((acc, r) => acc + (r.substandard * 0.10) + (r.d1 * 0.20) + (r.d2 * 0.30) + (r.d3 * 1.00), 0) * 100) / 100;
    const provisionStandardVal = getExpenseVal('provision for standard');
    const overdueInterestVal = getExpenseVal('provision for o.d');
    const auditFeesVal = getExpenseVal('audit');

    const totalAllocations = gratuityVal + leaveSalaryVal + staffWelfareVal + memberWelfareVal + buildingFundVal;
    const totalProvisions = provisionNpaVal + provisionStandardVal;

    const managementExp = coopReports.totalExpenses - (totalInterestPaid + salaryExp + depreciationVal + totalAllocations + totalProvisions + overdueInterestVal + auditFeesVal);

    // Income Mappings
    const loanInterestRec = getIncomeVal('loan');
    const investmentInterestRec = getIncomeVal('investment');
    const miscIncomeRec = coopReports.totalIncome - (loanInterestRec + investmentInterestRec);

    // Previous Year Computations
    const pyDepositIntTotal = (coopMetadata.pySchDepositInt !== undefined ? coopMetadata.pySchDepositInt : 287702.00) +
                              (coopMetadata.pySchDepositDue !== undefined ? coopMetadata.pySchDepositDue : 154979.00) -
                              (coopMetadata.pySchDepositLastDue !== undefined ? coopMetadata.pySchDepositLastDue : 56973.00);
    const pyBorrowingIntTotal = (coopMetadata.pySchBorrowingInt !== undefined ? coopMetadata.pySchBorrowingInt : 247021.00) +
                                (coopMetadata.pySchBorrowingDue !== undefined ? coopMetadata.pySchBorrowingDue : 21284.00) -
                                (coopMetadata.pySchBorrowingLastDue !== undefined ? coopMetadata.pySchBorrowingLastDue : 21582.00);
    const pyTotalInterestPaid = pyDepositIntTotal + pyBorrowingIntTotal;

    const pyLoanIntTotal = (coopMetadata.pySchLoanInt !== undefined ? coopMetadata.pySchLoanInt : 638949.00) +
                            (coopMetadata.pySchLoanDue !== undefined ? coopMetadata.pySchLoanDue : 108772.09) -
                            (coopMetadata.pySchLoanLastDue !== undefined ? coopMetadata.pySchLoanLastDue : 70022.00);

    const pyPlEstablishment = coopMetadata.pyPlEstablishment !== undefined ? coopMetadata.pyPlEstablishment : 390412.00;
    const pyPlDepreciation = coopMetadata.pyPlDepreciation !== undefined ? coopMetadata.pyPlDepreciation : 22377.00;
    const pyPlProvisionStandard = coopMetadata.pyPlProvisionStandard !== undefined ? coopMetadata.pyPlProvisionStandard : 0.00;
    const pyPlProvisionNpa = coopMetadata.pyPlProvisionNpa !== undefined ? coopMetadata.pyPlProvisionNpa : 0.00;
    const pyPlOverdueInterest = coopMetadata.pyPlOverdueInterest !== undefined ? coopMetadata.pyPlOverdueInterest : 0.00;
    const pyPlAuditFees = coopMetadata.pyPlAuditFees !== undefined ? coopMetadata.pyPlAuditFees : 9600.00;
    const pyPlProfit = coopMetadata.pyPlProfit !== undefined ? coopMetadata.pyPlProfit : 348940.77;

    const pyPlInvestmentInterest = coopMetadata.pyPlInvestmentInterest !== undefined ? coopMetadata.pyPlInvestmentInterest : 565098.00;
    const pyPlMiscIncome = coopMetadata.pyPlMiscIncome !== undefined ? coopMetadata.pyPlMiscIncome : 160963.68;
    const pyPlLoss = coopMetadata.pyPlLoss !== undefined ? coopMetadata.pyPlLoss : 0.00;

    const pyExpGrandTotal = pyTotalInterestPaid + pyPlEstablishment + pyPlDepreciation + pyPlProvisionStandard + pyPlProvisionNpa + pyPlOverdueInterest + pyPlAuditFees + pyPlProfit;
    const pyIncGrandTotal = pyLoanIntTotal + pyPlInvestmentInterest + pyPlMiscIncome + pyPlLoss;

    return {
      exp: {
        depositInt,
        borrowingInt,
        totalInterestPaid,
        salaryExp,
        managementExp,
        totalEstablishment: salaryExp + managementExp,
        depreciationVal,
        gratuityVal,
        leaveSalaryVal,
        staffWelfareVal,
        memberWelfareVal,
        buildingFundVal,
        provisionStandardVal,
        provisionNpaVal,
        overdueInterestVal,
        auditFeesVal,
        profit: coopReports.netProfit > 0 ? coopReports.netProfit : 0,
        grandTotal: Math.max(coopReports.totalIncome, coopReports.totalExpenses),
        // PY
        pyDepositIntTotal,
        pyBorrowingIntTotal,
        pyTotalInterestPaid,
        pyPlEstablishment,
        pyPlDepreciation,
        pyPlProvisionStandard,
        pyPlProvisionNpa,
        pyPlOverdueInterest,
        pyPlAuditFees,
        pyPlProfit,
        pyGrandTotal: pyExpGrandTotal
      },
      inc: {
        loanInterestRec,
        investmentInterestRec,
        miscIncomeRec,
        loss: coopReports.netProfit < 0 ? -coopReports.netProfit : 0,
        grandTotal: Math.max(coopReports.totalIncome, coopReports.totalExpenses),
        // PY
        pyLoanIntTotal,
        pyPlInvestmentInterest,
        pyPlMiscIncome,
        pyPlLoss,
        pyGrandTotal: pyIncGrandTotal
      }
    };
  };

  const plValues = getPLValues();

  // Excel export for Co-op Statements (8 Sheets)
  const handleExportCoopExcel = () => {
    if (!coopReports || !coopMetadata || !plValues) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Balance Sheet
    const sheet1Data = [
      [coopMetadata.companyName],
      [coopMetadata.registrationNo ? `Regd. No: ${coopMetadata.registrationNo}` : ''],
      [coopMetadata.address || ''],
      ['BALANCE SHEET STATEMENT'],
      [`As on: ${getEndDate(coopMetadata.dateRange)}`],
      [],
      ['LIABILITIES', 'SCH', 'CY (Current Year)', 'PY (Previous Year)', 'ASSETS', 'SCH', 'CY (Current Year)', 'PY (Previous Year)'],
      ['AUTHORISED SHARE CAPITAL', '1(i)', authorisedShareCapital, prevAuthorisedShareCapital, 'CASH IN HAND', '1', coopReports.cyCashInHand, coopReports.pyCashInHand],
      ['PAID UP SHARE CAPITAL', '1(iii)', coopReports.cyPaidUpShareCapital, coopReports.pyPaidUpShareCapital, 'BALANCE WITH MDDCCB BANK', '2', coopReports.cyBalanceMddccb, coopReports.pyBalanceMddccb],
      ['RESERVES', '2', coopReports.cyReserves, coopReports.pyReserves, 'BALANCE WITH OTHER BANKS', '3', coopReports.cyBalanceOtherBanks, coopReports.pyBalanceOtherBanks],
      ['GRANTS AND OTHER FUNDS', '3', coopReports.cyGrants, coopReports.pyGrants, 'INVESTMENT', '4', coopReports.cyInvestment, coopReports.pyInvestment],
      ['DEPOSITS', '4', coopReports.cyDeposits, coopReports.pyDeposits, 'LOAN AND ADVANCE', '5', coopReports.cyLoanAndAdvance, coopReports.pyLoanAndAdvance],
      ['BORROWINGS', '5', coopReports.cyBorrowings, coopReports.pyBorrowings, 'CLOSING STOCK', '6', coopReports.cyClosingStock, coopReports.pyClosingStock],
      ['OTHER LIABILITIES', '6', coopReports.cyOtherLiabilities, coopReports.pyOtherLiabilities, 'FIXED ASSETS', '7', coopReports.cyFixedAssets, coopReports.pyFixedAssets],
      ['PROVISIONS', '7', coopReports.cyProvisions, coopReports.pyProvisions, 'OTHER ASSETS', '8', coopReports.cyOtherAssets, coopReports.pyOtherAssets],
      ['PROFIT AND LOSS ACCOUNT', '8', coopReports.cyPL_Liability, coopReports.pyPL_Liability, 'PROFIT AND LOSS ACCOUNT', '9', coopReports.cyPL_Asset, coopReports.pyPL_Asset],
      ['GRAND TOTAL', '', coopReports.cyLiabilitiesTotal, coopReports.pyLiabilitiesTotal, 'GRAND TOTAL', '', coopReports.cyAssetsTotal, coopReports.pyAssetsTotal]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'Balance Sheet');

    // Sheet 2: Schedule of Assets
    const sheet2Data = [
      [coopMetadata.companyName],
      ['SCHEDULE OF ASSETS'],
      [`As on: ${getEndDate(coopMetadata.dateRange)}`],
      [],
      ['SL. NO', 'ASSETS', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)'],
      ['1', 'CASH IN HAND', '', coopReports.cyCashInHand, coopReports.pyCashInHand],
      ['2', 'BALANCE WITH MDDCCB BANK', '', coopReports.cyBalanceMddccb, coopReports.pyBalanceMddccb]
    ];
    coopReports.subitems.mddccb.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['3', 'BALANCE WITH OTHER BANKS', '', coopReports.cyBalanceOtherBanks, coopReports.pyBalanceOtherBanks]);
    coopReports.subitems.otherBanks.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['4', 'INVESTMENT', '', coopReports.cyInvestment, coopReports.pyInvestment]);
    coopReports.subitems.investment.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['5', 'LOAN AND ADVANCE', '', coopReports.cyLoanAndAdvance, coopReports.pyLoanAndAdvance]);
    coopReports.subitems.loans.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    const totalLoansCy = coopReports.subitems.loans.reduce((acc, l) => acc + l.cy, 0);
    const npaProvisionVal = Math.round(npaRows.reduce((acc, r) => acc + (r.substandard * 0.10) + (r.d1 * 0.20) + (r.d2 * 0.30) + (r.d3 * 1.00), 0) * 100) / 100;
    sheet2Data.push(['', '  (a) TOTAL', totalLoansCy, '', '']);
    sheet2Data.push(['', '  (b) LESS: PROVISION FOR NPA', npaProvisionVal, '', '']);
    sheet2Data.push(['', '  (c) LOANS AND ADVANCES NET OF PROVISIONS', totalLoansCy - npaProvisionVal, '', '']);
    sheet2Data.push(['6', 'CLOSING STOCK', '', coopReports.cyClosingStock, coopReports.pyClosingStock]);
    sheet2Data.push(['7', 'FIXED ASSETS', '', coopReports.cyFixedAssets, coopReports.pyFixedAssets]);
    coopReports.subitems.fixed.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['8', 'OTHER ASSETS', '', coopReports.cyOtherAssets, coopReports.pyOtherAssets]);
    const loanInterestItems = coopReports.subitems.otherAssets.filter(item => 
      item.head.toLowerCase().includes('receivable on loan') || 
      ['pledge loan', 'shg loan', 'daily savings loan', 'lad', 'staff loan'].some(n => item.head.toLowerCase().includes(n))
    );
    sheet2Data.push(['', '  1(A) INTEREST ACCRUED AND RECEIVABLE (I TO III)', '', '', '']);
    loanInterestItems.forEach((item) => {
      sheet2Data.push(['', `    - ${item.head}`, item.cy, '', '']);
    });
    const totalLoanInt = loanInterestItems.reduce((acc, item) => acc + item.cy, 0);
    const provOdInterest = coopRecords.filter(r => r.type === 'Other Assets' && r.head.toLowerCase().includes('provision for o.d')).reduce((acc, r) => acc + (r.openingBalance + r.totalDebit - r.totalCredit), 0);
    sheet2Data.push(['', '    - TOTAL', totalLoanInt, '', '']);
    sheet2Data.push(['', '    - LESS: PROVISION FOR O.D INTEREST', provOdInterest, '', '']);
    sheet2Data.push(['', '    - NET INTEREST ACCRUED & RECEIVABLE (A-B)', totalLoanInt - provOdInterest, '', '']);
    const investInterest = coopReports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('investment')).reduce((acc, item) => acc + item.cy, 0);
    sheet2Data.push(['', '  2 INTEREST ACCRUED AND RECEIVABLE ON INVESTMENT', investInterest, '', '']);
    const neftRtgs = coopReports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('neft') || item.head.toLowerCase().includes('rtgs')).reduce((acc, item) => acc + item.cy, 0);
    sheet2Data.push(['', '  NEFT/RTGS', neftRtgs, '', '']);
    sheet2Data.push(['9', 'PROFIT AND LOSS ACCOUNT', '', coopReports.cyPL_Asset, coopReports.pyPL_Asset]);
    sheet2Data.push(['', 'TOTAL', '', coopReports.cyAssetsTotal, coopReports.pyAssetsTotal]);

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'Schedule of Assets');

    // Sheet 3: Schedule of Liabilities
    const sheet3Data = [
      [coopMetadata.companyName],
      ['SCHEDULE OF LIABILITIES'],
      [`As on: ${getEndDate(coopMetadata.dateRange)}`],
      [],
      ['SL. NO', 'LIABILITIES', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)'],
      ['1', 'CAPITAL', '', '', ''],
      ['', '  i. AUTHORISED', '', authorisedShareCapital, prevAuthorisedShareCapital],
      ['', '     A) INDIVIDUALS', 1300000, 1300000],
      ['', '     B) GOVERNMENT', 500000, 500000],
      ['', '     C) OTHERS', 300000, 300000],
      ['', '  ii. SUBSCRIBED', '', '', ''],
      ['', '  iii. PAID-UP', '', coopReports.cyPaidUpShareCapital, coopReports.pyPaidUpShareCapital]
    ];
    coopReports.subitems.paidup.forEach(item => {
      sheet3Data.push(['', `     - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['2', 'RESERVES AND FUNDS', '', coopReports.cyReserves, coopReports.pyReserves]);
    coopReports.subitems.reserves.forEach((item, index) => {
      sheet3Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['3', 'GRANTS AND OTHER FUNDS', '', coopReports.cyGrants, coopReports.pyGrants]);
    coopReports.subitems.grants.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['4', 'DEPOSITS', '', coopReports.cyDeposits, coopReports.pyDeposits]);
    coopReports.subitems.deposits.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['5', 'BORROWINGS', '', coopReports.cyBorrowings, coopReports.pyBorrowings]);
    coopReports.subitems.borrowings.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['6', 'OTHER LIABILITIES', '', coopReports.cyOtherLiabilities, coopReports.pyOtherLiabilities]);
    coopReports.subitems.otherLiabilities.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['7', 'PROVISIONS', '', coopReports.cyProvisions, coopReports.pyProvisions]);
    coopReports.subitems.provisions.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['8', 'PROFIT AND LOSS ACCOUNT (UD PROFIT)', '', coopReports.cyPL_Liability, coopReports.pyPL_Liability]);
    sheet3Data.push(['', 'TOTAL', '', coopReports.cyLiabilitiesTotal, coopReports.pyLiabilitiesTotal]);

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, 'Schedule of Liabilities');

    // Sheet 4: Profit & Loss Account
    const sheet4Data = [
      [coopMetadata.companyName],
      ['PROFIT AND LOSS STATEMENT (SIDE-BY-SIDE)'],
      [`For the year: ${coopMetadata.dateRange}`],
      [],
      ['EXPENDITURE', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)', 'INCOME', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)'],
      ['INTEREST (PAID & PAYABLE) ON', '', plValues.exp.totalInterestPaid, '', 'INTEREST (RECEIVED & RECEIVABLE) ON LOANS', '', plValues.inc.loanInterestRec, ''],
      ['  I) DEPOSIT', plValues.exp.depositInt, '', '', 'INTEREST ON INVESTMENT', '', plValues.inc.investmentInterestRec, ''],
      ['  II) BORROWINGS', plValues.exp.borrowingInt, '', '', 'MISCELLANEOUS INCOME', '', plValues.inc.miscIncomeRec, ''],
      ['ESTABLISHMENT & OTHER EXPENSES', '', plValues.exp.totalEstablishment, '', '', '', '', ''],
      ['  I) SALARY & ALLOWANCES', plValues.exp.salaryExp, '', '', '', '', '', ''],
      ['  II) MANAGEMENT EXPENSES', plValues.exp.managementExp, '', '', '', '', '', ''],
      ['DEPRECIATION ON PROPERTIES', '', plValues.exp.depreciationVal, '', '', '', '', ''],
      ['GRATUITY FUND', '', plValues.exp.gratuityVal, '', '', '', '', ''],
      ['LEAVE SALARY FUND', '', plValues.exp.leaveSalaryVal, '', '', '', '', ''],
      ['STAFF WELFARE FUND', '', plValues.exp.staffWelfareVal, '', '', '', '', ''],
      ['MEMBER WELFARE FUND', '', plValues.exp.memberWelfareVal, '', '', '', '', ''],
      ['BUILDING FUND', '', plValues.exp.buildingFundVal, '', '', '', '', ''],
      ['PROVISION ON STANDARD ASSETS', '', plValues.exp.provisionStandardVal, '', '', '', '', ''],
      ['PROVISION ON NPA', '', plValues.exp.provisionNpaVal, '', '', '', '', ''],
      ['OVERDUE INTEREST ON LOANS', '', plValues.exp.overdueInterestVal, '', '', '', '', ''],
      ['AUDIT FEES PAYABLE', '', plValues.exp.auditFeesVal, '', '', '', '', ''],
      ['PROFIT FOR THE YEAR', '', plValues.exp.profit, '', 'NET LOSS FOR THE YEAR', '', plValues.inc.loss, ''],
      ['GRAND TOTAL', '', plValues.exp.grandTotal, '', 'GRAND TOTAL', '', plValues.inc.grandTotal, '']
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);
    XLSX.utils.book_append_sheet(wb, ws4, 'Profit and Loss Account');

    // Sheet 5: Schedule of P&L
    const sheet5Data = [
      [coopMetadata.companyName],
      ['SCHEDULE OF P&L DETAILS'],
      [`For the period: ${coopMetadata.dateRange}`],
      [],
      ['PARTICULARS', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)'],
      ['1. INTEREST PAID ON DEPOSITS', '', '', ''],
      ['  - CY Interest Paid', plValues.exp.depositInt, '', ''],
      ['  - Add CY Accrued Due', provOdInterest, '', ''],
      ['  - Less PY Accrued Due', 154979, '', ''],
      ['  - Profit & Loss Net Amount', '', plValues.exp.depositInt, ''],
      [],
      ['2. INTEREST PAID ON BORROWINGS', '', '', ''],
      ['  - CY Interest Paid', plValues.exp.borrowingInt, '', ''],
      ['  - Add CY Accrued Due', 22826, '', ''],
      ['  - Less PY Accrued Due', 21284, '', ''],
      ['  - Profit & Loss Net Amount', '', plValues.exp.borrowingInt, ''],
      [],
      ['3. INTEREST RECEIVED ON LOANS', '', '', ''],
      ['  - CY Interest Received', plValues.inc.loanInterestRec, '', ''],
      ['  - Add CY Accrued Receivable', totalLoanInt, '', ''],
      ['  - Less PY Accrued Receivable', 108772.09, '', ''],
      ['  - Profit & Loss Net Amount', '', plValues.inc.loanInterestRec, '']
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(sheet5Data);
    XLSX.utils.book_append_sheet(wb, ws5, 'P&L Schedule');

    // Sheet 6: NPA Summary
    const sheet6Data = [
      [coopMetadata.companyName],
      ['NPA SUMMARY AS ON ' + getEndDate(coopMetadata.dateRange)],
      [],
      ['DATE', 'LOAN CODE', 'LOAN HEAD', 'STANDARD PRINCIPAL', 'STANDARD INT', 'SUB-STANDARD PRINCIPAL', 'SUB-STANDARD INT', 'D1 PRINCIPAL', 'D1 INT', 'D2 PRINCIPAL', 'D2 INT', 'D3 PRINCIPAL', 'D3 INT', 'TOTAL PRINCIPAL', 'TOTAL INT']
    ];

    let sumStd = 0, sumStdInt = 0, sumSub = 0, sumSubInt = 0;
    let sumD1 = 0, sumD1Int = 0, sumD2 = 0, sumD2Int = 0, sumD3 = 0, sumD3Int = 0;
    let sumTotP = 0, sumTotI = 0;

    npaRows.forEach(row => {
      sheet6Data.push([
        row.date,
        row.loanCode,
        row.loanHead,
        row.standard,
        row.standardInt,
        row.substandard,
        row.substandardInt,
        row.d1,
        row.d1Int,
        row.d2,
        row.d2Int,
        row.d3,
        row.d3Int,
        row.totalPrincipal,
        row.totalInt
      ]);
      sumStd += row.standard;
      sumStdInt += row.standardInt;
      sumSub += row.substandard;
      sumSubInt += row.substandardInt;
      sumD1 += row.d1;
      sumD1Int += row.d1Int;
      sumD2 += row.d2;
      sumD2Int += row.d2Int;
      sumD3 += row.d3;
      sumD3Int += row.d3Int;
      sumTotP += row.totalPrincipal;
      sumTotI += row.totalInt;
    });

    sheet6Data.push([
      'TOTAL', '', '',
      sumStd, sumStdInt,
      sumSub, sumSubInt,
      sumD1, sumD1Int,
      sumD2, sumD2Int,
      sumD3, sumD3Int,
      sumTotP, sumTotI
    ]);

    const ws6 = XLSX.utils.aoa_to_sheet(sheet6Data);
    XLSX.utils.book_append_sheet(wb, ws6, 'NPA Summary');

    // Sheet 7: Difference Sheet
    const sheet7Data = [
      [coopMetadata.companyName],
      ['DIFFERENCE SHEET'],
      [],
      ['HEAD OF ACCOUNT', 'BALANCE SHEET AMOUNT', 'DETAIL LIST BALANCE', 'DIFFERENCE BALANCE'],
      ['DEPOSITS', coopReports.cyDeposits, coopReports.cyDeposits, 0],
      ['BORROWINGS', coopReports.cyBorrowings, coopReports.cyBorrowings, 0],
      ['LOAN & ADVANCE', coopReports.cyLoanAndAdvance, coopReports.cyLoanAndAdvance, 0],
      ['BALANCE WITH MDCCB BANK', coopReports.cyBalanceMddccb, coopReports.cyBalanceMddccb, 0],
      ['INVESTMENTS', coopReports.cyInvestment, coopReports.cyInvestment, 0],
      ['SHARE CAPITAL', coopReports.cyPaidUpShareCapital, coopReports.cyPaidUpShareCapital, 0]
    ];
    const ws7 = XLSX.utils.aoa_to_sheet(sheet7Data);
    XLSX.utils.book_append_sheet(wb, ws7, 'Difference Sheet');

    // Sheet 8: Trial Balance
    const sheet8Data = [
      [coopMetadata.companyName],
      ['TRIAL BALANCE STATEMENT'],
      [`For the period: ${coopMetadata.dateRange}`],
      [],
      ['SECTION A: ASSETS & EXPENDITURE'],
      ['GI Code', 'Account Ledger Head', 'Opening Balance', 'Debit Movement', 'Credit Movement', 'Closing Balance', 'Classification']
    ];

    const aeTypes = [
      'Balance with MDDCCB Bank',
      'Balance with Other Banks',
      'Investment',
      'Loan and Advance',
      'Closing Stock',
      'Fixed Assets',
      'Other Assets',
      'Expense',
      'Asset'
    ];
    const aeLines = coopReports.tbLines.filter(l => aeTypes.includes(l.type) || l.code === 'CASH');
    aeLines.forEach(l => {
      sheet8Data.push([l.code, l.head, l.openingBalance, l.totalDebit, l.totalCredit, l.endingBalance, l.type]);
    });

    const aeOB = aeLines.reduce((acc, l) => acc + (l.openingBalance || 0), 0);
    const aeDr = aeLines.reduce((acc, l) => acc + (l.totalDebit || 0), 0);
    const aeCr = aeLines.reduce((acc, l) => acc + (l.totalCredit || 0), 0);
    const aeEnding = aeLines.reduce((acc, l) => acc + (l.endingBalance || 0), 0);

    sheet8Data.push([
      'TOTAL (A)', 
      'ASSETS & EXPENDITURE', 
      aeOB, 
      aeDr, 
      aeCr, 
      aeEnding, 
      ''
    ]);

    sheet8Data.push([], ['SECTION B: LIABILITIES & INCOME'], ['GI Code', 'Account Ledger Head', 'Opening Balance', 'Debit Movement', 'Credit Movement', 'Closing Balance', 'Classification']);

    const liTypes = [
      'Paid Up Share Capital',
      'Reserves',
      'Grants and Other Funds',
      'Deposits',
      'Borrowings',
      'Other Liabilities',
      'Provisions',
      'Profit and Loss Account (Liability)',
      'Income'
    ];
    const liLines = coopReports.tbLines.filter(l => liTypes.includes(l.type) || l.code === 'OP_CASH');
    liLines.forEach(l => {
      sheet8Data.push([l.code, l.head, l.openingBalance, l.totalDebit, l.totalCredit, l.endingBalance, l.type]);
    });

    const liOB = liLines.reduce((acc, l) => acc + (l.openingBalance || 0), 0);
    const liDr = liLines.reduce((acc, l) => acc + (l.totalDebit || 0), 0);
    const liCr = liLines.reduce((acc, l) => acc + (l.totalCredit || 0), 0);
    const liEnding = liLines.reduce((acc, l) => acc + (l.endingBalance || 0), 0);

    sheet8Data.push([
      'TOTAL (B)', 
      'LIABILITIES & INCOME', 
      liOB, 
      liDr, 
      liCr, 
      liEnding, 
      ''
    ]);

    sheet8Data.push(
      [],
      ['TRIAL BALANCE VERIFICATION SUMMARY'],
      ['Column', 'Assets & Expenditure (A)', 'Liabilities & Income (B)', 'Difference', 'Status'],
      ['Opening Balance', aeOB, liOB, aeOB - liOB, Math.abs(aeOB - liOB) < 0.1 ? 'BALANCED' : 'MISMATCH'],
      ['Debit vs Credit Movements', aeDr, liCr, aeDr - liCr, Math.abs(aeDr - liCr) < 0.1 ? 'BALANCED' : 'MISMATCH'],
      ['Credit vs Debit Movements', aeCr, liDr, aeCr - liDr, Math.abs(aeCr - liDr) < 0.1 ? 'BALANCED' : 'MISMATCH'],
      ['Closing Balance', aeEnding, liEnding, aeEnding - liEnding, Math.abs(aeEnding - liEnding) < 0.1 ? 'BALANCED' : 'MISMATCH']
    );

    const ws8 = XLSX.utils.aoa_to_sheet(sheet8Data);
    XLSX.utils.book_append_sheet(wb, ws8, 'Trial Balance');

    XLSX.writeFile(wb, `CoOp_Financial_Statements_${coopMetadata.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  // Original Export Excel for transaction reports
  const handleExportExcel = () => {
    let exportData = [];
    if (reportType === 'Daybook') {
      exportData.push({
        'Section': 'SUMMARY',
        'Opening Balance': summary.opening,
        'Total Receipts': summary.income,
        'Total Payments': summary.expense,
        'Closing Balance': summary.closing
      });
      exportData.push({});

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

  return (
    <div className="reports-container">
      {/* Mode 2: Database-driven Co-operative Financial Statements */}
      <div className="coop-reports-wrapper">
          <div className="coop-selection-row no-print">
            <div className="form-group-premium">
              <label>Select Co-op Society / Company</label>
              <select value={selectedCompany} onChange={handleCompanyChange} disabled={loadingCoop}>
                {companies.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {periods.length > 0 && (
              <div className="form-group-premium">
                <label>Select Financial Year / Period</label>
                <select value={selectedPeriod} onChange={handlePeriodChange} disabled={loadingCoop}>
                  {periods.map((p, i) => (
                    <option key={i} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="actions-premium">
              <button 
                onClick={handleExportCoopExcel} 
                className="export-btn-premium"
                disabled={coopRecords.length === 0 || loadingCoop}
              >
                📊 Export Excel
              </button>
              <button 
                onClick={handlePrint} 
                className="print-btn-premium"
                disabled={coopRecords.length === 0 || loadingCoop}
              >
                🖨️ Print PDF
              </button>
              <button 
                onClick={handleSaveCoopEdits} 
                className="save-btn-premium no-print"
                style={{
                  marginLeft: '10px',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                disabled={coopRecords.length === 0 || loadingCoop || savingCoop}
              >
                {savingCoop ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>

          {loadingCoop && (
            <div className="loading-card">
              <div className="coop-spinner"></div>
              <p>Fetching statement data and compiling records...</p>
            </div>
          )}

          {errorCoop && <div className="error-card-premium">{errorCoop}</div>}

          {companies.length === 0 && !loadingCoop && (
            <div className="empty-state-premium">
              <h3>📂 No Financial Records Found in Database</h3>
              <p>To view Co-operative statements, first navigate to the **Cash Account PDF** section, upload a Cash Account PDF statement, configure it, and click **Save Current Ledger to DB**.</p>
            </div>
          )}

          {coopRecords.length > 0 && coopMetadata && coopReports && plValues && !loadingCoop && (
            <div className="coop-statements-display">
              {saveSuccessCoop && (
                <div className="alert alert-success no-print" style={{ backgroundColor: '#d4edda', color: '#155724', padding: '0.75rem 1.25rem', marginBottom: '1rem', borderRadius: '0.25rem', border: '1px solid #c3e6cb', textAlign: 'center', fontWeight: 'bold' }}>
                  {saveSuccessCoop}
                </div>
              )}
              {saveErrorCoop && (
                <div className="alert alert-danger no-print" style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '0.75rem 1.25rem', marginBottom: '1rem', borderRadius: '0.25rem', border: '1px solid #f5c6cb', textAlign: 'center', fontWeight: 'bold' }}>
                  {saveErrorCoop}
                </div>
              )}
              {/* Co-op Statements Tab Menu */}
              <div className="coop-sub-tabs no-print">
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'bs' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('bs')}
                >
                  Balance Sheet
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'assets_sch' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('assets_sch')}
                >
                  Sch of Assets
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'liab_sch' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('liab_sch')}
                >
                  Sch of Liabilities
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'pl_coop' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('pl_coop')}
                >
                  Profit & Loss A/c
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'pl_sch' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('pl_sch')}
                >
                  Sch of P&L
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'npa' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('npa')}
                >
                  NPA Summary
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'diff' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('diff')}
                >
                  Diff Sheet
                </button>
                <button 
                  className={`sub-tab-btn ${activeCoopTab === 'tb' ? 'active' : ''}`}
                  onClick={() => setActiveCoopTab('tb')}
                >
                  Trial Balance
                </button>
              </div>

              {/* REPORT 1: BALANCE SHEET */}
              {activeCoopTab === 'bs' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">BALANCE SHEET AS ON {getEndDate(coopMetadata.dateRange)}</h3>
                  </div>

                  {/* Balance Sheet Summary Banner */}
                  {coopReports && (
                    <div className="bs-summary-banner-container no-print" style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      fontFamily: 'inherit'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                          Balance Sheet Reconciliation Overview
                        </h4>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: (Math.abs(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal) < 0.1 && Math.abs(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal) < 0.1) ? '#d1fae5' : '#fee2e2',
                          color: (Math.abs(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal) < 0.1 && Math.abs(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal) < 0.1) ? '#065f46' : '#991b1b'
                        }}>
                          {(Math.abs(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal) < 0.1 && Math.abs(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal) < 0.1) ? '✓ Balanced' : '⚠ Out of Balance'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Previous Year Assets</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.pyAssetsTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            color: Math.abs(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal) < 0.1 ? '#10b981' : '#ef4444',
                            fontWeight: 600
                          }}>
                            Diff: {Number(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal).toFixed(2)}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Previous Year Liabilities</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.pyLiabilitiesTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            color: Math.abs(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal) < 0.1 ? '#10b981' : '#ef4444',
                            fontWeight: 600
                          }}>
                            Matches Assets: {Math.abs(coopReports.pyAssetsTotal - coopReports.pyLiabilitiesTotal) < 0.1 ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Current Year Assets</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.cyAssetsTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            color: Math.abs(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal) < 0.1 ? '#10b981' : '#ef4444',
                            fontWeight: 600
                          }}>
                            Matches Liabilities: {Math.abs(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal) < 0.1 ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Current Year Liabilities</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.cyLiabilitiesTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            color: Math.abs(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal) < 0.1 ? '#10b981' : '#ef4444',
                            fontWeight: 600
                          }}>
                            Diff: {Number(coopReports.cyAssetsTotal - coopReports.cyLiabilitiesTotal).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <table className="coop-table bs-table">
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>LIABILITIES</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>SCH NO</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Current Year</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Previous Year</th>
                        <th style={{ width: '25%' }}>ASSETS</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>SCH NO</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Current Year</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Previous Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: '600' }}>AUTHORISED SHARE CAPITAL</td>
                        <td style={{ textAlign: 'center' }}>1(i)</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                            value={authorisedShareCapital}
                            readOnly
                            className="no-print"
                          />
                          <span className="print-only">{Number(authorisedShareCapital).toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={prevAuthorisedShareCapital}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value || 0);
                              setPrevAuthorisedShareCapital(val);
                            }}
                            className="no-print"
                          />
                          <span className="print-only">{Number(prevAuthorisedShareCapital).toFixed(2)}</span>
                        </td>
                        <td style={{ fontWeight: '600' }}>CASH IN HAND</td>
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyCashInHand).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopMetadata.openingCash}
                            onChange={(e) => handlePyCategoryChange('Cash in Hand', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.openingCash).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>PAID UP SHARE CAPITAL</td>
                        <td style={{ textAlign: 'center' }}>1(iii)</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyPaidUpShareCapital).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyPaidUpShareCapital}
                            onChange={(e) => handlePyCategoryChange('Paid Up Share Capital', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyPaidUpShareCapital).toFixed(2)}</span>
                        </td>
                        <td>BALANCE WITH MDDCCB BANK</td>
                        <td style={{ textAlign: 'center' }}>2</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyBalanceMddccb).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyBalanceMddccb}
                            onChange={(e) => handlePyCategoryChange('Balance with MDDCCB Bank', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyBalanceMddccb).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>RESERVES</td>
                        <td style={{ textAlign: 'center' }}>2</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyReserves).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyReserves}
                            onChange={(e) => handlePyCategoryChange('Reserves', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyReserves).toFixed(2)}</span>
                        </td>
                        <td>BALANCE WITH OTHER BANKS</td>
                        <td style={{ textAlign: 'center' }}>3</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyBalanceOtherBanks).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyBalanceOtherBanks}
                            onChange={(e) => handlePyCategoryChange('Balance with Other Banks', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyBalanceOtherBanks).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>GRANTS AND OTHER FUNDS</td>
                        <td style={{ textAlign: 'center' }}>3</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyGrants).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyGrants}
                            onChange={(e) => handlePyCategoryChange('Grants and Other Funds', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyGrants).toFixed(2)}</span>
                        </td>
                        <td>INVESTMENT</td>
                        <td style={{ textAlign: 'center' }}>4</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyInvestment).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyInvestment}
                            onChange={(e) => handlePyCategoryChange('Investment', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyInvestment).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>DEPOSITS</td>
                        <td style={{ textAlign: 'center' }}>4</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyDeposits).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyDeposits}
                            onChange={(e) => handlePyCategoryChange('Deposits', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyDeposits).toFixed(2)}</span>
                        </td>
                        <td>LOAN AND ADVANCE</td>
                        <td style={{ textAlign: 'center' }}>5</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyLoanAndAdvance).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyLoanAndAdvance}
                            onChange={(e) => handlePyCategoryChange('Loan and Advance', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyLoanAndAdvance).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>BORROWINGS</td>
                        <td style={{ textAlign: 'center' }}>5</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyBorrowings).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyBorrowings}
                            onChange={(e) => handlePyCategoryChange('Borrowings', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyBorrowings).toFixed(2)}</span>
                        </td>
                        <td>CLOSING STOCK</td>
                        <td style={{ textAlign: 'center' }}>6</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyClosingStock).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyClosingStock}
                            onChange={(e) => handlePyCategoryChange('Closing Stock', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyClosingStock).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>OTHER LIABILITIES</td>
                        <td style={{ textAlign: 'center' }}>6</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyOtherLiabilities).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyOtherLiabilities}
                            onChange={(e) => handlePyCategoryChange('Other Liabilities', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyOtherLiabilities).toFixed(2)}</span>
                        </td>
                        <td>FIXED ASSETS</td>
                        <td style={{ textAlign: 'center' }}>7</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyFixedAssets).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyFixedAssets}
                            onChange={(e) => handlePyCategoryChange('Fixed Assets', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyFixedAssets).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>PROVISIONS</td>
                        <td style={{ textAlign: 'center' }}>7</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyProvisions).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyProvisions}
                            onChange={(e) => handlePyCategoryChange('Provisions', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyProvisions).toFixed(2)}</span>
                        </td>
                        <td>OTHER ASSETS</td>
                        <td style={{ textAlign: 'center' }}>8</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyOtherAssets).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyOtherAssets}
                            onChange={(e) => handlePyCategoryChange('Other Assets', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyOtherAssets).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>PROFIT AND LOSS ACCOUNT</td>
                        <td style={{ textAlign: 'center' }}>8</td>
                        <td style={{ textAlign: 'right', fontWeight: coopReports.cyPL_Liability !== 0 ? 'bold' : 'normal' }}>
                          {Number(coopReports.cyPL_Liability).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyPL_Liability}
                            onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Liability)', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyPL_Liability).toFixed(2)}</span>
                        </td>
                        <td>PROFIT AND LOSS ACCOUNT</td>
                        <td style={{ textAlign: 'center' }}>9</td>
                        <td style={{ textAlign: 'right', fontWeight: coopReports.cyPL_Asset !== 0 ? 'bold' : 'normal' }}>
                          {Number(coopReports.cyPL_Asset).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopReports.pyPL_Asset}
                            onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Asset)', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyPL_Asset).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr className="coop-grand-total">
                        <td>GRAND TOTAL</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyLiabilitiesTotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.pyLiabilitiesTotal).toFixed(2)}</td>
                        <td>GRAND TOTAL</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyAssetsTotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.pyAssetsTotal).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>

                  {/* Auditor Remarks Paragraph */}
                  <div className="auditor-remarks">
                    <p>
                      <strong>I report that I have audited the annexed Balance Sheet</strong> as on <strong>{getEndDate(coopMetadata.dateRange)}</strong> and the Profit & Loss Account for the year ended on <strong>{getEndDate(coopMetadata.dateRange)}</strong> and have obtained all informations and explanations, I have required. In my opinion the Balance Sheet and the Profit & Loss Account have been drawn up in conformity with law and subject to my separate report on even date, the Balance Sheet exhibit true and correct view of the state of Society's affairs according to best of my information and explanation given to me and as shown by the books of the Society. In my opinion the books of accounts have been kept as required under the provision of the Act, Rules and Bye-laws.
                    </p>
                    <div className="auditor-sig">AUDITOR OF CO-OP SOCIETIES</div>
                  </div>
                </div>
              )}

              {/* REPORT 2: SCHEDULE OF ASSETS */}
              {activeCoopTab === 'assets_sch' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">SHEDULE OF ASSETS BEING A PART OF BALANCE SHEET AS ON {getEndDate(coopMetadata.dateRange)}</h3>
                  </div>

                  <table className="coop-table schedule-table">
                    <thead>
                      <tr>
                        <th style={{ width: '8%', textAlign: 'center' }}>SL. NO</th>
                        <th style={{ width: '47%' }}>ASSETS</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>BREAK UP</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Current Year</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Previous Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Cash */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td style={{ fontWeight: 'bold' }}>CASH IN HAND</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyCashInHand).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopMetadata.openingCash}
                            onChange={(e) => handlePyCategoryChange('Cash in Hand', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.openingCash).toFixed(2)}</span>
                        </td>
                      </tr>

                      {/* MDDCCB Bank */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>2</td>
                        <td style={{ fontWeight: 'bold' }}>BALANCE WITH MDDCCB BANK</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyBalanceMddccb).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyBalanceMddccb}
                            onChange={(e) => handlePyCategoryChange('Balance with MDDCCB Bank', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyBalanceMddccb).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.mddccb.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>{idx + 1 === 1 ? 'i.' : idx + 1 === 2 ? 'ii.' : 'iii.'} &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Other Banks */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>3</td>
                        <td style={{ fontWeight: 'bold' }}>BALANCE WITH OTHER BANKS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyBalanceOtherBanks).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyBalanceOtherBanks}
                            onChange={(e) => handlePyCategoryChange('Balance with Other Banks', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyBalanceOtherBanks).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.otherBanks.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>i. &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Investment */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>4</td>
                        <td style={{ fontWeight: 'bold' }}>INVESTMENT</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyInvestment).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyInvestment}
                            onChange={(e) => handlePyCategoryChange('Investment', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyInvestment).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.investment.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>{idx + 1 === 1 ? 'i.' : 'ii.'} &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Loans & Advances */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>5</td>
                        <td style={{ fontWeight: 'bold' }}>LOAN AND ADVANCE</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyLoanAndAdvance).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyLoanAndAdvance}
                            onChange={(e) => handlePyCategoryChange('Loan and Advance', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyLoanAndAdvance).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.loans.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>{idx + 1 === 1 ? 'i.' : idx + 1 === 2 ? 'ii.' : idx + 1 === 3 ? 'iii.' : idx + 1 === 4 ? 'iv.' : idx + 1 === 5 ? 'v.' : 'vi.'} &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}
                      {/* Net computations for loans */}
                      {(() => {
                        const totalLoansCy = coopReports.subitems.loans.reduce((acc, l) => acc + l.cy, 0);
                        const npaProvisionVal = Math.round(npaRows.reduce((acc, r) => acc + (r.substandard * 0.10) + (r.d1 * 0.20) + (r.d2 * 0.30) + (r.d3 * 1.00), 0) * 100) / 100;
                        return (
                          <>
                            <tr className="computation-row">
                              <td></td>
                              <td style={{ paddingLeft: '2rem', fontStyle: 'italic' }}>(a) &nbsp; TOTAL</td>
                              <td style={{ textAlign: 'right', borderTop: '1px solid #ddd' }}>{Number(totalLoansCy).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="computation-row">
                              <td></td>
                              <td style={{ paddingLeft: '2rem', fontStyle: 'italic' }}>(b) &nbsp; LESS: PROVISION FOR NPA</td>
                              <td style={{ textAlign: 'right' }}>{Number(npaProvisionVal).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="computation-row highlight-calc">
                              <td></td>
                              <td style={{ paddingLeft: '2rem', fontWeight: '600' }}>(c) &nbsp; LOANS AND ADVANCES NET OF PROVISIONS (A-B)</td>
                              <td style={{ textAlign: 'right', fontWeight: '600', borderBottom: '1px double #888' }}>{Number(totalLoansCy - npaProvisionVal).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                          </>
                        );
                      })()}

                      {/* Closing stock */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>6</td>
                        <td style={{ fontWeight: 'bold' }}>CLOSING STOCK</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyClosingStock).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyClosingStock}
                            onChange={(e) => handlePyCategoryChange('Closing Stock', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyClosingStock).toFixed(2)}</span>
                        </td>
                      </tr>

                      {/* Fixed Assets */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>7</td>
                        <td style={{ fontWeight: 'bold' }}>FIXED ASSETS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyFixedAssets).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyFixedAssets}
                            onChange={(e) => handlePyCategoryChange('Fixed Assets', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyFixedAssets).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.fixed.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>{idx + 1 === 1 ? 'i.' : idx + 1 === 2 ? 'ii.' : idx + 1 === 3 ? 'iii.' : idx + 1 === 4 ? 'iv.' : 'v.'} &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Other assets */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>8</td>
                        <td style={{ fontWeight: 'bold' }}>OTHER ASSETS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyOtherAssets).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyOtherAssets}
                            onChange={(e) => handlePyCategoryChange('Other Assets', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyOtherAssets).toFixed(2)}</span>
                        </td>
                      </tr>
                      {(() => {
                        const loanInterestItems = coopReports.subitems.otherAssets.filter(item => 
                          item.head.toLowerCase().includes('receivable on loan') || 
                          ['pledge loan', 'shg loan', 'daily savings loan', 'lad', 'staff loan'].some(n => item.head.toLowerCase().includes(n))
                        );
                        const totalLoanInt = loanInterestItems.reduce((acc, item) => acc + item.cy, 0);
                        const provOdInterest = coopRecords.filter(r => r.type === 'Other Assets' && r.head.toLowerCase().includes('provision for o.d')).reduce((acc, r) => acc + (r.openingBalance + r.totalDebit - r.totalCredit), 0);
                        const investInterest = coopReports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('investment')).reduce((acc, item) => acc + item.cy, 0);
                        const neftRtgs = coopReports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('neft') || item.head.toLowerCase().includes('rtgs')).reduce((acc, item) => acc + item.cy, 0);

                        return (
                          <>
                            <tr className="sub-header-row">
                              <td></td>
                              <td style={{ paddingLeft: '2rem', fontWeight: '600' }}>1(A) &nbsp; INTEREST ACCRUED AND RECEIVABLE (I TO III)</td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="sub-header-row">
                              <td></td>
                              <td style={{ paddingLeft: '3rem', fontStyle: 'italic' }}>I. &nbsp; INTEREST ACCRUED BUT NOT DUE ON STANDARD LOANS:</td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                            {loanInterestItems.map((item, idx) => (
                              <tr key={idx} className="sub-item-row">
                                <td></td>
                                <td style={{ paddingLeft: '4rem' }}>- &nbsp; {item.head}</td>
                                <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                                <td></td>
                                <td></td>
                              </tr>
                            ))}
                            <tr className="computation-row">
                              <td></td>
                              <td style={{ paddingLeft: '3rem', fontStyle: 'italic' }}>1(A) &nbsp; TOTAL</td>
                              <td style={{ textAlign: 'right', borderTop: '1px solid #ddd' }}>{Number(totalLoanInt).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="computation-row">
                              <td></td>
                              <td style={{ paddingLeft: '3rem', fontStyle: 'italic' }}>1(B) &nbsp; LESS: PROVISION FOR O.D INTEREST</td>
                              <td style={{ textAlign: 'right' }}>{Number(provOdInterest).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="computation-row highlight-calc">
                              <td></td>
                              <td style={{ paddingLeft: '3rem', fontWeight: '600' }}>1(C) &nbsp; NET INTEREST ACCRUED & RECEIVABLE (A-B)</td>
                              <td style={{ textAlign: 'right', fontWeight: '600', borderBottom: '1px double #888' }}>{Number(totalLoanInt - provOdInterest).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="sub-item-row">
                              <td></td>
                              <td style={{ paddingLeft: '2rem', fontWeight: '600' }}>2 &nbsp; INTEREST ACCRUED AND RECEIVABLE ON INVESTMENT</td>
                              <td style={{ textAlign: 'right' }}>{Number(investInterest).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            <tr className="sub-item-row">
                              <td></td>
                              <td style={{ paddingLeft: '2rem', fontWeight: '600' }}>NEFT/RTGS</td>
                              <td style={{ textAlign: 'right' }}>{Number(neftRtgs).toFixed(2)}</td>
                              <td></td>
                              <td></td>
                            </tr>
                          </>
                        );
                      })()}

                      {/* Profit and Loss */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>9</td>
                        <td style={{ fontWeight: 'bold' }}>PROFIT AND LOSS ACCOUNT</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyPL_Asset).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyPL_Asset}
                            onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Asset)', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyPL_Asset).toFixed(2)}</span>
                        </td>
                      </tr>
                      {/* Grand Total */}
                      <tr className="coop-grand-total">
                        <td></td>
                        <td>TOTAL</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyAssetsTotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.pyAssetsTotal).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                  <div className="audit-sig-block">
                    <div className="auditor-sig">SIGNATURE OF AUDIT OFFICER</div>
                  </div>
                </div>
              )}

              {/* REPORT 3: SCHEDULE OF LIABILITIES */}
              {activeCoopTab === 'liab_sch' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">SHEDULE OF LIABILITIES BEING A PART OF BALANCE SHEET AS ON {getEndDate(coopMetadata.dateRange)}</h3>
                  </div>

                  <table className="coop-table schedule-table">
                    <thead>
                      <tr>
                        <th style={{ width: '8%', textAlign: 'center' }}>SL. NO</th>
                        <th style={{ width: '47%' }}>LIABILITIES</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>BREAK UP</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Current Year</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Previous Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Capital */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td style={{ fontWeight: 'bold' }}>CAPITAL</td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr className="sub-item-row">
                        <td></td>
                        <td style={{ paddingLeft: '2rem' }}>i. &nbsp; AUTHORISED</td>
                        <td style={{ textAlign: 'right' }}>{Number(authorisedShareCapital).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(authorisedShareCapital).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={prevAuthorisedShareCapital}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value || 0);
                              setPrevAuthorisedShareCapital(val);
                            }}
                            className="no-print"
                          />
                          <span className="print-only">{Number(prevAuthorisedShareCapital).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr className="sub-item-row">
                        <td></td>
                        <td style={{ paddingLeft: '3rem' }}>A) INDIVIDUALS</td>
                        <td style={{ textAlign: 'right' }}>13,00,000.00</td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr className="sub-item-row">
                        <td></td>
                        <td style={{ paddingLeft: '3rem' }}>B) GOVERNMENT</td>
                        <td style={{ textAlign: 'right' }}>5,00,000.00</td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr className="sub-item-row">
                        <td></td>
                        <td style={{ paddingLeft: '3rem' }}>C) OTHERS</td>
                        <td style={{ textAlign: 'right' }}>3,00,000.00</td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr className="sub-item-row">
                        <td></td>
                        <td style={{ paddingLeft: '2rem' }}>ii. &nbsp; SUBSCRIBED</td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr className="sub-item-row">
                        <td></td>
                        <td style={{ paddingLeft: '2rem' }}>iii. &nbsp; PAID-UP</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(coopReports.cyPaidUpShareCapital).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: '600' }}
                            value={coopReports.pyPaidUpShareCapital}
                            onChange={(e) => handlePyCategoryChange('Paid Up Share Capital', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyPaidUpShareCapital).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.paidup.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '3rem' }}>A) {item.head.toUpperCase()}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Reserves */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>2</td>
                        <td style={{ fontWeight: 'bold' }}>RESERVES AND FUNDS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyReserves).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyReserves}
                            onChange={(e) => handlePyCategoryChange('Reserves', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyReserves).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.reserves.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>{idx + 1 === 1 ? 'i.' : idx + 1 === 2 ? 'ii.' : 'iii.'} &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Grants */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>3</td>
                        <td style={{ fontWeight: 'bold' }}>GRANTS AND OTHER FUNDS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyGrants).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyGrants}
                            onChange={(e) => handlePyCategoryChange('Grants and Other Funds', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyGrants).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.grants.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>- &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Deposits */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>4</td>
                        <td style={{ fontWeight: 'bold' }}>DEPOSITS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyDeposits).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyDeposits}
                            onChange={(e) => handlePyCategoryChange('Deposits', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyDeposits).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.deposits.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>- &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Borrowings */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>5</td>
                        <td style={{ fontWeight: 'bold' }}>BORROWINGS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyBorrowings).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyBorrowings}
                            onChange={(e) => handlePyCategoryChange('Borrowings', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyBorrowings).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.borrowings.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>A) BORROWING FROM MDCCB/SCB:</td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}
                      {coopReports.subitems.borrowings.map((item, idx) => (
                        <tr key={idx + '-sub'} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '3rem' }}>- &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Other Liabilities */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>6</td>
                        <td style={{ fontWeight: 'bold' }}>OTHER LIABILITIES</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyOtherLiabilities).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyOtherLiabilities}
                            onChange={(e) => handlePyCategoryChange('Other Liabilities', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyOtherLiabilities).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.otherLiabilities.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>{idx + 1 === 1 ? 'i.' : idx + 1 === 2 ? 'ii.' : 'iii.'} &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Provisions */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>7</td>
                        <td style={{ fontWeight: 'bold' }}>PROVISIONS</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyProvisions).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyProvisions}
                            onChange={(e) => handlePyCategoryChange('Provisions', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyProvisions).toFixed(2)}</span>
                        </td>
                      </tr>
                      {coopReports.subitems.provisions.map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td></td>
                          <td style={{ paddingLeft: '2rem' }}>- &nbsp; {item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Profit & Loss Liability */}
                      <tr className="main-category-row">
                        <td style={{ textAlign: 'center' }}>8</td>
                        <td style={{ fontWeight: 'bold' }}>PROFIT AND LOSS ACCOUNT (UD PROFIT)</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopReports.cyPL_Liability).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopReports.pyPL_Liability}
                            onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Liability)', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopReports.pyPL_Liability).toFixed(2)}</span>
                        </td>
                      </tr>

                      {/* Grand Total */}
                      <tr className="coop-grand-total">
                        <td></td>
                        <td>TOTAL</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.cyLiabilitiesTotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(coopReports.pyLiabilitiesTotal).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                  <div className="audit-sig-block">
                    <div className="auditor-sig">SIGNATURE OF AUDIT OFFICER</div>
                  </div>
                </div>
              )}

              {/* REPORT 4: PROFIT AND LOSS ACCOUNT (SIDE-BY-SIDE) */}
              {activeCoopTab === 'pl_coop' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">PROFIT AND LOSS ACCOUNT FOR THE YEAR {getEndDate(coopMetadata.dateRange)}</h3>
                  </div>

                  <table className="coop-table bs-table">
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>EXPENDITURE</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>BREAK UP</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Current Year</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Previous Year</th>
                        <th style={{ width: '25%' }}>INCOME</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>BREAK UP</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Current Year</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Previous Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: '600' }}>INTEREST (PAID & PAYABLE) ON</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.totalInterestPaid).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.pyTotalInterestPaid).toFixed(2)}</td>
                        <td style={{ fontWeight: '600' }}>INTEREST (RECEIVED & RECEIVABLE) ON LOANS & ADVANCES</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.loanInterestRec).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.pyLoanIntTotal).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ paddingLeft: '2rem' }}>I) DEPOSIT</td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.depositInt).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td style={{ fontWeight: '600' }}>INTEREST ON INVESTMENT</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.investmentInterestRec).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlInvestmentInterest}
                            onChange={(e) => handlePyMetadataChange('pyPlInvestmentInterest', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlInvestmentInterest).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ paddingLeft: '2rem' }}>II) BORROWINGS</td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.borrowingInt).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td style={{ fontWeight: '600' }}>MISCELLANEOUS INCOME</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.miscIncomeRec).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlMiscIncome}
                            onChange={(e) => handlePyMetadataChange('pyPlMiscIncome', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlMiscIncome).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600' }}>ESTABLISHMENT & OTHER EXPENSES</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.totalEstablishment).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopMetadata.pyPlEstablishment}
                            onChange={(e) => handlePyMetadataChange('pyPlEstablishment', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlEstablishment).toFixed(2)}</span>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ paddingLeft: '2rem' }}>I) SALARY & ALLOWANCES</td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.salaryExp).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ paddingLeft: '2rem' }}>II) MANAGEMENT EXPENSES</td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.managementExp).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>DEPRECIATION ON PROPERTIES</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.depreciationVal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlDepreciation}
                            onChange={(e) => handlePyMetadataChange('pyPlDepreciation', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlDepreciation).toFixed(2)}</span>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>GRATUITY FUND</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.gratuityVal).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>LEAVE SALARY FUND</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.leaveSalaryVal).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>STAFF WELFARE FUND</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.staffWelfareVal).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>MEMBER WELFARE FUND</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.memberWelfareVal).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>BUILDING FUND</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.buildingFundVal).toFixed(2)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600' }}>PROVISION ON:</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ paddingLeft: '2rem' }}>STANDARD ASSETS</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.provisionStandardVal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlProvisionStandard}
                            onChange={(e) => handlePyMetadataChange('pyPlProvisionStandard', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlProvisionStandard).toFixed(2)}</span>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ paddingLeft: '2rem' }}>NPA</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.provisionNpaVal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlProvisionNpa}
                            onChange={(e) => handlePyMetadataChange('pyPlProvisionNpa', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlProvisionNpa).toFixed(2)}</span>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>OVERDUE INTEREST ON LOANS</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.overdueInterestVal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlOverdueInterest}
                            onChange={(e) => handlePyMetadataChange('pyPlOverdueInterest', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlOverdueInterest).toFixed(2)}</span>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td>AUDIT FEES PAYABLE</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.auditFeesVal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                            value={coopMetadata.pyPlAuditFees}
                            onChange={(e) => handlePyMetadataChange('pyPlAuditFees', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlAuditFees).toFixed(2)}</span>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>PROFIT FOR THE YEAR</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.profit).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopMetadata.pyPlProfit}
                            onChange={(e) => handlePyMetadataChange('pyPlProfit', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlProfit).toFixed(2)}</span>
                        </td>
                        <td style={{ fontWeight: 'bold' }}>NET LOSS FOR THE YEAR</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.loss).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input
                            type="number"
                            style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                            value={coopMetadata.pyPlLoss}
                            onChange={(e) => handlePyMetadataChange('pyPlLoss', e.target.value)}
                            className="no-print"
                          />
                          <span className="print-only">{Number(coopMetadata.pyPlLoss).toFixed(2)}</span>
                        </td>
                      </tr>
                      <tr className="coop-grand-total">
                        <td>GRAND TOTAL</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.grandTotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.exp.pyGrandTotal).toFixed(2)}</td>
                        <td>GRAND TOTAL</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.inc.grandTotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(plValues.inc.pyGrandTotal).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                  <div className="audit-sig-block">
                    <div className="auditor-sig">SIGNATURE OF AUDIT OFFICER</div>
                  </div>
                </div>
              )}

              {/* REPORT 5: SCHEDULE OF P&L DETAILS */}
              {activeCoopTab === 'pl_sch' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">SCHEDULE OF P&L A/C FOR THE PERIOD {coopMetadata.dateRange}</h3>
                  </div>

                  {/* 1. Deposit Interest Calculation */}
                  <div className="pl-sch-section">
                    <h4 className="pl-sch-header">INTEREST PAID & PAYABLE ON DEPOSIT</h4>
                    <span className="rs-amount-indicator">Rs. in Amount</span>
                    <table className="coop-table schedule-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45%' }}>PARTICULARS</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>SCHEDULE NO</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>BREAK UP</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>CY (Current Year)</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>PY (Previous Year)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="main-category-row">
                          <td style={{ fontWeight: 'bold' }}>TO, INT. PAID & DUE FOR {selectedPeriod || '2022-23'}</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>TO INT. PAID ON DEPOSITS</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }} rowspan="7">1</td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(plValues.exp.depositInt * 1.13).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchDepositInt}
                              onChange={(e) => handlePyMetadataChange('pySchDepositInt', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchDepositInt).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- INTT. ON SAVINGS SHG A/C</td>
                          <td style={{ textAlign: 'right' }}>134883.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- INTT. ON SAVINGS DEPOSIT</td>
                          <td style={{ textAlign: 'right' }}>222856.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- INTT. ON FIXED DEPOSIT</td>
                          <td style={{ textAlign: 'right' }}>55254.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- INTT. ON DAILY SAVINGS DEPOSIT</td>
                          <td style={{ textAlign: 'right' }}>78453.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- INTT. ON RECURRING DEPOSIT</td>
                          <td style={{ textAlign: 'right' }}>12233.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>ADD INT. DUE ON DEPOSITS</td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>95623.00</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchDepositDue}
                              onChange={(e) => handlePyMetadataChange('pySchDepositDue', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchDepositDue).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- FIXED DEPOSIT</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>87789.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- RECURRING DEPOSIT</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>7834.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="computation-row">
                          <td style={{ fontWeight: 'bold' }}>TOTAL, INT. PAID & DUE</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.depositInt * 1.34).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopMetadata.pySchDepositInt + coopMetadata.pySchDepositDue).toFixed(2)}</td>
                        </tr>
                        <tr className="computation-row">
                          <td>LESS LAST YEAR DUE</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>154979.00</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchDepositLastDue}
                              onChange={(e) => handlePyMetadataChange('pySchDepositLastDue', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchDepositLastDue).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="coop-grand-total yellow-header">
                          <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>PROFIT AND LOSS A/C</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.depositInt).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.pyDepositIntTotal).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 2. Borrowing Interest Calculation */}
                  <div className="pl-sch-section" style={{ marginTop: '2rem' }}>
                    <h4 className="pl-sch-header">INTEREST PAID & PAYABLE ON BORROWING</h4>
                    <table className="coop-table schedule-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45%' }}>PARTICULARS</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>SCHEDULE NO</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>BREAK UP</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>CY (Current Year)</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>PY (Previous Year)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="main-category-row">
                          <td style={{ fontWeight: 'bold' }}>TO, INT. PAID ON BORROWING WITH CCB</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>- SHG BORROWING</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }} rowspan="4">2</td>
                          <td style={{ textAlign: 'right' }}>209689.00</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>209689.00</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchBorrowingInt}
                              onChange={(e) => handlePyMetadataChange('pySchBorrowingInt', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchBorrowingInt).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>ADD INT. DUE ON BORROWINGS</td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>22826.00</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchBorrowingDue}
                              onChange={(e) => handlePyMetadataChange('pySchBorrowingDue', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchBorrowingDue).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- SHG BORROWING</td>
                          <td style={{ textAlign: 'right' }}>22826.00</td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="computation-row">
                          <td style={{ fontWeight: 'bold' }}>TOTAL, INT. PAID & DUE</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.borrowingInt + 21284).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopMetadata.pySchBorrowingInt + coopMetadata.pySchBorrowingDue).toFixed(2)}</td>
                        </tr>
                        <tr className="computation-row">
                          <td>LESS LAST YEAR DUE</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>21284.00</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchBorrowingLastDue}
                              onChange={(e) => handlePyMetadataChange('pySchBorrowingLastDue', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchBorrowingLastDue).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="coop-grand-total yellow-header">
                          <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>PROFIT AND LOSS A/C</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.borrowingInt).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.exp.pyBorrowingIntTotal).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Loans Interest Calculation */}
                  <div className="pl-sch-section" style={{ marginTop: '2rem' }}>
                    <h4 className="pl-sch-header">INTEREST RECEIVED & RECEIVABLE ON LOAN & ADVANCES</h4>
                    <table className="coop-table schedule-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45%' }}>PARTICULARS</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>SCHEDULE NO</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>BREAK UP</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>CY (Current Year)</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>PY (Previous Year)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="main-category-row">
                          <td style={{ fontWeight: 'bold' }}>BY, INT. RECEIVED & RECEIVABLE FOR {selectedPeriod || '2022-23'}</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>BY INT. RECEIVED ON LOANS</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }} rowspan="14">3</td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(plValues.inc.loanInterestRec * 0.94).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchLoanInt}
                              onChange={(e) => handlePyMetadataChange('pySchLoanInt', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchLoanInt).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- PLEDGE LOAN (GS)</td>
                          <td style={{ textAlign: 'right' }}>112789.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- SHG LOAN</td>
                          <td style={{ textAlign: 'right' }}>637354.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- DAILY SAVINGS LOAN</td>
                          <td style={{ textAlign: 'right' }}>80580.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- STAFF LOAN</td>
                          <td style={{ textAlign: 'right' }}>1837.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- LAD</td>
                          <td style={{ textAlign: 'right' }}>9578.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>ADD INT. RECEIVABLE ON LOANS</td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>157378.00</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchLoanDue}
                              onChange={(e) => handlePyMetadataChange('pySchLoanDue', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchLoanDue).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- PLEDGE LOAN (GS)</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>96942.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- SHG LOAN</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>39294.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- DAILY SAVINGS LOAN</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>16263.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- STAFF LOAN</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>78.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="sub-item-row">
                          <td style={{ paddingLeft: '3rem' }}>- LAD</td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>4801.00</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr className="computation-row">
                          <td style={{ fontWeight: 'bold' }}>TOTAL INT. RECEIVED AND RECEIVABLE THIS YEAR</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.loanInterestRec + 108772).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(coopMetadata.pySchLoanInt + coopMetadata.pySchLoanDue).toFixed(2)}</td>
                        </tr>
                        <tr className="computation-row">
                          <td>LESS LAST YEAR DUE</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>108772.09</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                              value={coopMetadata.pySchLoanLastDue}
                              onChange={(e) => handlePyMetadataChange('pySchLoanLastDue', e.target.value)}
                              className="no-print"
                            />
                            <span className="print-only">{Number(coopMetadata.pySchLoanLastDue).toFixed(2)}</span>
                          </td>
                        </tr>
                        <tr className="coop-grand-total yellow-header">
                          <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>PROFIT AND LOSS A/C</td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.loanInterestRec).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.pyLoanIntTotal).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                </div>
              )}

              {/* REPORT 6: NPA SUMMARY */}
              {activeCoopTab === 'npa' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">NPA SUMMARY AS ON {getEndDate(coopMetadata.dateRange)}</h3>
                  </div>

                  <div className="no-print" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: '600', color: '#334155' }}>Upload Detailed List Excel to Calculate NPA:</span>
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleNpaExcelUpload} 
                        style={{ display: 'none' }} 
                        id="reports-npa-excel-upload"
                      />
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => document.getElementById('reports-npa-excel-upload').click()}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        📁 Choose Excel File
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={handleClearNpaData}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        🗑️ Clear NPA Data
                      </button>
                    </div>
                    {npaError && <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '500' }}>{npaError}</div>}
                    {npaSuccess && <div style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: '500' }}>{npaSuccess}</div>}
                  </div>

                  <table className="coop-table npa-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>LOAN CODE</th>
                        <th>LOAN HEAD</th>
                        <th style={{ textAlign: 'right' }}>STANDARD</th>
                        <th style={{ textAlign: 'right' }}>INT</th>
                        <th style={{ textAlign: 'right' }}>SUB-STANDARD</th>
                        <th style={{ textAlign: 'right' }}>INT</th>
                        <th style={{ textAlign: 'right' }}>D1</th>
                        <th style={{ textAlign: 'right' }}>INT</th>
                        <th style={{ textAlign: 'right' }}>D2</th>
                        <th style={{ textAlign: 'right' }}>INT</th>
                        <th style={{ textAlign: 'right' }}>D3</th>
                        <th style={{ textAlign: 'right' }}>INT</th>
                        <th style={{ textAlign: 'right' }}>TOTAL PRINCIPAL</th>
                        <th style={{ textAlign: 'right' }}>TOTAL INT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {npaRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.date}</td>
                          <td>{row.loanCode}</td>
                          <td>{row.loanHead}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.standard).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.standardInt).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.substandard).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.substandardInt).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.d1).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.d1Int).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.d2).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.d2Int).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.d3).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(row.d3Int).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(row.totalPrincipal).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(row.totalInt).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="coop-grand-total">
                        <td colSpan="3">TOTAL</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.standard, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.standardInt, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.substandard, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.substandardInt, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.d1, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.d1Int, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.d2, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.d2Int, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.d3, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(npaRows.reduce((acc, r) => acc + r.d3Int, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(npaRows.reduce((acc, r) => acc + r.totalPrincipal, 0)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(npaRows.reduce((acc, r) => acc + r.totalInt, 0)).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF AUDIT OFFICER</div>
                    <div className="sig-item">SIGNATURE OF HIGHEST DESIGNATED OFFICER</div>
                  </div>
                </div>
              )}

              {/* REPORT 7: DIFFERENCE SHEET */}
              {activeCoopTab === 'diff' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">DIFFERENCE SHEET AS ON {getEndDate(coopMetadata.dateRange)}</h3>
                  </div>

                  <table className="coop-table schedule-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>HEAD OF ACCOUNT</th>
                        <th style={{ width: '20%', textAlign: 'right' }}>BALANCE SHEET</th>
                        <th style={{ width: '20%', textAlign: 'right' }}>DETAIL LIST BALANCE</th>
                        <th style={{ width: '20%', textAlign: 'right' }}>DIFFERENCE BALANCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="main-category-row"><td colspan="4">DEPOSIT</td></tr>
                      {coopReports.subitems.deposits
                        .filter(item => {
                          const h = (item.head || '').toUpperCase();
                          return !h.includes('SAHINUR') && !h.includes('MAMUN') && !h.includes('AFIRUL');
                        })
                        .map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>{item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.detailListBalance).toFixed(2)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: Math.abs(item.cy - item.detailListBalance) > 0.01 ? '#e74c3c' : 'inherit'
                          }}>
                            {Number(item.cy - item.detailListBalance).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      <tr className="main-category-row"><td colSpan="4">BORROWINGS</td></tr>
                      {coopReports.subitems.borrowings
                        .filter(item => {
                          const h = (item.head || '').toUpperCase();
                          return !h.includes('SAHINUR') && !h.includes('MAMUN') && !h.includes('AFIRUL');
                        })
                        .map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>{item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.detailListBalance).toFixed(2)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: Math.abs(item.cy - item.detailListBalance) > 0.01 ? '#e74c3c' : 'inherit'
                          }}>
                            {Number(item.cy - item.detailListBalance).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      <tr className="main-category-row"><td colSpan="4">LOAN & ADVANCE</td></tr>
                      {coopReports.subitems.loans
                        .filter(item => {
                          const h = (item.head || '').toUpperCase();
                          return !h.includes('SAHINUR') && !h.includes('MAMUN') && !h.includes('AFIRUL');
                        })
                        .map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>{item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.detailListBalance).toFixed(2)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: Math.abs(item.cy - item.detailListBalance) > 0.01 ? '#e74c3c' : 'inherit'
                          }}>
                            {Number(item.cy - item.detailListBalance).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      <tr className="main-category-row"><td colSpan="4">BALANCE WITH MDCCB BANK</td></tr>
                      {coopReports.subitems.mddccb
                        .filter(item => {
                          const h = (item.head || '').toUpperCase();
                          return !h.includes('SAHINUR') && !h.includes('MAMUN') && !h.includes('AFIRUL');
                        })
                        .map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>{item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.detailListBalance).toFixed(2)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: Math.abs(item.cy - item.detailListBalance) > 0.01 ? '#e74c3c' : 'inherit'
                          }}>
                            {Number(item.cy - item.detailListBalance).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      <tr className="main-category-row"><td colSpan="4">INVESTMENTS</td></tr>
                      {coopReports.subitems.investment
                        .filter(item => {
                          const h = (item.head || '').toUpperCase();
                          return !h.includes('SAHINUR') && !h.includes('MAMUN') && !h.includes('AFIRUL');
                        })
                        .map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>{item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.detailListBalance).toFixed(2)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: Math.abs(item.cy - item.detailListBalance) > 0.01 ? '#e74c3c' : 'inherit'
                          }}>
                            {Number(item.cy - item.detailListBalance).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      <tr className="main-category-row"><td colSpan="4">SHARE CAPITAL</td></tr>
                      {coopReports.subitems.paidup
                        .filter(item => {
                          const h = (item.head || '').toUpperCase();
                          return !h.includes('SAHINUR') && !h.includes('MAMUN') && !h.includes('AFIRUL');
                        })
                        .map((item, idx) => (
                        <tr key={idx} className="sub-item-row">
                          <td style={{ paddingLeft: '2rem' }}>{item.head}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.cy).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.detailListBalance).toFixed(2)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: Math.abs(item.cy - item.detailListBalance) > 0.01 ? '#e74c3c' : 'inherit'
                          }}>
                            {Number(item.cy - item.detailListBalance).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                  <div className="audit-sig-block">
                    <div className="auditor-sig">SIGNATURE OF AUDIT OFFICER</div>
                  </div>
                </div>
              )}

              {/* REPORT 8: TRIAL BALANCE */}
              {activeCoopTab === 'tb' && (
                <div className="coop-report-print">
                  <div className="statement-title-block yellow-header">
                    <h2>{coopMetadata.companyName}</h2>
                    {coopMetadata.registrationNo && <p className="reg-text">REGD. NO-{coopMetadata.registrationNo}</p>}
                    {coopMetadata.address && <p className="addr-text">{coopMetadata.address}</p>}
                    <h3 className="statement-name">
                      TRIAL BALANCE AS ON {getEndDate(coopMetadata.dateRange)}
                    </h3>
                  </div>

                  {/* Trial Balance Sub-tabs switcher */}
                  <div className="tb-sub-switcher no-print">
                    <button 
                      className={`tb-sub-btn ${tbSubTab === 'assets_exp' ? 'active' : ''}`}
                      onClick={() => setTbSubTab('assets_exp')}
                    >
                      Assets & Expenditure
                    </button>
                    <button 
                      className={`tb-sub-btn ${tbSubTab === 'liab_inc' ? 'active' : ''}`}
                      onClick={() => setTbSubTab('liab_inc')}
                    >
                      Liabilities & Income
                    </button>
                  </div>

                  {/* Trial Balance Summary Banner */}
                  {coopReports.tbSummary && (
                    <div className="tb-summary-banner-container no-print" style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      fontFamily: 'inherit'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                          Trial Balance Reconciliation Overview
                        </h4>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: coopReports.tbSummary.isBalanced ? '#d1fae5' : '#fee2e2',
                          color: coopReports.tbSummary.isBalanced ? '#065f46' : '#991b1b'
                        }}>
                          {coopReports.tbSummary.isBalanced ? '✓ Balanced' : '⚠ Out of Balance'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Opening Balance</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.tbSummary.aeOB).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Diff: 0.00</span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Debit Movements</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.tbSummary.aeDr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Matches Credit: {Math.abs(coopReports.tbSummary.aeDr - coopReports.tbSummary.liCr) < 0.1 ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Credit Movements</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.tbSummary.aeCr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Matches Debit: {Math.abs(coopReports.tbSummary.aeCr - coopReports.tbSummary.liDr) < 0.1 ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Closing Balance</span>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {Number(coopReports.tbSummary.aeEnding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                            Diff: {Number(coopReports.tbSummary.aeEnding - coopReports.tbSummary.liEnding).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {tbSubTab === 'assets_exp' ? (
                    // Section A: Assets & Expenditure
                    <div className="tb-section">
                      <h4 className="tb-section-title">ASSETS & EXPENDITURE</h4>
                      <table className="coop-table tb-detailed-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>HEAD OF ACCOUNT IN GL</th>
                            <th style={{ width: '10%', textAlign: 'center' }}>FOLIO NO</th>
                            <th style={{ width: '16%', textAlign: 'right' }}>Opening Balance</th>
                            <th style={{ width: '17%', textAlign: 'right' }}>TOTAL DEBIT</th>
                            <th style={{ width: '17%', textAlign: 'right' }}>TOTAL CREDIT</th>
                            <th style={{ width: '17%', textAlign: 'right' }}>CLOSING BALANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coopReports.tbLines.filter(l => [
                            'Balance with MDDCCB Bank',
                            'Balance with Other Banks',
                            'Investment',
                            'Loan and Advance',
                            'Closing Stock',
                            'Fixed Assets',
                            'Other Assets',
                            'Expense',
                            'Asset'
                          ].includes(l.type) || l.code === 'CASH').map((l, idx) => (
                            <tr key={idx}>
                              <td>{l.head}</td>
                              <td style={{ textAlign: 'center' }}></td>
                              <td style={{ textAlign: 'right' }}>{l.openingBalance !== 0 ? Number(l.openingBalance).toFixed(2) : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{l.totalDebit !== 0 ? Number(l.totalDebit).toFixed(2) : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{l.totalCredit !== 0 ? Number(l.totalCredit).toFixed(2) : '-'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{l.endingBalance !== 0 ? Number(l.endingBalance).toFixed(2) : '0.00'}</td>
                            </tr>
                          ))}
                          <tr className="coop-grand-total">
                            <td>TOTAL</td>
                            <td></td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                              ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + l.openingBalance, 0)).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                              ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + l.totalDebit, 0)).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                              ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + l.totalCredit, 0)).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                              ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + l.endingBalance, 0)).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Section B: Liabilities & Income
                    <div className="tb-section">
                      <h4 className="tb-section-title">LIABILITIES & INCOME</h4>
                      <table className="coop-table tb-detailed-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>HEAD OF ACCOUNT IN GL</th>
                            <th style={{ width: '10%', textAlign: 'center' }}>FOLIO NO</th>
                            <th style={{ width: '16%', textAlign: 'right' }}>Opening Balance</th>
                            <th style={{ width: '17%', textAlign: 'right' }}>TOTAL DEBIT</th>
                            <th style={{ width: '17%', textAlign: 'right' }}>TOTAL CREDIT</th>
                            <th style={{ width: '17%', textAlign: 'right' }}>CLOSING BALANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coopReports.tbLines.filter(l => [
                            'Paid Up Share Capital',
                            'Reserves',
                            'Grants and Other Funds',
                            'Deposits',
                            'Borrowings',
                            'Other Liabilities',
                            'Provisions',
                            'Profit and Loss Account (Liability)',
                            'Income'
                          ].includes(l.type) || l.code === 'OP_CASH').map((l, idx) => (
                            <tr key={idx}>
                              <td>{l.head}</td>
                              <td style={{ textAlign: 'center' }}></td>
                              <td style={{ textAlign: 'right' }}>{l.openingBalance !== 0 ? Number(l.openingBalance).toFixed(2) : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{l.totalDebit !== 0 ? Number(l.totalDebit).toFixed(2) : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{l.totalCredit !== 0 ? Number(l.totalCredit).toFixed(2) : '-'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{l.endingBalance !== 0 ? Number(l.endingBalance).toFixed(2) : '0.00'}</td>
                            </tr>
                          ))}
                          <tr className="coop-grand-total">
                            <td>TOTAL</td>
                            <td></td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                              ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + l.openingBalance, 0)).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                              ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + l.totalDebit, 0)).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                              ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + l.totalCredit, 0)).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(coopReports.tbLines.filter(l => [
                                'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                              ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + l.endingBalance, 0)).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Signatures Section */}
                  <div className="signatures-block">
                    <div className="sig-item">SIGNATURE OF CHAIRMAN</div>
                    <div className="sig-item">SIGNATURE OF SECRETARY</div>
                    <div className="sig-item">SIGNATURE OF MANAGER</div>
                  </div>
                  <div className="audit-sig-block">
                    <div className="auditor-sig">SIGNATURE OF AUDIT OFFICER</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
}

export default Reports;
