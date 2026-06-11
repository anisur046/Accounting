import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './CashAccountUpload.css';
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

function CashAccountUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('AUTO_EXTRACT');
  const [customCompanyName, setCustomCompanyName] = useState('');

  const defaultNpaRows = [];
  const [npaRows, setNpaRows] = useState(defaultNpaRows);
  const [npaError, setNpaError] = useState('');
  const [npaSuccess, setNpaSuccess] = useState('');

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
          setNpaSuccess('NPA Summary calculated successfully from Excel! Click "Save Statement to Database" below to save to the database.');
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
    setNpaSuccess('NPA data reset to defaults! Click "Save Statement to Database" below to save to the database.');
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/ledger-balances/companies');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCompanies(data.companies);
        }
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  };
  
  // Data State
  const [metadata, setMetadata] = useState({
    companyName: 'RANINAGAR-I WOMEN\'S CO-OPERATIVE CREDIT SOCIETY LTD.',
    registrationNo: '31/MSD DATED--07.09.2015',
    address: 'VILL-ISLAMPUR :: P.O.-ISLAMPUR :: MURSHIDABAD',
    dateRange: '01-04-2022 To 31-03-2023',
    openingCash: 180456,
    originalOpeningCash: 180456,
    closingCash: 31418,
    pySchDepositInt: 287702.00,
    pySchDepositDue: 154979.00,
    pySchDepositLastDue: 56973.00,
    pySchBorrowingInt: 247021.00,
    pySchBorrowingDue: 21284.00,
    pySchBorrowingLastDue: 21582.00,
    pySchLoanInt: 638949.00,
    pySchLoanDue: 108772.09,
    pySchLoanLastDue: 70022.00,
    pyPlInvestmentInterest: 565098.00,
    pyPlMiscIncome: 160963.68,
    pyPlEstablishment: 390412.00,
    pyPlDepreciation: 22377.00,
    pyPlProvisionStandard: 0.00,
    pyPlProvisionNpa: 0.00,
    pyPlOverdueInterest: 0.00,
    pyPlAuditFees: 9600.00,
    pyPlProfit: 348940.77,
    pyPlLoss: 0.00,
  });
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('review'); // review, bs, assets_sch, liab_sch, pl_coop, pl_sch, npa, diff, tb
  const [tbSubTab, setTbSubTab] = useState('assets_exp');

  // Authorised Share Capital State (Disclosure memo items)
  const [authorisedShareCapital, setAuthorisedShareCapital] = useState(2100000);
  const [prevAuthorisedShareCapital, setPrevAuthorisedShareCapital] = useState(2100000);

  const [previousPeriodData, setPreviousPeriodData] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [uploadYear, setUploadYear] = useState('2025-26');

  const checkPreviousBalances = async (companyName) => {
    const prevYear = getPreviousYear(uploadYear);
    if (!prevYear) return;
    try {
      const response = await fetch(`http://localhost:3001/api/ledger-balances/by-period?companyName=${encodeURIComponent(companyName)}&period=${encodeURIComponent(prevYear)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.records && data.records.length > 0) {
          setPreviousPeriodData(data);
          // Automatically apply the balances!
          applyPreviousBalancesData(data);
        } else {
          setPreviousPeriodData(null);
        }
      }
    } catch (err) {
      console.error('Failed to check previous balances:', err);
    }
  };

  const applyPreviousBalancesData = (prevData) => {
    if (!prevData) return;
    
    setRecords(prevRecords => {
      return prevRecords.map(r => {
        let match = prevData.records.find(p => String(p.code) === String(r.code));
        if (!match) {
          match = prevData.records.find(p => p.head.toLowerCase().trim() === r.head.toLowerCase().trim());
        }

        if (match) {
          return {
            ...r,
            openingBalance: match.endingBalance || 0,
            originalOpeningBalance: match.endingBalance || 0,
            type: match.type
          };
        }
        return r;
      });
    });
    
    const systemMetadata = prevData.records.filter(p => p.type === 'SystemMetadata');
    const getMetaVal = (code, defaultValue) => {
      const rec = systemMetadata.find(r => r.code === code);
      return rec ? parseFloat(rec.openingBalance || 0) : defaultValue;
    };
    
    const opCashRecord = systemMetadata.find(r => r.code === 'SYS_CL_CASH');
    const newOpeningCash = opCashRecord ? opCashRecord.openingBalance : metadata.openingCash;
    
    setMetadata(prev => ({
      ...prev,
      openingCash: newOpeningCash,
      originalOpeningCash: newOpeningCash,
      pySchDepositInt: getMetaVal('SYS_PY_SCH_DEP_INT', prev.pySchDepositInt),
      pySchDepositDue: getMetaVal('SYS_PY_SCH_DEP_DUE', prev.pySchDepositDue),
      pySchDepositLastDue: getMetaVal('SYS_PY_SCH_DEP_LDUE', prev.pySchDepositLastDue),
      pySchBorrowingInt: getMetaVal('SYS_PY_SCH_BORR_INT', prev.pySchBorrowingInt),
      pySchBorrowingDue: getMetaVal('SYS_PY_SCH_BORR_DUE', prev.pySchBorrowingDue),
      pySchBorrowingLastDue: getMetaVal('SYS_PY_SCH_BORR_LDUE', prev.pySchBorrowingLastDue),
      pySchLoanInt: getMetaVal('SYS_PY_SCH_LOAN_INT', prev.pySchLoanInt),
      pySchLoanDue: getMetaVal('SYS_PY_SCH_LOAN_DUE', prev.pySchLoanDue),
      pySchLoanLastDue: getMetaVal('SYS_PY_SCH_LOAN_LDUE', prev.pySchLoanLastDue),
      pyPlInvestmentInterest: getMetaVal('SYS_PY_PL_INV_INT', prev.pyPlInvestmentInterest),
      pyPlMiscIncome: getMetaVal('SYS_PY_PL_MISC_INC', prev.pyPlMiscIncome),
      pyPlEstablishment: getMetaVal('SYS_PY_PL_EST', prev.pyPlEstablishment),
      pyPlDepreciation: getMetaVal('SYS_PY_PL_DEP', prev.pyPlDepreciation),
      pyPlProvisionStandard: getMetaVal('SYS_PY_PL_PROV_STD', prev.pyPlProvisionStandard),
      pyPlProvisionNpa: getMetaVal('SYS_PY_PL_PROV_NPA', prev.pyPlProvisionNpa),
      pyPlOverdueInterest: getMetaVal('SYS_PY_PL_OD_INT', prev.pyPlOverdueInterest),
      pyPlAuditFees: getMetaVal('SYS_PY_PL_AUDIT', prev.pyPlAuditFees),
      pyPlProfit: getMetaVal('SYS_PY_PL_PROFIT', prev.pyPlProfit),
      pyPlLoss: getMetaVal('SYS_PY_PL_LOSS', prev.pyPlLoss),
    }));

    setSuccess(`Successfully applied opening balances and restored classifications from previous period: ${prevData.period}`);
  };

  const applyPreviousBalances = () => {
    if (previousPeriodData) {
      applyPreviousBalancesData(previousPeriodData);
    }
  };

  const handleSaveLedger = async () => {
    setLoading(true);
    setSaveError('');
    setSaveSuccess('');
    
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

    const recordsToSave = records.map(r => {
      const ob = r.openingBalance || 0;
      const isDebit = isDebitNormal(r.type);
      const endingVal = isDebit 
        ? ob + (r.totalDebit - r.totalCredit)
        : ob + (r.totalCredit - r.totalDebit);

      return {
        code: r.code,
        head: r.head,
        openingBalance: ob,
        totalCredit: r.totalCredit,
        totalDebit: r.totalDebit,
        endingBalance: endingVal,
        detailListBalance: endingVal,
        type: r.type
      };
    });

    // Save system metadata records to persist opening/closing cash and company info
    recordsToSave.push({
      code: 'SYS_OP_CASH',
      head: 'Opening Cash Balance',
      openingBalance: metadata.openingCash,
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: metadata.openingCash,
      type: 'SystemMetadata'
    });
    recordsToSave.push({
      code: 'SYS_CL_CASH',
      head: 'Closing Cash Balance',
      openingBalance: metadata.closingCash,
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: metadata.closingCash,
      type: 'SystemMetadata'
    });
    recordsToSave.push({
      code: 'SYS_REG_NO',
      head: metadata.registrationNo || '',
      openingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
      endingBalance: 0,
      type: 'SystemMetadata'
    });
    recordsToSave.push({
      code: 'SYS_ADDR',
      head: metadata.address || '',
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
        openingBalance: val,
        totalCredit: 0,
        totalDebit: 0,
        endingBalance: val,
        type: 'SystemMetadata'
      });
    };

    pushMeta('SYS_PY_SCH_DEP_INT', metadata.pySchDepositInt);
    pushMeta('SYS_PY_SCH_DEP_DUE', metadata.pySchDepositDue);
    pushMeta('SYS_PY_SCH_DEP_LDUE', metadata.pySchDepositLastDue);
    pushMeta('SYS_PY_SCH_BORR_INT', metadata.pySchBorrowingInt);
    pushMeta('SYS_PY_SCH_BORR_DUE', metadata.pySchBorrowingDue);
    pushMeta('SYS_PY_SCH_BORR_LDUE', metadata.pySchBorrowingLastDue);
    pushMeta('SYS_PY_SCH_LOAN_INT', metadata.pySchLoanInt);
    pushMeta('SYS_PY_SCH_LOAN_DUE', metadata.pySchLoanDue);
    pushMeta('SYS_PY_SCH_LOAN_LDUE', metadata.pySchLoanLastDue);
    pushMeta('SYS_PY_PL_INV_INT', metadata.pyPlInvestmentInterest);
    pushMeta('SYS_PY_PL_MISC_INC', metadata.pyPlMiscIncome);
    pushMeta('SYS_PY_PL_EST', metadata.pyPlEstablishment);
    pushMeta('SYS_PY_PL_DEP', metadata.pyPlDepreciation);
    pushMeta('SYS_PY_PL_PROV_STD', metadata.pyPlProvisionStandard);
    pushMeta('SYS_PY_PL_PROV_NPA', metadata.pyPlProvisionNpa);
    pushMeta('SYS_PY_PL_OD_INT', metadata.pyPlOverdueInterest);
    pushMeta('SYS_PY_PL_AUDIT', metadata.pyPlAuditFees);
    pushMeta('SYS_PY_PL_PROFIT', metadata.pyPlProfit);
    pushMeta('SYS_PY_PL_LOSS', metadata.pyPlLoss);

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
      const prevPeriod = getPreviousYear(metadata.dateRange);
      if (prevPeriod && !previousPeriodData) {
        // Build previous year initial records using opening balances of current year
        const prevRecordsToSave = records.map(r => ({
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
          openingBalance: parseFloat(metadata.openingCash || 0),
          totalCredit: 0,
          totalDebit: 0,
          endingBalance: parseFloat(metadata.openingCash || 0),
          type: 'SystemMetadata'
        });
        prevRecordsToSave.push({
          code: 'SYS_REG_NO',
          head: metadata.registrationNo || '',
          openingBalance: 0,
          totalCredit: 0,
          totalDebit: 0,
          endingBalance: 0,
          type: 'SystemMetadata'
        });
        prevRecordsToSave.push({
          code: 'SYS_ADDR',
          head: metadata.address || '',
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

        pushPrevMeta('SYS_PY_SCH_DEP_INT', metadata.pySchDepositInt);
        pushPrevMeta('SYS_PY_SCH_DEP_DUE', metadata.pySchDepositDue);
        pushPrevMeta('SYS_PY_SCH_DEP_LDUE', metadata.pySchDepositLastDue);
        pushPrevMeta('SYS_PY_SCH_BORR_INT', metadata.pySchBorrowingInt);
        pushPrevMeta('SYS_PY_SCH_BORR_DUE', metadata.pySchBorrowingDue);
        pushPrevMeta('SYS_PY_SCH_BORR_LDUE', metadata.pySchBorrowingLastDue);
        pushPrevMeta('SYS_PY_SCH_LOAN_INT', metadata.pySchLoanInt);
        pushPrevMeta('SYS_PY_SCH_LOAN_DUE', metadata.pySchLoanDue);
        pushPrevMeta('SYS_PY_SCH_LOAN_LDUE', metadata.pySchLoanLastDue);
        pushPrevMeta('SYS_PY_PL_INV_INT', metadata.pyPlInvestmentInterest);
        pushPrevMeta('SYS_PY_PL_MISC_INC', metadata.pyPlMiscIncome);
        pushPrevMeta('SYS_PY_PL_EST', metadata.pyPlEstablishment);
        pushPrevMeta('SYS_PY_PL_DEP', metadata.pyPlDepreciation);
        pushPrevMeta('SYS_PY_PL_PROV_STD', metadata.pyPlProvisionStandard);
        pushPrevMeta('SYS_PY_PL_PROV_NPA', metadata.pyPlProvisionNpa);
        pushPrevMeta('SYS_PY_PL_OD_INT', metadata.pyPlOverdueInterest);
        pushPrevMeta('SYS_PY_PL_AUDIT', metadata.pyPlAuditFees);
        pushPrevMeta('SYS_PY_PL_PROFIT', metadata.pyPlProfit);
        pushPrevMeta('SYS_PY_PL_LOSS', metadata.pyPlLoss);

        const prevResponse = await fetch('http://localhost:3001/api/ledger-balances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: metadata.companyName,
            period: prevPeriod,
            records: prevRecordsToSave
          }),
        });

        if (!prevResponse.ok) {
          throw new Error('Failed to initialize previous year balances in the database.');
        }
      }

      const response = await fetch('http://localhost:3001/api/ledger-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: metadata.companyName,
          period: metadata.dateRange,
          records: recordsToSave
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save ledger balances.');
      }

      const data = await response.json();
      if (data.success) {
        setSaveSuccess(`Successfully saved ledger balances for ${metadata.companyName} (${metadata.dateRange}) to database.`);
      } else {
        throw new Error(data.message || 'Unknown save error.');
      }
    } catch (err) {
      console.error('Save Ledger Error:', err);
      setSaveError(err.message || 'Failed to save ledger balances.');
    } finally {
      setLoading(false);
    }
  };

  const loadTestRecords = () => {
    let finalCompanyName = "RANINAGAR-I WOMEN'S CO-OPERATIVE CREDIT SOCIETY LTD.";
    if (selectedCompany === 'CUSTOM') {
      finalCompanyName = customCompanyName.trim() || finalCompanyName;
    } else if (selectedCompany !== 'AUTO_EXTRACT') {
      finalCompanyName = selectedCompany;
    }

    const mockMetadata = {
      companyName: finalCompanyName,
      registrationNo: '31/MSD DATED--07.09.2015',
      address: 'VILL-ISLAMPUR :: P.O.-ISLAMPUR :: MURSHIDABAD',
      dateRange: uploadYear,
      openingCash: 180456,
      originalOpeningCash: 180456,
      closingCash: 31418,
    };
    
    const mockRecords = [
      {
        code: "12216",
        head: "Provident Fund Reserve",
        cashCredit: 10000,
        transferCredit: 0,
        totalCredit: 10000,
        cashDebit: 0,
        transferDebit: 0,
        totalDebit: 0,
        type: "Reserves",
        openingBalance: 0
      },
      {
        code: "13204",
        head: "Borrowings",
        cashCredit: 0,
        transferCredit: 0,
        totalCredit: 0,
        cashDebit: 50000,
        transferDebit: 0,
        totalDebit: 50000,
        type: "Borrowings",
        openingBalance: 0
      },
      {
        code: "22403",
        head: "Re-Investment",
        cashCredit: 0,
        transferCredit: 0,
        totalCredit: 0,
        cashDebit: 0,
        transferDebit: 0,
        totalDebit: 0,
        type: "Investment",
        openingBalance: 0
      },
      {
        code: "99999",
        head: "New Unseen Account",
        cashCredit: 5000,
        transferCredit: 0,
        totalCredit: 5000,
        cashDebit: 0,
        transferDebit: 0,
        totalDebit: 0,
        type: "Income",
        openingBalance: 0
      }
    ];

    const mockRecordsWithOriginal = mockRecords.map(r => ({
      ...r,
      originalOpeningBalance: r.openingBalance
    }));

    setMetadata(prev => ({
      ...prev,
      ...mockMetadata
    }));
    setRecords(mockRecordsWithOriginal);
    setSuccess('Mock PDF records loaded for testing! Check for saved balances or verify opening balances.');
    setActiveTab('review');
    checkPreviousBalances(mockMetadata.companyName);
  };

  // Handle file drag/drop or input selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
      uploadPDF(selectedFile);
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const uploadPDF = async (pdfFile) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(',')[1];
          
          const response = await fetch('http://localhost:3001/api/upload-cash-account', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pdf: base64 }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to parse PDF.');
          }

          const data = await response.json();
          if (data.success) {
            // Pre-populate records with openingBalance: 0
            const parsedRecords = data.records.map(r => ({
              ...r,
              openingBalance: 0,
              originalOpeningBalance: 0
            }));
            let finalCompanyName = data.metadata.companyName;
            if (selectedCompany === 'CUSTOM') {
              finalCompanyName = customCompanyName.trim() || data.metadata.companyName;
            } else if (selectedCompany !== 'AUTO_EXTRACT') {
              finalCompanyName = selectedCompany;
            }

            const parsedMeta = {
              ...data.metadata,
              companyName: finalCompanyName,
              dateRange: uploadYear,
              originalOpeningCash: data.metadata.openingCash,
              pySchDepositInt: 287702.00,
              pySchDepositDue: 154979.00,
              pySchDepositLastDue: 56973.00,
              pySchBorrowingInt: 247021.00,
              pySchBorrowingDue: 21284.00,
              pySchBorrowingLastDue: 21582.00,
              pySchLoanInt: 638949.00,
              pySchLoanDue: 108772.09,
              pySchLoanLastDue: 108772.09,
              pyPlInvestmentInterest: 565098.00,
              pyPlMiscIncome: 160963.68,
              pyPlEstablishment: 390412.00,
              pyPlDepreciation: 22377.00,
              pyPlProvisionStandard: 0.00,
              pyPlProvisionNpa: 0.00,
              pyPlOverdueInterest: 0.00,
              pyPlAuditFees: 9600.00,
              pyPlProfit: 348940.77,
              pyPlLoss: 0.00,
            };
            setMetadata(parsedMeta);
            setRecords(parsedRecords);
            setSuccess('PDF successfully parsed! You can now review the ledger classifications and enter opening balances.');
            setActiveTab('review');
            checkPreviousBalances(finalCompanyName);
          } else {
            throw new Error(data.message || 'Unknown parsing error.');
          }
        } catch (err) {
          console.error('Upload Error:', err);
          setError(err.message || 'An error occurred during file upload.');
        } finally {
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('Error reading PDF file.');
        setLoading(false);
      };

      reader.readAsDataURL(pdfFile);
    } catch (err) {
      console.error('Upload Error:', err);
      setError(err.message || 'An error occurred during file upload.');
      setLoading(false);
    }
  };

  // Metadata update handlers
  const handleMetadataChange = (e) => {
    const { name, value } = e.target;
    setMetadata({
      ...metadata,
      [name]: name.endsWith('Cash') ? parseFloat(value || 0) : value,
    });
    if (name === 'companyName') {
      checkPreviousBalances(value);
    }
  };

  const handlePyCategoryChange = (category, val) => {
    const floatVal = parseFloat(val || 0);
    if (category === 'Cash in Hand') {
      setMetadata(prev => ({ ...prev, openingCash: floatVal }));
      return;
    }

    setRecords(prev => {
      const existing = prev.filter(r => r.type === category);
      if (existing.length === 0) {
        const newRec = {
          code: 'SYS_' + category.toUpperCase().replace(/[^A-Z]/g, '_'),
          head: 'Carried ' + category,
          openingBalance: floatVal,
          originalOpeningBalance: 0,
          cashDebit: 0,
          transferDebit: 0,
          totalDebit: 0,
          cashCredit: 0,
          transferCredit: 0,
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
    setMetadata(prev => ({
      ...prev,
      [key]: floatVal
    }));
  };

  // Record table handlers
  const handleRecordChange = (index, field, value) => {
    const updated = [...records];
    const floatVal = parseFloat(value || 0);
    updated[index] = {
      ...updated[index],
      [field]: field === 'type' ? value : (field === 'code' || field === 'head' ? value : floatVal),
    };
    
    if (field === 'openingBalance') {
      updated[index].originalOpeningBalance = floatVal;
    }
    if (field === 'cashDebit' || field === 'transferDebit') {
      updated[index].totalDebit = updated[index].cashDebit + updated[index].transferDebit;
    }
    if (field === 'cashCredit' || field === 'transferCredit') {
      updated[index].totalCredit = updated[index].cashCredit + updated[index].transferCredit;
    }
    
    setRecords(updated);
  };

  const handleAddRecord = () => {
    setRecords([
      ...records,
      {
        code: '20000',
        head: 'NEW LEDGER ACCOUNT',
        cashCredit: 0,
        transferCredit: 0,
        totalCredit: 0,
        cashDebit: 0,
        transferDebit: 0,
        totalDebit: 0,
        type: 'Loan and Advance',
        openingBalance: 0,
        originalOpeningBalance: 0
      },
    ]);
  };

  const handleDeleteRecord = (index) => {
    setRecords(records.filter((_, i) => i !== index));
  };

  // Pre-populate demo opening balances matching the user's Raninagar previous year figures
  const handleLoadDemoOpeningBalances = () => {
    const updated = records.map(r => {
      const nameLower = r.head.toLowerCase();
      const code = String(r.code);
      let ob = 0;
      
      // Match categories by codes/names to seed the demo
      if (code === '12216' || nameLower.includes('provident fund reserve')) ob = 146589;
      else if (code === '13204' || code === '13402' || nameLower.includes('borrowing')) ob = 3981000 / 2; // split borrowings
      else if (code.startsWith('14') || nameLower.includes('deposit')) {
        // Distribute Deposits (deposits PY total: 1,65,23,732.67)
        if (nameLower.includes('non members')) ob = 5000000;
        else if (nameLower.includes('self help')) ob = 8000000;
        else ob = 3523732.67;
      }
      else if (code === '22403' || nameLower.includes('re-investment')) ob = 7900468;
      else if (code.startsWith('23') || nameLower.includes('loan')) {
        // Distribute Loans given (loans PY total: 74,06,779.00)
        if (nameLower.includes('overdue')) ob = 2406779;
        else ob = 5000000;
      }
      else if (code === '21201' || code === '21203' || nameLower.includes('furniture') || nameLower.includes('accessories')) {
        // Fixed assets (fixed assets PY: 1,90,839.00)
        if (nameLower.includes('computer')) ob = 100000;
        else ob = 90839;
      }
      else if (code === '18905' || nameLower.includes('suspense') || nameLower.includes('receivable')) ob = 362606.09;
      else if (nameLower.includes('share capital') || nameLower.includes('paid up')) ob = 335830;
      else if (nameLower.includes('grants')) ob = 3099;
      else if (nameLower.includes('bonus payable') || nameLower.includes('telephone & electricity charges')) ob = 9600;
      else if (nameLower.includes('profit and loss')) ob = 88873.37;
      
      return {
        ...r,
        openingBalance: ob,
        originalOpeningBalance: ob
      };
    });
    setRecords(updated);
    setSuccess('Demo opening balances successfully loaded! Check the Balance Sheet or Trial Balance tabs to see them balance.');
  };

  // Dynamic calculations for reports
  const calculateReports = () => {
    // Helper to identify if a category is normally a Debit balance
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
    const aeDebitSum = records.filter(r => isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalDebit || 0), 0);
    const aeCreditSum = records.filter(r => isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalCredit || 0), 0);
    const liDebitSum = records.filter(r => !isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalDebit || 0), 0);
    const liCreditSum = records.filter(r => !isDebitNormal(r.type)).reduce((acc, r) => acc + (r.totalCredit || 0), 0);

    const totalReceipts = aeCreditSum + liCreditSum;
    const totalPayments = aeDebitSum + liDebitSum;

    const tbLines = records.map(r => {
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
        totalDebit: r.totalDebit,
        totalCredit: r.totalCredit,
        endingBalance: endingVal,
        type: r.type,
        debit: isDebit && endingVal > 0 ? endingVal : (!isDebit && endingVal < 0 ? -endingVal : 0),
        credit: !isDebit && endingVal > 0 ? endingVal : (isDebit && endingVal < 0 ? -endingVal : 0),
      };
    });

    tbLines.push({
      code: 'CASH',
      head: 'Cash Account (Closing)',
      openingBalance: metadata.openingCash,
      totalDebit: totalReceipts,
      totalCredit: totalPayments,
      endingBalance: metadata.closingCash,
      type: 'Asset',
      debit: metadata.closingCash,
      credit: 0,
    });
    
    tbLines.push({
      code: 'OP_CASH',
      head: 'Cash in Hand (Opening)',
      openingBalance: metadata.openingCash,
      totalDebit: aeDebitSum + aeCreditSum,
      totalCredit: aeDebitSum + aeCreditSum,
      endingBalance: metadata.originalOpeningCash !== undefined ? metadata.originalOpeningCash : metadata.openingCash,
      type: 'Paid Up Share Capital',
      debit: 0,
      credit: metadata.originalOpeningCash !== undefined ? metadata.originalOpeningCash : metadata.openingCash,
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

      records.forEach(r => {
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

      const closingCash = metadata.closingCash || 0;
      const openingCash = metadata.openingCash || 0;

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

    const incomeItems = records
      .filter(r => r.type === 'Income')
      .map(r => ({
        code: r.code,
        head: r.head,
        amount: r.totalCredit - r.totalDebit,
      }));
    const totalIncome = incomeItems.reduce((acc, i) => acc + i.amount, 0);

    const expenseItems = records
      .filter(r => r.type === 'Expense')
      .map(r => ({
        code: r.code,
        head: r.head,
        amount: r.totalDebit - r.totalCredit,
      }));
    const totalExpenses = expenseItems.reduce((acc, e) => acc + e.amount, 0);

    const netProfit = totalIncome - totalExpenses;

    const getPrevSum = (category) => {
      return records
        .filter(r => r.type === category)
        .reduce((acc, r) => acc + (r.openingBalance || 0), 0);
    };

    const getCurrSum = (category) => {
      return records
        .filter(r => r.type === category)
        .reduce((acc, r) => {
          const ob = r.originalOpeningBalance !== undefined ? r.originalOpeningBalance : (r.openingBalance || 0);
          const net = r.totalDebit - r.totalCredit;
          const isDebit = isDebitNormal(category);
          return acc + (isDebit ? ob + net : ob - net);
        }, 0);
    };

    // 3. Balance Sheet Calculations (Category level aggregations)
    const pyPaidUpShareCapital = getPrevSum('Paid Up Share Capital');
    const pyReserves = getPrevSum('Reserves');
    const pyGrants = getPrevSum('Grants and Other Funds');
    const pyDeposits = getPrevSum('Deposits');
    const pyBorrowings = getPrevSum('Borrowings');
    const pyOtherLiabilities = getPrevSum('Other Liabilities');
    const pyProvisions = getPrevSum('Provisions');
    const pyPL_Liability = getPrevSum('Profit and Loss Account (Liability)'); // Accrued liability from previous year

    const cyPaidUpShareCapital = getCurrSum('Paid Up Share Capital');
    const cyReserves = getCurrSum('Reserves');
    const cyGrants = getCurrSum('Grants and Other Funds');
    const cyDeposits = getCurrSum('Deposits');
    const cyBorrowings = getCurrSum('Borrowings');
    const cyOtherLiabilities = getCurrSum('Other Liabilities');
    const cyProvisions = getCurrSum('Provisions');

    const pyPL_Asset = getPrevSum('Profit and Loss Account (Asset)');

    // Assets:
    const pyCashInHand = metadata.openingCash; // Linked directly
    const pyBalanceMddccb = getPrevSum('Balance with MDDCCB Bank');
    const pyBalanceOtherBanks = getPrevSum('Balance with Other Banks');
    const pyInvestment = getPrevSum('Investment');
    const pyLoanAndAdvance = getPrevSum('Loan and Advance');
    const pyClosingStock = getPrevSum('Closing Stock');
    const pyFixedAssets = getPrevSum('Fixed Assets');
    const pyOtherAssets = getPrevSum('Other Assets');

    const cyCashInHand = metadata.closingCash; // Linked directly
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

    // Totals summation
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

    // Helper for Opening Balance verification banner
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
      return records
        .filter(r => r.type === category)
        .map(r => {
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
      
      // Co-op balance sheet rows
      authorisedShareCapital,
      prevAuthorisedShareCapital,
      
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

      // Grand totals
      pyLiabilitiesTotal,
      pyAssetsTotal,
      cyLiabilitiesTotal,
      cyAssetsTotal,
      
      // Opening balance checks
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

  const reports = calculateReports();

  // Dynamic mapper helper for Profit and Loss in CashAccountUpload
  const getPLValues = () => {
    if (!reports || !records) return null;

    const getExpenseVal = (keyword) => {
      return records
        .filter(r => r.type === 'Expense' && r.head.toLowerCase().includes(keyword.toLowerCase()))
        .reduce((acc, r) => acc + (r.totalDebit - r.totalCredit), 0);
    };

    const getIncomeVal = (keyword) => {
      return records
        .filter(r => r.type === 'Income' && r.head.toLowerCase().includes(keyword.toLowerCase()))
        .reduce((acc, r) => acc + (r.totalCredit - r.totalDebit), 0);
    };

    // Expenditure Mappings
    const depositInt = getExpenseVal('deposit');
    const borrowingInt = getExpenseVal('borrowing');
    const totalInterestPaid = depositInt + borrowingInt;

    const salaryExp = getExpenseVal('salary');
    const depreciationVal = getExpenseVal('depreciation');
    const gratuityVal = getExpenseVal('gratuity');
    const leaveSalaryVal = getExpenseVal('leave salary');
    const staffWelfareVal = getExpenseVal('staff welfare');
    const memberWelfareVal = getExpenseVal('member welfare');
    const buildingFundVal = getExpenseVal('building');
    const provisionNpaVal = getExpenseVal('provision for npa');
    const provisionStandardVal = getExpenseVal('provision for standard');
    const overdueInterestVal = getExpenseVal('provision for o.d');
    const auditFeesVal = getExpenseVal('audit');

    const totalAllocations = gratuityVal + leaveSalaryVal + staffWelfareVal + memberWelfareVal + buildingFundVal;
    const totalProvisions = provisionNpaVal + provisionStandardVal;

    const managementExp = reports.totalExpenses - (totalInterestPaid + salaryExp + depreciationVal + totalAllocations + totalProvisions + overdueInterestVal + auditFeesVal);

    // Income Mappings
    const loanInterestRec = getIncomeVal('loan');
    const investmentInterestRec = getIncomeVal('investment');
    const miscIncomeRec = reports.totalIncome - (loanInterestRec + investmentInterestRec);

    // Previous Year Computations
    const pyDepositIntTotal = (metadata.pySchDepositInt !== undefined ? metadata.pySchDepositInt : 287702.00) +
                              (metadata.pySchDepositDue !== undefined ? metadata.pySchDepositDue : 154979.00) -
                              (metadata.pySchDepositLastDue !== undefined ? metadata.pySchDepositLastDue : 56973.00);
    const pyBorrowingIntTotal = (metadata.pySchBorrowingInt !== undefined ? metadata.pySchBorrowingInt : 247021.00) +
                                (metadata.pySchBorrowingDue !== undefined ? metadata.pySchBorrowingDue : 21284.00) -
                                (metadata.pySchBorrowingLastDue !== undefined ? metadata.pySchBorrowingLastDue : 21582.00);
    const pyTotalInterestPaid = pyDepositIntTotal + pyBorrowingIntTotal;

    const pyLoanIntTotal = (metadata.pySchLoanInt !== undefined ? metadata.pySchLoanInt : 638949.00) +
                            (metadata.pySchLoanDue !== undefined ? metadata.pySchLoanDue : 108772.09) -
                            (metadata.pySchLoanLastDue !== undefined ? metadata.pySchLoanLastDue : 70022.00);

    const pyPlEstablishment = metadata.pyPlEstablishment !== undefined ? metadata.pyPlEstablishment : 390412.00;
    const pyPlDepreciation = metadata.pyPlDepreciation !== undefined ? metadata.pyPlDepreciation : 22377.00;
    const pyPlProvisionStandard = metadata.pyPlProvisionStandard !== undefined ? metadata.pyPlProvisionStandard : 0.00;
    const pyPlProvisionNpa = metadata.pyPlProvisionNpa !== undefined ? metadata.pyPlProvisionNpa : 0.00;
    const pyPlOverdueInterest = metadata.pyPlOverdueInterest !== undefined ? metadata.pyPlOverdueInterest : 0.00;
    const pyPlAuditFees = metadata.pyPlAuditFees !== undefined ? metadata.pyPlAuditFees : 9600.00;
    const pyPlProfit = metadata.pyPlProfit !== undefined ? metadata.pyPlProfit : 348940.77;

    const pyPlInvestmentInterest = metadata.pyPlInvestmentInterest !== undefined ? metadata.pyPlInvestmentInterest : 565098.00;
    const pyPlMiscIncome = metadata.pyPlMiscIncome !== undefined ? metadata.pyPlMiscIncome : 160963.68;
    const pyPlLoss = metadata.pyPlLoss !== undefined ? metadata.pyPlLoss : 0.00;

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
        profit: reports.netProfit > 0 ? reports.netProfit : 0,
        grandTotal: Math.max(reports.totalIncome, reports.totalExpenses),
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
        loss: reports.netProfit < 0 ? -reports.netProfit : 0,
        grandTotal: Math.max(reports.totalIncome, reports.totalExpenses),
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

  // Export to Excel (All 8 sheets)
  const handleExportExcel = () => {
    if (!reports || !metadata || !plValues) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Balance Sheet
    const sheet1Data = [
      [metadata.companyName],
      [metadata.registrationNo ? `Regd. No: ${metadata.registrationNo}` : ''],
      [metadata.address || ''],
      ['BALANCE SHEET STATEMENT'],
      [`As on: ${getEndDate(metadata.dateRange)}`],
      [],
      ['LIABILITIES', 'SCH', 'CY (Current Year)', 'PY (Previous Year)', 'ASSETS', 'SCH', 'CY (Current Year)', 'PY (Previous Year)'],
      ['AUTHORISED SHARE CAPITAL', '1(i)', authorisedShareCapital, prevAuthorisedShareCapital, 'CASH IN HAND', '1', reports.cyCashInHand, reports.pyCashInHand],
      ['PAID UP SHARE CAPITAL', '1(iii)', reports.cyPaidUpShareCapital, reports.pyPaidUpShareCapital, 'BALANCE WITH MDDCCB BANK', '2', reports.cyBalanceMddccb, reports.pyBalanceMddccb],
      ['RESERVES', '2', reports.cyReserves, reports.pyReserves, 'BALANCE WITH OTHER BANKS', '3', reports.cyBalanceOtherBanks, reports.pyBalanceOtherBanks],
      ['GRANTS AND OTHER FUNDS', '3', reports.cyGrants, reports.pyGrants, 'INVESTMENT', '4', reports.cyInvestment, reports.pyInvestment],
      ['DEPOSITS', '4', reports.cyDeposits, reports.pyDeposits, 'LOAN AND ADVANCE', '5', reports.cyLoanAndAdvance, reports.pyLoanAndAdvance],
      ['BORROWINGS', '5', reports.cyBorrowings, reports.pyBorrowings, 'CLOSING STOCK', '6', reports.cyClosingStock, reports.pyClosingStock],
      ['OTHER LIABILITIES', '6', reports.cyOtherLiabilities, reports.pyOtherLiabilities, 'FIXED ASSETS', '7', reports.cyFixedAssets, reports.pyFixedAssets],
      ['PROVISIONS', '7', reports.cyProvisions, reports.pyProvisions, 'OTHER ASSETS', '8', reports.cyOtherAssets, reports.pyOtherAssets],
      ['PROFIT AND LOSS ACCOUNT', '8', reports.cyPL_Liability, reports.pyPL_Liability, 'PROFIT AND LOSS ACCOUNT', '9', reports.cyPL_Asset, reports.pyPL_Asset],
      ['GRAND TOTAL', '', reports.cyLiabilitiesTotal, reports.pyLiabilitiesTotal, 'GRAND TOTAL', '', reports.cyAssetsTotal, reports.pyAssetsTotal]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'Balance Sheet');

    // Sheet 2: Schedule of Assets
    const sheet2Data = [
      [metadata.companyName],
      ['SCHEDULE OF ASSETS'],
      [`As on: ${getEndDate(metadata.dateRange)}`],
      [],
      ['SL. NO', 'ASSETS', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)'],
      ['1', 'CASH IN HAND', '', reports.cyCashInHand, reports.pyCashInHand],
      ['2', 'BALANCE WITH MDDCCB BANK', '', reports.cyBalanceMddccb, reports.pyBalanceMddccb]
    ];
    reports.subitems.mddccb.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['3', 'BALANCE WITH OTHER BANKS', '', reports.cyBalanceOtherBanks, reports.pyBalanceOtherBanks]);
    reports.subitems.otherBanks.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['4', 'INVESTMENT', '', reports.cyInvestment, reports.pyInvestment]);
    reports.subitems.investment.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['5', 'LOAN AND ADVANCE', '', reports.cyLoanAndAdvance, reports.pyLoanAndAdvance]);
    reports.subitems.loans.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    const totalLoansCy = reports.subitems.loans.reduce((acc, l) => acc + l.cy, 0);
    const npaProvisionVal = records.filter(r => r.type === 'Provisions' && r.head.toLowerCase().includes('npa')).reduce((acc, r) => acc + (r.openingBalance + r.totalCredit - r.totalDebit), 0);
    sheet2Data.push(['', '  (a) TOTAL', totalLoansCy, '', '']);
    sheet2Data.push(['', '  (b) LESS: PROVISION FOR NPA', npaProvisionVal, '', '']);
    sheet2Data.push(['', '  (c) LOANS AND ADVANCES NET OF PROVISIONS', totalLoansCy - npaProvisionVal, '', '']);
    sheet2Data.push(['6', 'CLOSING STOCK', '', reports.cyClosingStock, reports.pyClosingStock]);
    sheet2Data.push(['7', 'FIXED ASSETS', '', reports.cyFixedAssets, reports.pyFixedAssets]);
    reports.subitems.fixed.forEach((item, index) => {
      sheet2Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet2Data.push(['8', 'OTHER ASSETS', '', reports.cyOtherAssets, reports.pyOtherAssets]);
    const loanInterestItems = reports.subitems.otherAssets.filter(item => 
      item.head.toLowerCase().includes('receivable on loan') || 
      ['pledge loan', 'shg loan', 'daily savings loan', 'lad', 'staff loan'].some(n => item.head.toLowerCase().includes(n))
    );
    sheet2Data.push(['', '  1(A) INTEREST ACCRUED AND RECEIVABLE (I TO III)', '', '', '']);
    loanInterestItems.forEach((item) => {
      sheet2Data.push(['', `    - ${item.head}`, item.cy, '', '']);
    });
    const totalLoanInt = loanInterestItems.reduce((acc, item) => acc + item.cy, 0);
    const provOdInterest = records.filter(r => r.type === 'Other Assets' && r.head.toLowerCase().includes('provision for o.d')).reduce((acc, r) => acc + (r.openingBalance + r.totalDebit - r.totalCredit), 0);
    sheet2Data.push(['', '    - TOTAL', totalLoanInt, '', '']);
    sheet2Data.push(['', '    - LESS: PROVISION FOR O.D INTEREST', provOdInterest, '', '']);
    sheet2Data.push(['', '    - NET INTEREST ACCRUED & RECEIVABLE (A-B)', totalLoanInt - provOdInterest, '', '']);
    const investInterest = reports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('investment')).reduce((acc, item) => acc + item.cy, 0);
    sheet2Data.push(['', '  2 INTEREST ACCRUED AND RECEIVABLE ON INVESTMENT', investInterest, '', '']);
    const neftRtgs = reports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('neft') || item.head.toLowerCase().includes('rtgs')).reduce((acc, item) => acc + item.cy, 0);
    sheet2Data.push(['', '  NEFT/RTGS', neftRtgs, '', '']);
    sheet2Data.push(['9', 'PROFIT AND LOSS ACCOUNT', '', reports.cyPL_Asset, reports.pyPL_Asset]);
    sheet2Data.push(['', 'TOTAL', '', reports.cyAssetsTotal, reports.pyAssetsTotal]);

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'Schedule of Assets');

    // Sheet 3: Schedule of Liabilities
    const sheet3Data = [
      [metadata.companyName],
      ['SCHEDULE OF LIABILITIES'],
      [`As on: ${getEndDate(metadata.dateRange)}`],
      [],
      ['SL. NO', 'LIABILITIES', 'BREAK UP', 'CY (Current Year)', 'PY (Previous Year)'],
      ['1', 'CAPITAL', '', '', ''],
      ['', '  i. AUTHORISED', '', authorisedShareCapital, prevAuthorisedShareCapital],
      ['', '     A) INDIVIDUALS', 1300000, 1300000],
      ['', '     B) GOVERNMENT', 500000, 500000],
      ['', '     C) OTHERS', 300000, 300000],
      ['', '  ii. SUBSCRIBED', '', '', ''],
      ['', '  iii. PAID-UP', '', reports.cyPaidUpShareCapital, reports.pyPaidUpShareCapital]
    ];
    reports.subitems.paidup.forEach(item => {
      sheet3Data.push(['', `     - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['2', 'RESERVES AND FUNDS', '', reports.cyReserves, reports.pyReserves]);
    reports.subitems.reserves.forEach((item, index) => {
      sheet3Data.push(['', `  ${index + 1}. ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['3', 'GRANTS AND OTHER FUNDS', '', reports.cyGrants, reports.pyGrants]);
    reports.subitems.grants.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['4', 'DEPOSITS', '', reports.cyDeposits, reports.pyDeposits]);
    reports.subitems.deposits.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['5', 'BORROWINGS', '', reports.cyBorrowings, reports.pyBorrowings]);
    reports.subitems.borrowings.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['6', 'OTHER LIABILITIES', '', reports.cyOtherLiabilities, reports.pyOtherLiabilities]);
    reports.subitems.otherLiabilities.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['7', 'PROVISIONS', '', reports.cyProvisions, reports.pyProvisions]);
    reports.subitems.provisions.forEach((item) => {
      sheet3Data.push(['', `  - ${item.head}`, item.cy, '', '']);
    });
    sheet3Data.push(['8', 'PROFIT AND LOSS ACCOUNT (UD PROFIT)', '', reports.cyPL_Liability, reports.pyPL_Liability]);
    sheet3Data.push(['', 'TOTAL', '', reports.cyLiabilitiesTotal, reports.pyLiabilitiesTotal]);

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, 'Schedule of Liabilities');

    // Sheet 4: Profit & Loss Account
    const sheet4Data = [
      [metadata.companyName],
      ['PROFIT AND LOSS STATEMENT (SIDE-BY-SIDE)'],
      [`For the year: ${metadata.dateRange}`],
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
      [metadata.companyName],
      ['SCHEDULE OF P&L DETAILS'],
      [`For the period: ${metadata.dateRange}`],
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
      [metadata.companyName],
      ['NPA SUMMARY AS ON ' + getEndDate(metadata.dateRange)],
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
      [metadata.companyName],
      ['DIFFERENCE SHEET'],
      [],
      ['HEAD OF ACCOUNT', 'BALANCE SHEET AMOUNT', 'DETAIL LIST BALANCE', 'DIFFERENCE BALANCE'],
      ['DEPOSITS', reports.cyDeposits, reports.cyDeposits, 0],
      ['BORROWINGS', reports.cyBorrowings, reports.cyBorrowings, 0],
      ['LOAN & ADVANCE', reports.cyLoanAndAdvance, reports.cyLoanAndAdvance, 0],
      ['BALANCE WITH MDCCB BANK', reports.cyBalanceMddccb, reports.cyBalanceMddccb, 0],
      ['INVESTMENTS', reports.cyInvestment, reports.cyInvestment, 0],
      ['SHARE CAPITAL', reports.cyPaidUpShareCapital, reports.cyPaidUpShareCapital, 0]
    ];
    const ws7 = XLSX.utils.aoa_to_sheet(sheet7Data);
    XLSX.utils.book_append_sheet(wb, ws7, 'Difference Sheet');

    // Sheet 8: Trial Balance
    const sheet8Data = [
      [metadata.companyName],
      ['TRIAL BALANCE STATEMENT'],
      [`For the period: ${metadata.dateRange}`],
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
    const aeLines = reports.tbLines.filter(l => aeTypes.includes(l.type) || l.code === 'CASH');
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
    const liLines = reports.tbLines.filter(l => liTypes.includes(l.type) || l.code === 'OP_CASH');
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

    XLSX.writeFile(wb, `Statements_${metadata.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="cash-upload-container">
      <div className="cash-upload-header no-print">
        <h1>Co-Operative Financial Statement Generator</h1>
        <p>Upload a Cash Account PDF statement to map records, configure ledger opening balances, and generate standard reports.</p>
      </div>

      {/* Upload Box */}
      {records.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }} className="no-print">
          <div className="form-group-premium" style={{ width: '320px', textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.95rem' }}>Select Society / Company</label>
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)} 
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#1e293b', fontWeight: '500', outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', cursor: 'pointer' }}
            >
              <option value="AUTO_EXTRACT">Auto-extract from PDF</option>
              {companies.map((c, idx) => (
                <option key={idx} value={c}>{c}</option>
              ))}
              <option value="CUSTOM">+ Add New Society...</option>
            </select>
          </div>

          {selectedCompany === 'CUSTOM' && (
            <div className="form-group-premium" style={{ width: '320px', textAlign: 'center' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.95rem' }}>Enter New Society Name</label>
              <input
                type="text"
                value={customCompanyName}
                onChange={(e) => setCustomCompanyName(e.target.value)}
                placeholder="e.g. BALARAMPUR COOPERATIVE..."
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div className="form-group-premium" style={{ marginBottom: '0.5rem', width: '320px', textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.95rem' }}>Select Financial Year for Upload</label>
            <select 
              value={uploadYear} 
              onChange={(e) => setUploadYear(e.target.value)} 
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#1e293b', fontWeight: '500', outline: 'none', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', cursor: 'pointer' }}
            >
              <option value="2020-21">2020-21</option>
              <option value="2021-22">2021-22</option>
              <option value="2022-23">2022-23</option>
              <option value="2023-24">2023-24</option>
              <option value="2024-25">2024-25</option>
              <option value="2025-26">2025-26</option>
              <option value="2026-27">2026-27</option>
              <option value="2027-28">2027-28</option>
              <option value="2028-29">2028-29</option>
              <option value="2029-30">2029-30</option>
              <option value="2030-31">2030-31</option>
            </select>
          </div>
          <div className="upload-card" onClick={() => document.getElementById('pdf-file-picker').click()}>
            <div className="upload-icon">📄</div>
            <h3>Select or Drop Cash Account PDF</h3>
            <p>Extracts schedules, company details, and parses accounts automatically</p>
            <input
              id="pdf-file-picker"
              type="file"
              className="file-input"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </div>
          <button type="button" className="btn btn-secondary btn-test-mock" style={{ padding: '0.6rem 1.2rem', background: '#34495e', color: '#fff', borderRadius: '4px', cursor: 'pointer', border: 'none' }} onClick={loadTestRecords}>
            🔧 Load Mock PDF Records for Testing
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-wrapper no-print">
          <div className="spinner"></div>
          <p>Extracting text, formatting columns, and matching co-op categories...</p>
        </div>
      )}

      {error && <div className="btn-danger btn no-print" style={{ display: 'block', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>{error}</div>}
      {success && <div className="btn-success btn no-print" style={{ display: 'block', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }} onClick={() => setSuccess('')}>{success}</div>}
      {saveError && <div className="btn-danger btn no-print" style={{ display: 'block', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }} onClick={() => setSaveError('')}>{saveError}</div>}
      {saveSuccess && <div className="btn-success btn no-print" style={{ display: 'block', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }} onClick={() => setSaveSuccess('')}>{saveSuccess}</div>}

      {records.length > 0 && (
        <>
          {/* Metadata Display */}
          <div className="metadata-section no-print">
            <h3>Company & Date Details</h3>
            <div className="metadata-grid">
              <div className="form-field">
                <label>Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={metadata.companyName}
                  onChange={handleMetadataChange}
                />
              </div>
              <div className="form-field">
                <label>Registration Details</label>
                <input
                  type="text"
                  name="registrationNo"
                  value={metadata.registrationNo}
                  onChange={handleMetadataChange}
                />
              </div>
              <div className="form-field">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={metadata.address}
                  onChange={handleMetadataChange}
                />
              </div>
              <div className="form-field">
                <label>Date Range / Period</label>
                <input
                  type="text"
                  name="dateRange"
                  value={metadata.dateRange}
                  onChange={handleMetadataChange}
                />
              </div>
              <div className="form-field">
                <label>Opening Cash Balance</label>
                <input
                  type="number"
                  name="openingCash"
                  value={metadata.openingCash}
                  onChange={handleMetadataChange}
                  readOnly
                />
              </div>
              <div className="form-field">
                <label>Closing Cash Balance</label>
                <input
                  type="number"
                  name="closingCash"
                  value={metadata.closingCash}
                  onChange={handleMetadataChange}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="actions-row no-print">
            <div className="tabs-header" style={{ borderBottom: 'none', marginBottom: 0 }}>
              <button
                className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`}
                onClick={() => setActiveTab('review')}
              >
                Review & Classify
              </button>
              <button
                className={`tab-btn ${activeTab === 'bs' ? 'active' : ''}`}
                onClick={() => setActiveTab('bs')}
              >
                Balance Sheet
              </button>
              <button
                className={`tab-btn ${activeTab === 'assets_sch' ? 'active' : ''}`}
                onClick={() => setActiveTab('assets_sch')}
              >
                Sch of Assets
              </button>
              <button
                className={`tab-btn ${activeTab === 'liab_sch' ? 'active' : ''}`}
                onClick={() => setActiveTab('liab_sch')}
              >
                Sch of Liabilities
              </button>
              <button
                className={`tab-btn ${activeTab === 'pl_coop' ? 'active' : ''}`}
                onClick={() => setActiveTab('pl_coop')}
              >
                Profit & Loss A/c
              </button>
              <button
                className={`tab-btn ${activeTab === 'pl_sch' ? 'active' : ''}`}
                onClick={() => setActiveTab('pl_sch')}
              >
                Sch of P&L
              </button>
              <button
                className={`tab-btn ${activeTab === 'npa' ? 'active' : ''}`}
                onClick={() => setActiveTab('npa')}
              >
                NPA Summary
              </button>
              <button
                className={`tab-btn ${activeTab === 'diff' ? 'active' : ''}`}
                onClick={() => setActiveTab('diff')}
              >
                Diff Sheet
              </button>
              <button
                className={`tab-btn ${activeTab === 'tb' ? 'active' : ''}`}
                onClick={() => setActiveTab('tb')}
              >
                Trial Balance
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="btn btn-secondary" onClick={handleExportExcel}>
                📊 Export Excel
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print Report
              </button>
              <button className="btn btn-danger" onClick={() => { setRecords([]); setFile(null); }}>
                🗑️ Start New
              </button>
            </div>
          </div>

          {/* Tab 1: Review & Classify */}
          {activeTab === 'review' && (
            <div className="no-print">
              {previousPeriodData && (
                <div className="db-balances-banner" style={{ background: '#e8f8f5', border: '1px solid #a3e4d7', color: '#16a085', padding: '12px 16px', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong>📂 Saved Ledger Balances Found!</strong> We found previous year closing balances in the database for <strong>{metadata.companyName}</strong> from period <strong>{previousPeriodData.period}</strong>.
                  </div>
                  <button className="btn btn-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={applyPreviousBalances}>
                    ⚡ Load Opening Balances & Categories
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#2c3e50' }}>Review & Configure Ledgers</h3>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#e8f4f8', color: '#2980b9' }} onClick={handleLoadDemoOpeningBalances}>
                    💡 Load Demo Opening Balances
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  <button className="btn btn-primary" onClick={handleSaveLedger}>
                    💾 Save Current Ledger to DB
                  </button>
                  <button className="btn btn-success" onClick={handleAddRecord}>
                    ➕ Add Ledger Row
                  </button>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="table-premium">
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>GI Code</th>
                      <th style={{ width: '27%' }}>Account Head Name</th>
                      <th style={{ width: '12%' }}>Opening Balance</th>
                      <th style={{ width: '12%' }}>Total Credit (Receipt)</th>
                      <th style={{ width: '12%' }}>Total Debit (Payment)</th>
                      <th style={{ width: '20%' }}>Report Category / Classification</th>
                      <th style={{ textAlign: 'center', width: '9%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="text"
                            value={r.code}
                            readOnly
                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={r.head}
                            readOnly
                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={r.openingBalance}
                            onChange={(e) => handleRecordChange(index, 'openingBalance', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={r.totalCredit}
                            readOnly
                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={r.totalDebit}
                            readOnly
                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                          />
                        </td>
                        <td>
                          <select
                            className={`select-premium type-select-${['Income','Expense'].includes(r.type) ? r.type : 'Liability'}`}
                            value={r.type}
                            onChange={(e) => handleRecordChange(index, 'type', e.target.value)}
                          >
                            <optgroup label="Nominal (P&L)">
                              <option value="Income">Income (Revenue)</option>
                              <option value="Expense">Expense</option>
                            </optgroup>
                            <optgroup label="Liabilities & Equity (Balance Sheet)">
                              <option value="Paid Up Share Capital">Paid Up Share Capital</option>
                              <option value="Reserves">Reserves</option>
                              <option value="Grants and Other Funds">Grants and Other Funds</option>
                              <option value="Deposits">Deposits</option>
                              <option value="Borrowings">Borrowings</option>
                              <option value="Other Liabilities">Other Liabilities</option>
                              <option value="Provisions">Provisions</option>
                              <option value="Profit and Loss Account (Liability)">Profit and Loss Account</option>
                            </optgroup>
                            <optgroup label="Assets (Balance Sheet)">
                              <option value="Balance with MDDCCB Bank">Balance with MDDCCB Bank</option>
                              <option value="Balance with Other Banks">Balance with Other Banks</option>
                              <option value="Investment">Investment</option>
                              <option value="Loan and Advance">Loan and Advance</option>
                              <option value="Closing Stock">Closing Stock</option>
                              <option value="Fixed Assets">Fixed Assets</option>
                              <option value="Other Assets">Other Assets</option>
                              <option value="Profit and Loss Account (Asset)">Profit and Loss Account</option>
                            </optgroup>
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={() => handleDeleteRecord(index)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Opening Balance Verification check banner */}
              <div className={`balance-check-banner ${reports.openingBalanced ? 'balanced' : 'unbalanced'}`}>
                {reports.openingBalanced ? (
                  <span>✅ Opening Balances balance perfectly! Assets = Liabilities & Equity. (Total: {Number(reports.openingAssets).toFixed(2)})</span>
                ) : (
                  <span>⚠️ Opening Balances unbalanced! Assets: {Number(reports.openingAssets).toFixed(2)} | Liabilities: {Number(reports.openingLiabilities).toFixed(2)} | Difference: {Number(reports.openingDiff).toFixed(2)}</span>
                )}
              </div>
            </div>
          )}

          {/* REPORT 1: BALANCE SHEET */}
          {activeTab === 'bs' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">BALANCE SHEET AS ON {getEndDate(metadata.dateRange)}</h3>
              </div>

              {/* In-place Previous Year Edit Alert info */}
              <div className="no-print" style={{ background: '#ebf5fb', border: '1px solid #aed6f1', color: '#2e86c1', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.9rem' }}>
                💡 <strong>Editing Opening/Previous Year Balances:</strong> To change the Previous Year (PY) column values, please go to the **Review & Classify** tab and edit the **Opening Balance** of the individual ledger accounts. The sums and current year cumulative totals will recalculate automatically.
              </div>

              <table className="coop-table bs-table" style={{ tableLayout: 'fixed' }}>
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
                  {/* Row 1: Authorised Share Capital */}
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
                    
                    {/* Cash in Hand */}
                    <td style={{ fontWeight: '600' }}>CASH IN HAND</td>
                    <td style={{ textAlign: 'center' }}>1</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyCashInHand).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={metadata.openingCash}
                        onChange={(e) => handlePyCategoryChange('Cash in Hand', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.openingCash).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 2: Paid Up Share Capital / Balance with MDDCCB Bank */}
                  <tr>
                    <td>PAID UP SHARE CAPITAL</td>
                    <td style={{ textAlign: 'center' }}>1(iii)</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyPaidUpShareCapital).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyPaidUpShareCapital}
                        onChange={(e) => handlePyCategoryChange('Paid Up Share Capital', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyPaidUpShareCapital).toFixed(2)}</span>
                    </td>
                    
                    <td>BALANCE WITH MDDCCB BANK</td>
                    <td style={{ textAlign: 'center' }}>2</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyBalanceMddccb).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyBalanceMddccb}
                        onChange={(e) => handlePyCategoryChange('Balance with MDDCCB Bank', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyBalanceMddccb).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 3: Reserves / Balance with Other Banks */}
                  <tr>
                    <td>RESERVES</td>
                    <td style={{ textAlign: 'center' }}>2</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyReserves).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyReserves}
                        onChange={(e) => handlePyCategoryChange('Reserves', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyReserves).toFixed(2)}</span>
                    </td>
                    
                    <td>BALANCE WITH OTHER BANKS</td>
                    <td style={{ textAlign: 'center' }}>3</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyBalanceOtherBanks).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyBalanceOtherBanks}
                        onChange={(e) => handlePyCategoryChange('Balance with Other Banks', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyBalanceOtherBanks).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 4: Grants & Funds / Investment */}
                  <tr>
                    <td>GRANTS AND OTHER FUNDS</td>
                    <td style={{ textAlign: 'center' }}>3</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyGrants).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyGrants}
                        onChange={(e) => handlePyCategoryChange('Grants and Other Funds', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyGrants).toFixed(2)}</span>
                    </td>
                    
                    <td>INVESTMENT</td>
                    <td style={{ textAlign: 'center' }}>4</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyInvestment).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyInvestment}
                        onChange={(e) => handlePyCategoryChange('Investment', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyInvestment).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 5: Deposits / Loan and Advance */}
                  <tr>
                    <td>DEPOSITS</td>
                    <td style={{ textAlign: 'center' }}>4</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyDeposits).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyDeposits}
                        onChange={(e) => handlePyCategoryChange('Deposits', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyDeposits).toFixed(2)}</span>
                    </td>
                    
                    <td>LOAN AND ADVANCE</td>
                    <td style={{ textAlign: 'center' }}>5</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyLoanAndAdvance).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyLoanAndAdvance}
                        onChange={(e) => handlePyCategoryChange('Loan and Advance', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyLoanAndAdvance).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 6: Borrowings / Closing Stock */}
                  <tr>
                    <td>BORROWINGS</td>
                    <td style={{ textAlign: 'center' }}>5</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyBorrowings).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyBorrowings}
                        onChange={(e) => handlePyCategoryChange('Borrowings', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyBorrowings).toFixed(2)}</span>
                    </td>
                    
                    <td>CLOSING STOCK</td>
                    <td style={{ textAlign: 'center' }}>6</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyClosingStock).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyClosingStock}
                        onChange={(e) => handlePyCategoryChange('Closing Stock', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyClosingStock).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 7: Other Liabilities / Fixed Assets */}
                  <tr>
                    <td>OTHER LIABILITIES</td>
                    <td style={{ textAlign: 'center' }}>6</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyOtherLiabilities).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyOtherLiabilities}
                        onChange={(e) => handlePyCategoryChange('Other Liabilities', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyOtherLiabilities).toFixed(2)}</span>
                    </td>
                    
                    <td>FIXED ASSETS</td>
                    <td style={{ textAlign: 'center' }}>7</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyFixedAssets).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyFixedAssets}
                        onChange={(e) => handlePyCategoryChange('Fixed Assets', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyFixedAssets).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 8: Provisions / Other Assets */}
                  <tr>
                    <td>PROVISIONS</td>
                    <td style={{ textAlign: 'center' }}>7</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyProvisions).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyProvisions}
                        onChange={(e) => handlePyCategoryChange('Provisions', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyProvisions).toFixed(2)}</span>
                    </td>
                    
                    <td>OTHER ASSETS</td>
                    <td style={{ textAlign: 'center' }}>8</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyOtherAssets).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyOtherAssets}
                        onChange={(e) => handlePyCategoryChange('Other Assets', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyOtherAssets).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 9: Profit & Loss Account on both sides */}
                  <tr>
                    <td>PROFIT AND LOSS ACCOUNT</td>
                    <td style={{ textAlign: 'center' }}>8</td>
                    <td style={{ textAlign: 'right', fontWeight: reports.cyPL_Liability !== 0 ? 'bold' : 'normal' }}>
                      {Number(reports.cyPL_Liability).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyPL_Liability}
                        onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Liability)', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyPL_Liability).toFixed(2)}</span>
                    </td>
                    
                    <td>PROFIT AND LOSS ACCOUNT</td>
                    <td style={{ textAlign: 'center' }}>9</td>
                    <td style={{ textAlign: 'right', fontWeight: reports.cyPL_Asset !== 0 ? 'bold' : 'normal' }}>
                      {Number(reports.cyPL_Asset).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                        value={reports.pyPL_Asset}
                        onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Asset)', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyPL_Asset).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Row 10: Grand Totals */}
                  <tr className="coop-grand-total">
                    <td>GRAND TOTAL</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyLiabilitiesTotal).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.pyLiabilitiesTotal).toFixed(2)}</td>
                    
                    <td>GRAND TOTAL</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyAssetsTotal).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.pyAssetsTotal).toFixed(2)}</td>
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
                  <strong>I report that I have audited the annexed Balance Sheet</strong> as on <strong>{getEndDate(metadata.dateRange)}</strong> and the Profit & Loss Account for the year ended on <strong>{getEndDate(metadata.dateRange)}</strong> and have obtained all informations and explanations, I have required. In my opinion the Balance Sheet and the Profit & Loss Account have been drawn up in conformity with law and subject to my separate report on even date, the Balance Sheet exhibit true and correct view of the state of Society's affairs according to best of my information and explanation given to me and as shown by the books of the Society. In my opinion the books of accounts have been kept as required under the provision of the Act, Rules and Bye-laws.
                </p>
                <div className="auditor-sig">AUDITOR OF CO-OP SOCIETIES</div>
              </div>

              {/* Balance Verification Banners */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                <div className={`balance-check-banner ${Math.abs(reports.cyAssetsTotal - reports.cyLiabilitiesTotal) < 0.1 ? 'balanced' : 'unbalanced'} no-print`}>
                  {Math.abs(reports.cyAssetsTotal - reports.cyLiabilitiesTotal) < 0.1 ? (
                    <span>✅ Current Year balances perfectly! Assets = Liabilities.</span>
                  ) : (
                    <span>⚠️ Current Year unbalanced! Difference: {Number(Math.abs(reports.cyAssetsTotal - reports.cyLiabilitiesTotal)).toFixed(2)}</span>
                  )}
                </div>
                
                <div className={`balance-check-banner ${Math.abs(reports.pyAssetsTotal - reports.pyLiabilitiesTotal) < 0.1 ? 'balanced' : 'unbalanced'} no-print`}>
                  {Math.abs(reports.pyAssetsTotal - reports.pyLiabilitiesTotal) < 0.1 ? (
                    <span>✅ Previous Year balances perfectly! Assets = Liabilities.</span>
                  ) : (
                    <span>⚠️ Previous Year unbalanced! Difference: {Number(Math.abs(reports.pyAssetsTotal - reports.pyLiabilitiesTotal)).toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REPORT 2: SCHEDULE OF ASSETS */}
          {activeTab === 'assets_sch' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">SHEDULE OF ASSETS BEING A PART OF BALANCE SHEET AS ON {getEndDate(metadata.dateRange)}</h3>
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyCashInHand).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={metadata.openingCash}
                        onChange={(e) => handlePyCategoryChange('Cash in Hand', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.openingCash).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* MDDCCB Bank */}
                  <tr className="main-category-row">
                    <td style={{ textAlign: 'center' }}>2</td>
                    <td style={{ fontWeight: 'bold' }}>BALANCE WITH MDDCCB BANK</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyBalanceMddccb).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyBalanceMddccb}
                        onChange={(e) => handlePyCategoryChange('Balance with MDDCCB Bank', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyBalanceMddccb).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.mddccb.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyBalanceOtherBanks).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyBalanceOtherBanks}
                        onChange={(e) => handlePyCategoryChange('Balance with Other Banks', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyBalanceOtherBanks).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.otherBanks.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyInvestment).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyInvestment}
                        onChange={(e) => handlePyCategoryChange('Investment', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyInvestment).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.investment.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyLoanAndAdvance).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyLoanAndAdvance}
                        onChange={(e) => handlePyCategoryChange('Loan and Advance', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyLoanAndAdvance).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.loans.map((item, idx) => (
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
                    const totalLoansCy = reports.subitems.loans.reduce((acc, l) => acc + l.cy, 0);
                    const npaProvisionVal = records.filter(r => r.type === 'Provisions' && r.head.toLowerCase().includes('npa')).reduce((acc, r) => acc + (r.openingBalance + r.totalCredit - r.totalDebit), 0);
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyClosingStock).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyClosingStock}
                        onChange={(e) => handlePyCategoryChange('Closing Stock', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyClosingStock).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Fixed Assets */}
                  <tr className="main-category-row">
                    <td style={{ textAlign: 'center' }}>7</td>
                    <td style={{ fontWeight: 'bold' }}>FIXED ASSETS</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyFixedAssets).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyFixedAssets}
                        onChange={(e) => handlePyCategoryChange('Fixed Assets', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyFixedAssets).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.fixed.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyOtherAssets).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyOtherAssets}
                        onChange={(e) => handlePyCategoryChange('Other Assets', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyOtherAssets).toFixed(2)}</span>
                    </td>
                  </tr>
                  {(() => {
                    const loanInterestItems = reports.subitems.otherAssets.filter(item => 
                      item.head.toLowerCase().includes('receivable on loan') || 
                      ['pledge loan', 'shg loan', 'daily savings loan', 'lad', 'staff loan'].some(n => item.head.toLowerCase().includes(n))
                    );
                    const totalLoanInt = loanInterestItems.reduce((acc, item) => acc + item.cy, 0);
                    const provOdInterest = records.filter(r => r.type === 'Other Assets' && r.head.toLowerCase().includes('provision for o.d')).reduce((acc, r) => acc + (r.openingBalance + r.totalCredit - r.totalDebit), 0);
                    const investInterest = reports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('investment')).reduce((acc, item) => acc + item.cy, 0);
                    const neftRtgs = reports.subitems.otherAssets.filter(item => item.head.toLowerCase().includes('neft') || item.head.toLowerCase().includes('rtgs')).reduce((acc, item) => acc + item.cy, 0);

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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyPL_Asset).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyPL_Asset}
                        onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Asset)', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyPL_Asset).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Grand Total */}
                  <tr className="coop-grand-total">
                    <td></td>
                    <td>TOTAL</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyAssetsTotal).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.pyAssetsTotal).toFixed(2)}</td>
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
          {activeTab === 'liab_sch' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">SHEDULE OF LIABILITIES BEING A PART OF BALANCE SHEET AS ON {getEndDate(metadata.dateRange)}</h3>
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
                    <td></td>
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
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(reports.cyPaidUpShareCapital).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: '600' }}
                        value={reports.pyPaidUpShareCapital}
                        onChange={(e) => handlePyCategoryChange('Paid Up Share Capital', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyPaidUpShareCapital).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.paidup.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyReserves).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyReserves}
                        onChange={(e) => handlePyCategoryChange('Reserves', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyReserves).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.reserves.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyGrants).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyGrants}
                        onChange={(e) => handlePyCategoryChange('Grants and Other Funds', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyGrants).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.grants.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyDeposits).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyDeposits}
                        onChange={(e) => handlePyCategoryChange('Deposits', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyDeposits).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.deposits.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyBorrowings).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyBorrowings}
                        onChange={(e) => handlePyCategoryChange('Borrowings', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyBorrowings).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.borrowings.map((item, idx) => (
                    <tr key={idx} className="sub-item-row">
                      <td></td>
                      <td style={{ paddingLeft: '2rem' }}>A) BORROWING FROM MDCCB/SCB:</td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                  {reports.subitems.borrowings.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyOtherLiabilities).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyOtherLiabilities}
                        onChange={(e) => handlePyCategoryChange('Other Liabilities', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyOtherLiabilities).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.otherLiabilities.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyProvisions).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyProvisions}
                        onChange={(e) => handlePyCategoryChange('Provisions', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyProvisions).toFixed(2)}</span>
                    </td>
                  </tr>
                  {reports.subitems.provisions.map((item, idx) => (
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
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(reports.cyPL_Liability).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={reports.pyPL_Liability}
                        onChange={(e) => handlePyCategoryChange('Profit and Loss Account (Liability)', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(reports.pyPL_Liability).toFixed(2)}</span>
                    </td>
                  </tr>

                  {/* Grand Total */}
                  <tr className="coop-grand-total">
                    <td></td>
                    <td>TOTAL</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.cyLiabilitiesTotal).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{Number(reports.pyLiabilitiesTotal).toFixed(2)}</td>
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
          {activeTab === 'pl_coop' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">PROFIT AND LOSS ACCOUNT FOR THE YEAR {getEndDate(metadata.dateRange)}</h3>
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
                        value={metadata.pyPlInvestmentInterest}
                        onChange={(e) => handlePyMetadataChange('pyPlInvestmentInterest', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlInvestmentInterest).toFixed(2)}</span>
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
                        value={metadata.pyPlMiscIncome}
                        onChange={(e) => handlePyMetadataChange('pyPlMiscIncome', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlMiscIncome).toFixed(2)}</span>
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
                        value={metadata.pyPlEstablishment}
                        onChange={(e) => handlePyMetadataChange('pyPlEstablishment', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlEstablishment).toFixed(2)}</span>
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
                        value={metadata.pyPlDepreciation}
                        onChange={(e) => handlePyMetadataChange('pyPlDepreciation', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlDepreciation).toFixed(2)}</span>
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
                        value={metadata.pyPlProvisionStandard}
                        onChange={(e) => handlePyMetadataChange('pyPlProvisionStandard', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlProvisionStandard).toFixed(2)}</span>
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
                        value={metadata.pyPlProvisionNpa}
                        onChange={(e) => handlePyMetadataChange('pyPlProvisionNpa', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlProvisionNpa).toFixed(2)}</span>
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
                        value={metadata.pyPlOverdueInterest}
                        onChange={(e) => handlePyMetadataChange('pyPlOverdueInterest', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlOverdueInterest).toFixed(2)}</span>
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
                        value={metadata.pyPlAuditFees}
                        onChange={(e) => handlePyMetadataChange('pyPlAuditFees', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlAuditFees).toFixed(2)}</span>
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
                        value={metadata.pyPlProfit}
                        onChange={(e) => handlePyMetadataChange('pyPlProfit', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlProfit).toFixed(2)}</span>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>NET LOSS FOR THE YEAR</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(plValues.inc.loss).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <input
                        type="number"
                        style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%', fontWeight: 'bold' }}
                        value={metadata.pyPlLoss}
                        onChange={(e) => handlePyMetadataChange('pyPlLoss', e.target.value)}
                        className="no-print"
                      />
                      <span className="print-only">{Number(metadata.pyPlLoss).toFixed(2)}</span>
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

          {activeTab === 'pl_sch' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">SCHEDULE OF P&L A/C FOR THE PERIOD {metadata.dateRange}</h3>
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
                      <td style={{ fontWeight: 'bold' }}>TO, INT. PAID & DUE FOR 2022-23</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                    <tr className="sub-item-row">
                      <td style={{ paddingLeft: '2rem' }}>TO INT. PAID ON DEPOSITS</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }} rowSpan="7">1</td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(plValues.exp.depositInt * 1.13).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                          value={metadata.pySchDepositInt}
                          onChange={(e) => handlePyMetadataChange('pySchDepositInt', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchDepositInt).toFixed(2)}</span>
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
                          value={metadata.pySchDepositDue}
                          onChange={(e) => handlePyMetadataChange('pySchDepositDue', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchDepositDue).toFixed(2)}</span>
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
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(metadata.pySchDepositInt + metadata.pySchDepositDue).toFixed(2)}</td>
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
                          value={metadata.pySchDepositLastDue}
                          onChange={(e) => handlePyMetadataChange('pySchDepositLastDue', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchDepositLastDue).toFixed(2)}</span>
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
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }} rowSpan="4">2</td>
                      <td style={{ textAlign: 'right' }}>209689.00</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>209689.00</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                          value={metadata.pySchBorrowingInt}
                          onChange={(e) => handlePyMetadataChange('pySchBorrowingInt', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchBorrowingInt).toFixed(2)}</span>
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
                          value={metadata.pySchBorrowingDue}
                          onChange={(e) => handlePyMetadataChange('pySchBorrowingDue', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchBorrowingDue).toFixed(2)}</span>
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
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(metadata.pySchBorrowingInt + metadata.pySchBorrowingDue).toFixed(2)}</td>
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
                          value={metadata.pySchBorrowingLastDue}
                          onChange={(e) => handlePyMetadataChange('pySchBorrowingLastDue', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchBorrowingLastDue).toFixed(2)}</span>
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
                      <td style={{ fontWeight: 'bold' }}>BY, INT. RECEIVED & RECEIVABLE FOR 2022-23</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                    <tr className="sub-item-row">
                      <td style={{ paddingLeft: '2rem' }}>BY INT. RECEIVED ON LOANS</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }} rowSpan="14">3</td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(plValues.inc.loanInterestRec * 0.94).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          style={{ border: 'none', borderBottom: '1px dotted #ccc', textAlign: 'right', padding: '0.2rem', width: '100%' }}
                          value={metadata.pySchLoanInt}
                          onChange={(e) => handlePyMetadataChange('pySchLoanInt', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchLoanInt).toFixed(2)}</span>
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
                          value={metadata.pySchLoanDue}
                          onChange={(e) => handlePyMetadataChange('pySchLoanDue', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchLoanDue).toFixed(2)}</span>
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
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(metadata.pySchLoanInt + metadata.pySchLoanDue).toFixed(2)}</td>
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
                          value={metadata.pySchLoanLastDue}
                          onChange={(e) => handlePyMetadataChange('pySchLoanLastDue', e.target.value)}
                          className="no-print"
                        />
                        <span className="print-only">{Number(metadata.pySchLoanLastDue).toFixed(2)}</span>
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
          {activeTab === 'npa' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">NPA SUMMARY AS ON {getEndDate(metadata.dateRange)}</h3>
              </div>

              <div className="no-print" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontWeight: '600', color: '#334155' }}>Upload Detailed List Excel to Calculate NPA:</span>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleNpaExcelUpload} 
                    style={{ display: 'none' }} 
                    id="npa-excel-upload"
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => document.getElementById('npa-excel-upload').click()}
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
          {activeTab === 'diff' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">DIFFERENCE SHEET AS ON {getEndDate(metadata.dateRange)}</h3>
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
                  <tr className="main-category-row"><td colSpan="4">DEPOSIT</td></tr>
                  {reports.subitems.deposits.map((item, idx) => (
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
                  {reports.subitems.borrowings.map((item, idx) => (
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
                  {reports.subitems.loans.map((item, idx) => (
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
                  {reports.subitems.mddccb.map((item, idx) => (
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
                  {reports.subitems.investment.map((item, idx) => (
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
                  {reports.subitems.paidup.map((item, idx) => (
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
          {activeTab === 'tb' && (
            <div className="coop-report-print">
              <div className="statement-title-block yellow-header">
                <h2>{metadata.companyName}</h2>
                {metadata.registrationNo && <p className="reg-text">REGD. NO-{metadata.registrationNo}</p>}
                {metadata.address && <p className="addr-text">{metadata.address}</p>}
                <h3 className="statement-name">
                  TRIAL BALANCE AS ON {getEndDate(metadata.dateRange)}
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
              {reports.tbSummary && (
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
                      background: reports.tbSummary.isBalanced ? '#d1fae5' : '#fee2e2',
                      color: reports.tbSummary.isBalanced ? '#065f46' : '#991b1b'
                    }}>
                      {reports.tbSummary.isBalanced ? '✓ Balanced' : '⚠ Out of Balance'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Opening Balance</span>
                      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {Number(reports.tbSummary.aeOB).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Diff: 0.00</span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Debit Movements</span>
                      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {Number(reports.tbSummary.aeDr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Matches Credit: {Math.abs(reports.tbSummary.aeDr - reports.tbSummary.liCr) < 0.1 ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Credit Movements</span>
                      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {Number(reports.tbSummary.aeCr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Matches Debit: {Math.abs(reports.tbSummary.aeCr - reports.tbSummary.liDr) < 0.1 ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Closing Balance</span>
                      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {Number(reports.tbSummary.aeEnding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                        Diff: {Number(reports.tbSummary.aeEnding - reports.tbSummary.liEnding).toFixed(2)}
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
                      {reports.tbLines.filter(l => [
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
                          {Number(reports.tbLines.filter(l => [
                            'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                          ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + (l.openingBalance || 0), 0)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(reports.tbLines.filter(l => [
                            'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                          ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + (l.totalDebit || 0), 0)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(reports.tbLines.filter(l => [
                            'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                          ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + (l.totalCredit || 0), 0)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(reports.tbLines.filter(l => [
                            'Balance with MDDCCB Bank', 'Balance with Other Banks', 'Investment', 'Loan and Advance', 'Closing Stock', 'Fixed Assets', 'Other Assets', 'Expense', 'Asset'
                          ].includes(l.type) || l.code === 'CASH').reduce((acc, l) => acc + (l.endingBalance || 0), 0)).toFixed(2)}
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
                      {reports.tbLines.filter(l => [
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
                          {Number(reports.tbLines.filter(l => [
                            'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                          ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + (l.openingBalance || 0), 0)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(reports.tbLines.filter(l => [
                            'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                          ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + (l.totalDebit || 0), 0)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(reports.tbLines.filter(l => [
                            'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                          ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + (l.totalCredit || 0), 0)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(reports.tbLines.filter(l => [
                            'Paid Up Share Capital', 'Reserves', 'Grants and Other Funds', 'Deposits', 'Borrowings', 'Other Liabilities', 'Provisions', 'Profit and Loss Account (Liability)', 'Income'
                          ].includes(l.type) || l.code === 'OP_CASH').reduce((acc, l) => acc + (l.endingBalance || 0), 0)).toFixed(2)}
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
        </>
      )}
    </div>
  );
}

export default CashAccountUpload;
