const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize, User, Transaction, Report, Customer, LedgerBalance } = require('./models');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');

const normalizePeriod = (period) => {
  if (!period) return '';
  // Try matching YYYY-YY
  let match = period.match(/^(\d{4})-(\d{2})$/);
  if (match) return period;
  
  // Try matching YYYY-YYYY
  match = period.match(/^(\d{4})-(\d{4})$/);
  if (match) {
    return `${match[1]}-${match[2].substring(2)}`;
  }
  
  // Try matching DD-MM-YYYY To DD-MM-YYYY
  match = period.match(/(\d{2})-(\d{2})-(\d{4})\s+To\s+(\d{2})-(\d{2})-(\d{4})/i);
  if (match) {
    const startYear = parseInt(match[3], 10);
    const endYear = parseInt(match[6], 10);
    return `${startYear}-${String(endYear % 100).padStart(2, '0')}`;
  }
  
  return period;
};

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

const isBalanceSheetType = (type) => {
  if (!type) return false;
  const t = type.toLowerCase();
  return !t.includes('income') && !t.includes('expense');
};

const correctedClassify = (code, type) => {
  if (!code) return type;
  const codeStr = String(code);
  if (codeStr === '23583') return 'Balance with MDDCCB Bank';
  if (codeStr.startsWith('5')) return 'Income';
  if (codeStr.startsWith('6')) return 'Expense';
  return type;
};


const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.get('/', (req, res) => {
  res.send('Accounting Backend API Running');
});

// User CRUD
app.get('/api/users', async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
});
app.put('/api/users/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (user) {
    await user.update(req.body);
    res.json(user);
  } else {
    res.status(404).send('User not found');
  }
});
app.delete('/api/users/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (user) {
    await user.destroy();
    res.sendStatus(204);
  } else {
    res.status(404).send('User not found');
  }
});

// Transaction CRUD
app.get('/api/transactions/balance', async (req, res) => {
  const { toDate } = req.query;
  console.log('GET /api/transactions/balance - toDate:', toDate);
  const { Op } = require('sequelize');
  try {
    const end = new Date(toDate);
    const transactions = await Transaction.findAll({
      where: {
        date: {
          [Op.lt]: end
        }
      }
    });

    let currentBalance = 0.0;
    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      if (!isNaN(amount)) {
        if (tx.type === 'income') {
          currentBalance = currentBalance + amount;
        } else if (tx.type === 'expense') {
          currentBalance = currentBalance - amount;
        }
      }
    });

    res.json({ balance: Math.round(currentBalance * 100) / 100 });
  } catch (err) {
    res.status(500).json({ message: 'Error calculating balance', error: err.message });
  }
});

app.get('/api/transactions/report', async (req, res) => {
  const { fromDate, toDate } = req.query;
  console.log('GET /api/transactions/report - fromDate:', fromDate, 'toDate:', toDate);
  const { Op } = require('sequelize');
  try {
    const start = new Date(fromDate);
    const end = new Date(toDate + 'T23:59:59');
    console.log('Query date objects:', start, end);
    const transactions = await Transaction.findAll({
      where: {
        date: {
          [Op.between]: [start, end]
        }
      },
      order: [['date', 'ASC']]
    });
    console.log('Found transactions count:', transactions.length);
    res.json(transactions);
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ message: 'Error fetching report', error: err.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  const transactions = await Transaction.findAll();
  res.json(transactions);
});

app.post('/api/transactions', async (req, res) => {
  const transaction = await Transaction.create(req.body);
  res.json(transaction);
});

app.put('/api/transactions/:id', async (req, res) => {
  const transaction = await Transaction.findByPk(req.params.id);
  if (transaction) {
    await transaction.update(req.body);
    res.json(transaction);
  } else {
    res.status(404).send('Transaction not found');
  }
});
app.delete('/api/transactions/:id', async (req, res) => {
  const transaction = await Transaction.findByPk(req.params.id);
  if (transaction) {
    await transaction.destroy();
    res.sendStatus(204);
  } else {
    res.status(404).send('Transaction not found');
  }
});

// Report CRUD
app.get('/api/reports', async (req, res) => {
  const reports = await Report.findAll();
  res.json(reports);
});
app.post('/api/reports', async (req, res) => {
  const report = await Report.create(req.body);
  res.json(report);
});
app.put('/api/reports/:id', async (req, res) => {
  const report = await Report.findByPk(req.params.id);
  if (report) {
    await report.update(req.body);
    res.json(report);
  } else {
    res.status(404).send('Report not found');
  }
});
app.delete('/api/reports/:id', async (req, res) => {
  const report = await Report.findByPk(req.params.id);
  if (report) {
    await report.destroy();
    res.sendStatus(204);
  } else {
    res.status(404).send('Report not found');
  }
});

// Customer CRUD
app.get('/api/customers', async (req, res) => {
  const customers = await Customer.findAll();
  res.json(customers);
});
app.post('/api/customers', async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.json(customer);
  } catch (err) {
    res.status(400).json({ message: 'Error creating customer', error: err.message });
  }
});
app.put('/api/customers/:id', async (req, res) => {
  const customer = await Customer.findByPk(req.params.id);
  if (customer) {
    await customer.update(req.body);
    res.json(customer);
  } else {
    res.status(404).send('Customer not found');
  }
});
app.delete('/api/customers/:id', async (req, res) => {
  const customer = await Customer.findByPk(req.params.id);
  if (customer) {
    await customer.destroy();
    res.sendStatus(204);
  } else {
    res.status(404).send('Customer not found');
  }
});

// User Registration
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.json({ message: 'User registered successfully', user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// Configure nodemailer (use your real email credentials in production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your.email@gmail.com', // replace with your email
    pass: 'yourpassword' // replace with your email password or app password
  }
});

// Forgot Password (send reset link)
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Generate token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
    await user.update({ resetPasswordToken: token, resetPasswordExpires: new Date(expires) });
    // Send email
    const resetUrl = `http://localhost:3000/reset-password/${token}`;
    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset for your Accounting App account.</p>
             <p>Click <a href="${resetUrl}">here</a> to reset your password. This link is valid for 1 hour.</p>`
    });
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error('Error sending reset password email:', err);
    res.status(500).json({ message: 'Failed to send reset email', error: err.message });
  }
});

// Reset Password (via link)
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [require('sequelize').Op.gt]: new Date() }
      }
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null });
    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
});

// PDF Cash Account Parsing Endpoint
app.post('/api/upload-cash-account', async (req, res) => {
  try {
    const { pdf } = req.body;
    if (!pdf) {
      return res.status(400).json({ message: 'No PDF data provided' });
    }

    const { PDFParse } = require('pdf-parse');
    const buffer = Buffer.from(pdf, 'base64');
    const pdfParser = new PDFParse(new Uint8Array(buffer));
    const resultObj = await pdfParser.getText();
    const text = resultObj.text;
    require('fs').writeFileSync(require('path').join(__dirname, 'parsed_pdf_text.txt'), text, 'utf8');

    // Parse text line by line
    const lines = text.split('\n');

    let companyName = 'KUMARPUR SKUS Ltd.'; // Default / Fallback
    let registrationNo = '';
    let address = '';
    let dateRange = '';
    let openingCash = 0;
    let closingCash = 0;

    const records = [];
    const entryRegex = /\b(\d{4,6})\b\s+([A-Za-z\s\(\)\-\/\.\,\&\d\+\’\'\"\:\%\[\]\#\@\*]{3,60}?)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)/g;

    const classifyAccount = (code, name, isReceipt) => {
      if (code) {
        const codeStr = String(code);
        if (codeStr === '23583') return 'Balance with MDDCCB Bank';
        if (codeStr.startsWith('5')) return 'Income';
        if (codeStr.startsWith('6')) return 'Expense';
      }
      const nameLower = name.toLowerCase();
      if (nameLower.includes('afirul')) return 'Balance with MDDCCB Bank';
      
      // Explicit nominal check first to avoid overlap with Asset/Liability categories
      if (isReceipt && (
        nameLower.includes('commission') ||
        nameLower.includes('admission fee') ||
        nameLower.includes('processing fee') ||
        nameLower.includes('dividend') ||
        nameLower.includes('misc income') ||
        nameLower.includes('interest received')
      )) {
        return 'Income';
      }

      const expenseKeywords = [
        'rent', 'salary', 'stationery', 'printing', 'telephone', 'electricity', 
        'postage', 'travel', 'honorarium', 'audit', 'depreciation', 'charges', 
        'wages', 'tax', 'meeting', 'fuel', 'conveyance', 'allowance', 
        'entertainment', 'expense', 'remuneration', 'commission'
      ];
      if (!isReceipt && expenseKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(nameLower))) {
        return 'Expense';
      }


      
      // Interest Expense / Income (Nominal)
      if (
        (nameLower.includes('interest') || nameLower.includes('int on') || nameLower.includes('int. on') || nameLower.includes('int of')) &&
        !nameLower.includes('payable') &&
        !nameLower.includes('receivable') &&
        !nameLower.includes('accrued') &&
        !nameLower.includes('outstanding')
      ) {
        return isReceipt ? 'Income' : 'Expense';
      }

      // Fixed Assets
      if (
        nameLower.includes('furniture') ||
        nameLower.includes('fixture') ||
        nameLower.includes('computer') ||
        nameLower.includes('accessories') ||
        nameLower.includes('building') ||
        nameLower.includes('land') ||
        nameLower.includes('fixed asset')
      ) {
        return 'Fixed Assets';
      }

      // MDDCCB Bank
      if (nameLower.includes('mddccb') || nameLower.includes('mdccb')) {
        if (nameLower.includes('borrowing') || nameLower.includes('loan from')) {
          return 'Borrowings';
        }
        return 'Balance with MDDCCB Bank';
      }

      // Other Banks
      if (nameLower.includes('bank') || nameLower.includes('sbi') || nameLower.includes('ubi') || nameLower.includes('pnb')) {
        if (nameLower.includes('borrowing') || nameLower.includes('loan from')) {
          return 'Borrowings';
        }
        return 'Balance with Other Banks';
      }

      // Investments
      if (
        nameLower.includes('investment') ||
        nameLower.includes('re-investment') ||
        nameLower.includes('shares in') ||
        nameLower.includes('share in')
      ) {
        return 'Investment';
      }

      // Share Capital
      if (nameLower.includes('share capital') || nameLower.includes('paid up')) {
        return 'Paid Up Share Capital';
      }

      // Reserves
      if (nameLower.includes('reserve') || nameLower.includes('provident fund reserve')) {
        return 'Reserves';
      }

      // Grants
      if (nameLower.includes('grant') || nameLower.includes('subsidy fund')) {
        return 'Grants and Other Funds';
      }

      // Borrowings
      if (nameLower.includes('borrowing') || nameLower.includes('loan from')) {
        return 'Borrowings';
      }

      // Deposits
      if (nameLower.includes('deposit') || nameLower.includes('savings ac') || nameLower.includes('saving ac') || nameLower.includes('savings deposit')) {
        return 'Deposits';
      }

      // Provisions
      if (nameLower.includes('provision') || nameLower.includes('audit fee payable')) {
        return 'Provisions';
      }

      // Other Liabilities
      if (nameLower.includes('payable') || nameLower.includes('suspense') || nameLower.includes('outstanding')) {
        return 'Other Liabilities';
      }

      // Loans given (Assets)
      if (nameLower.includes('loan') || nameLower.includes('kcc') || nameLower.includes('lad') || nameLower.includes('shg')) {
        return 'Loan and Advance';
      }

      // Stock
      if (nameLower.includes('stock') || nameLower.includes('inventory')) {
        return 'Closing Stock';
      }

      // Nominal Incomes & Expenses
      if (isReceipt && (
        nameLower.includes('interest received') ||
        nameLower.includes('interest on') ||
        nameLower.includes('admission fee') ||
        nameLower.includes('processing fee') ||
        nameLower.includes('commission') ||
        nameLower.includes('dividend') ||
        nameLower.includes('misc income') ||
        nameLower.includes('admission') ||
        nameLower.includes('profit')
      )) {
        return 'Income';
      }

      if (!isReceipt && (
        nameLower.includes('rent') ||
        nameLower.includes('salary') ||
        nameLower.includes('stationery') ||
        nameLower.includes('printing') ||
        nameLower.includes('telephone') ||
        nameLower.includes('electricity') ||
        nameLower.includes('postage') ||
        nameLower.includes('travel') ||
        nameLower.includes('honorarium') ||
        nameLower.includes('audit') ||
        nameLower.includes('depreciation') ||
        nameLower.includes('charges') ||
        nameLower.includes('wages') ||
        nameLower.includes('tax') ||
        nameLower.includes('meeting') ||
        nameLower.includes('fuel') ||
        nameLower.includes('conveyance') ||
        nameLower.includes('allowance') ||
        nameLower.includes('entertainment') ||
        nameLower.includes('expense')
      )) {
        return 'Expense';
      }

      if (code.startsWith('2')) {
        return 'Loan and Advance';
      } else if (code.startsWith('1')) {
        return 'Deposits';
      }

      return isReceipt ? 'Income' : 'Expense';
    };

    // Parse lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match metadata
      if (line.includes('KUMARPUR') || line.includes('SKUS') || (i < 5 && line.trim().length > 5 && !line.includes('Registration')) && companyName === 'KUMARPUR SKUS Ltd.') {
        if (line.includes('SKUS') || line.includes('Ltd')) {
          companyName = line.trim();
        }
      }

      const regMatch = line.match(/(?:Registration\s+No\.?|Regd?\.?\s*No\.?):?\s*([^\n\r\t,]+)/i);
      if (regMatch) {
        registrationNo = regMatch[1].trim();
      }

      if (line.includes('Vill') || line.includes('P.O.') || line.includes('Dist')) {
        address = line.trim();
      }

      const dateMatch = line.match(/(?:From|Period|Date|Cash Account From):?\s*(\d{2}-\d{2}-\d{4})\s*To\s*(\d{2}-\d{2}-\d{4})/i);
      if (dateMatch) {
        dateRange = `${dateMatch[1]} To ${dateMatch[2]}`;
      }

      const openingMatch = line.match(/(?:Opening\s+(?:Cash\s+)?Balance|Cash\s+in\s+Hand\s*\(Opening\)|Opening\s+Cash):?\s*([\d\.,]+)/i);
      if (openingMatch && openingCash === 0) {
        openingCash = parseFloat(openingMatch[1].replace(/,/g, ''));
      }

      const closingMatchRobust = line.match(/(?:Closing\s+(?:Cash\s+)?Balance|Cash\s+in\s+Hand\s*\(Closing\)|Closing\s+Cash|Closing\s+Balance):?\s*([\d\.,]+)/i);
      if (closingMatchRobust) {
        closingCash = parseFloat(closingMatchRobust[1].replace(/,/g, ''));
      }
    }

    // Parse entries by page to handle multi-line wrapping and Receipt vs Payment column splits
    const pagesText = text.split(/-- \d+ of \d+ --/);
    
    pagesText.forEach((pageText) => {
      const pageLines = pageText.split('\n');
      const pageEntries = [];
      let currentCode = null;
      let currentHead = '';
      
      const codeRegex = /^\s*(\d{4,6})(?!\.)\b/;
      const valuesRegex = /\b([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s*$/;
      
      pageLines.forEach((line) => {
        const lineTrimmed = line.trim();
        if (lineTrimmed === '' || lineTrimmed.startsWith('--')) {
          return;
        }
        
        // Skip general headers/metadata unless we are inside a code buffer
        if (lineTrimmed.includes('KUMARPUR') || lineTrimmed.includes('SKUS') || lineTrimmed.includes('Registration') || lineTrimmed.includes('Cash Account From') || lineTrimmed.includes('Receipt') || lineTrimmed.includes('Payment') || lineTrimmed.includes('Total') || lineTrimmed.includes('Grand Total') || lineTrimmed.includes('Opening Balance') || lineTrimmed.includes('Closing Balance')) {
          if (!currentCode) return;
        }
        
        const codeMatch = line.match(codeRegex);
        const valuesMatch = line.match(valuesRegex);
        
        if (codeMatch) {
          const code = codeMatch[1];
          let rest = line.substring(line.indexOf(code) + code.length).trim();
          
          if (valuesMatch) {
            const valStr = valuesMatch[0];
            const namePart = rest.substring(0, rest.lastIndexOf(valStr)).trim();
            const val1 = parseFloat(valuesMatch[1].replace(/,/g, ''));
            const val2 = parseFloat(valuesMatch[2].replace(/,/g, ''));
            const val3 = parseFloat(valuesMatch[3].replace(/,/g, ''));
            pageEntries.push({ code, head: namePart, val1, val2, val3 });
            currentCode = null;
            currentHead = '';
          } else {
            currentCode = code;
            currentHead = rest;
          }
        } else if (valuesMatch) {
          if (currentCode) {
            const valStr = valuesMatch[0];
            const namePart = line.substring(0, line.lastIndexOf(valStr)).trim();
            if (namePart) {
              currentHead += ' ' + namePart;
            }
            const val1 = parseFloat(valuesMatch[1].replace(/,/g, ''));
            const val2 = parseFloat(valuesMatch[2].replace(/,/g, ''));
            const val3 = parseFloat(valuesMatch[3].replace(/,/g, ''));
            pageEntries.push({ code: currentCode, head: currentHead.trim(), val1, val2, val3 });
            currentCode = null;
            currentHead = '';
          }
        } else {
          if (currentCode) {
            currentHead += ' ' + lineTrimmed;
          }
        }
      });
      
      if (pageEntries.length === 0) return;
      
      // Determine split index between Receipts (left column) and Payments (right column)
      const codeOccurrences = {};
      pageEntries.forEach((e, idx) => {
        if (!codeOccurrences[e.code]) {
          codeOccurrences[e.code] = [];
        }
        codeOccurrences[e.code].push(idx);
      });

      const duplicates = Object.keys(codeOccurrences).filter(code => {
        const idxs = codeOccurrences[code];
        return idxs.length > 1 && (idxs[idxs.length - 1] - idxs[0] > 5);
      });

      let splitIndex = -1;
      if (duplicates.length > 0) {
        let maxFirst = -1;
        let minSecond = pageEntries.length;

        duplicates.forEach(code => {
          const idxs = codeOccurrences[code];
          const first = idxs[0];
          const second = idxs[idxs.length - 1];
          if (first > maxFirst) maxFirst = first;
          if (second < minSecond) minSecond = second;
        });

        for (let i = maxFirst + 1; i <= minSecond; i++) {
          const prevCode = parseInt(pageEntries[i - 1].code);
          const currCode = parseInt(pageEntries[i].code);
          if (currCode < prevCode) {
            splitIndex = i;
            break;
          }
        }
      }

      if (splitIndex === -1) {
        const seen = new Set();
        let firstDupIndex = -1;
        for (let i = 0; i < pageEntries.length; i++) {
          if (seen.has(pageEntries[i].code)) {
            const firstIdx = pageEntries.findIndex(p => p.code === pageEntries[i].code);
            if (i - firstIdx > 5) {
              firstDupIndex = i;
              break;
            }
          }
          seen.add(pageEntries[i].code);
        }
        
        const hasBSCodes = pageEntries.some(e => e.code.startsWith('1') || e.code.startsWith('2'));
        
        splitIndex = firstDupIndex;
        if (firstDupIndex === -1) {
          splitIndex = Math.floor(pageEntries.length / 2);
          for (let i = 0; i < pageEntries.length; i++) {
            if (pageEntries[i].code.startsWith('4') || pageEntries[i].code.startsWith('6')) {
              splitIndex = i;
              break;
            }
          }
        } else {
          let firstBSPaymentCode = null;
          if (pageEntries[firstDupIndex].code.startsWith('1') || pageEntries[firstDupIndex].code.startsWith('2')) {
            firstBSPaymentCode = parseInt(pageEntries[firstDupIndex].code);
          }
          
          for (let i = firstDupIndex - 1; i >= 0; i--) {
            const codeStr = pageEntries[i].code;
            const codeVal = parseInt(codeStr);
            
            if (hasBSCodes) {
              // Page 1: codes starting with 4, 5, 6 are Payments
              if (codeStr.startsWith('4') || codeStr.startsWith('5') || codeStr.startsWith('6')) {
                splitIndex = i;
                continue;
              }
              // 3 is Receipt
              if (codeStr.startsWith('3')) {
                break;
              }
              // 1 and 2 are B/S
              if (codeStr.startsWith('1') || codeStr.startsWith('2')) {
                if (firstBSPaymentCode !== null && codeVal > firstBSPaymentCode) {
                  break;
                }
              }
            } else {
              // Page 2: 6 is Payment, 5 is Receipt
              if (codeStr.startsWith('6')) {
                splitIndex = i;
                continue;
              }
              if (codeStr.startsWith('5')) {
                break;
              }
            }
          }
        }
      }
      
      pageEntries.forEach((e, idx) => {
        const isReceipt = idx < splitIndex;
        if (isReceipt) {
          records.push({
            code: e.code,
            head: e.head,
            cashCredit: e.val1,
            transferCredit: e.val2,
            totalCredit: e.val3,
            cashDebit: 0,
            transferDebit: 0,
            totalDebit: 0,
            type: classifyAccount(e.code, e.head, true)
          });
        } else {
          records.push({
            code: e.code,
            head: e.head,
            cashCredit: 0,
            transferCredit: 0,
            totalCredit: 0,
            cashDebit: e.val1,
            transferDebit: e.val2,
            totalDebit: e.val3,
            type: classifyAccount(e.code, e.head, false)
          });
        }
      });
    });

    // Consolidate duplicates
    const consolidated = {};
    records.forEach(r => {
      const key = r.code + '_' + r.head;
      if (!consolidated[key]) {
        consolidated[key] = {
          code: r.code,
          head: r.head,
          cashCredit: 0,
          transferCredit: 0,
          totalCredit: 0,
          cashDebit: 0,
          transferDebit: 0,
          totalDebit: 0,
          type: r.type,
        };
      }
      consolidated[key].cashCredit += r.cashCredit;
      consolidated[key].transferCredit += r.transferCredit;
      consolidated[key].totalCredit += r.totalCredit;
      consolidated[key].cashDebit += r.cashDebit;
      consolidated[key].transferDebit += r.transferDebit;
      consolidated[key].totalDebit += r.totalDebit;
      if (r.type !== 'Income' && r.type !== 'Expense') {
        consolidated[key].type = r.type;
      }
    });

    const finalRecords = Object.values(consolidated).map(r => ({
      ...r,
      cashCredit: Math.round(r.cashCredit * 100) / 100,
      transferCredit: Math.round(r.transferCredit * 100) / 100,
      totalCredit: Math.round(r.totalCredit * 100) / 100,
      cashDebit: Math.round(r.cashDebit * 100) / 100,
      transferDebit: Math.round(r.transferDebit * 100) / 100,
      totalDebit: Math.round(r.totalDebit * 100) / 100,
    }));

    if (openingCash === 0) {
      lines.forEach(line => {
        const op = line.match(/(?:opening|cash\s+in\s+hand)\s*:\s*([\d\.,]+)/i);
        if (op) openingCash = parseFloat(op[1].replace(/,/g, ''));
      });
    }
    if (closingCash === 0) {
      lines.forEach(line => {
        const cl = line.match(/(?:closing|cash\s+in\s+hand)\s*:\s*([\d\.,]+)/i);
        if (cl) closingCash = parseFloat(cl[1].replace(/,/g, ''));
      });
    }

    res.json({
      success: true,
      metadata: {
        companyName,
        registrationNo,
        address,
        dateRange,
        openingCash,
        closingCash
      },
      records: finalRecords
    });
  } catch (err) {
    console.error('Error parsing Cash Account PDF:', err);
    res.status(500).json({ message: 'Error parsing PDF', error: err.message });
  }
});

// Helper to dynamically forward previous period ending balances
const mapLedgerBalancesWithPreviousYear = async (companyName, normalizedPeriod, currentRecords) => {
  const prevPeriod = getPreviousYear(normalizedPeriod);
  if (!prevPeriod) return currentRecords;

  const prevRecords = await LedgerBalance.findAll({
    where: { companyName, period: prevPeriod }
  });

  if (!prevRecords || prevRecords.length === 0) return currentRecords;

  const prevClCash = prevRecords.find(r => r.code === 'SYS_CL_CASH');
  const prevClosingCash = prevClCash ? prevClCash.openingBalance : null;

  // Consolidate previous year ending balances by code (correcting their type classification)
  const pyEndingBalances = {};
  prevRecords.forEach(p => {
    if (p.type === 'SystemMetadata') return;
    const codeStr = String(p.code);
    const type = correctedClassify(codeStr, p.type);
    if (!pyEndingBalances[codeStr]) {
      pyEndingBalances[codeStr] = {
        code: p.code,
        head: p.head,
        endingBalance: 0,
        type: type
      };
    }
    
    const isDebit = isDebitNormal(type);
    const ob = p.openingBalance || 0;
    const eb = isDebit
      ? ob + (p.totalDebit - p.totalCredit)
      : ob + (p.totalCredit - p.totalDebit);
    
    pyEndingBalances[codeStr].endingBalance += eb;
  });

  // Map existing current records
  const mapped = currentRecords.map(r => {
    // 1. Dynamic Cash In Hand opening mapping
    if (r.code === 'SYS_OP_CASH' && prevClosingCash !== null) {
      const plain = r.toJSON ? r.toJSON() : r;
      return {
        ...plain,
        openingBalance: prevClosingCash,
        endingBalance: prevClosingCash
      };
    }

    // 2. Normal records mapping
    if (r.type !== 'SystemMetadata') {
      const codeStr = String(r.code);
      const type = correctedClassify(codeStr, r.type);
      let ob = r.openingBalance || 0;
      
      if (ob === 0) {
        const pyInfo = pyEndingBalances[codeStr];
        if (pyInfo) {
          ob = pyInfo.endingBalance;
        } else {
          const matchByHead = Object.values(pyEndingBalances).find(p => p.head.toLowerCase().trim() === r.head.toLowerCase().trim());
          if (matchByHead) {
            ob = matchByHead.endingBalance;
          }
        }
      }

      // Calculate dynamic ending balance based on corrected type
      const isDebit = isDebitNormal(type);
      const endingVal = isDebit
        ? ob + (r.totalDebit - r.totalCredit)
        : ob + (r.totalCredit - r.totalDebit);

      const roundedEnding = Math.round(endingVal * 100) / 100;
      const plain = r.toJSON ? r.toJSON() : r;

      return {
        ...plain,
        openingBalance: ob,
        endingBalance: roundedEnding,
        detailListBalance: r.detailListBalance !== undefined ? r.detailListBalance : roundedEnding,
        type: type // return corrected type
      };
    }

    return r.toJSON ? r.toJSON() : r;
  });

  // Inject missing Balance Sheet records
  const mappedCodes = new Set(mapped.map(m => String(m.code)));
  const injected = [];
  let tempId = -1000;

  Object.keys(pyEndingBalances).forEach(code => {
    if (!mappedCodes.has(code)) {
      const pyInfo = pyEndingBalances[code];
      if (isBalanceSheetType(pyInfo.type)) {
        injected.push({
          id: tempId--,
          companyName,
          period: normalizedPeriod,
          code: pyInfo.code,
          head: pyInfo.head,
          openingBalance: Math.round(pyInfo.endingBalance * 100) / 100,
          totalDebit: 0,
          totalCredit: 0,
          endingBalance: Math.round(pyInfo.endingBalance * 100) / 100,
          detailListBalance: Math.round(pyInfo.endingBalance * 100) / 100,
          type: pyInfo.type,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  });

  return [...mapped, ...injected];
};

// GET /api/ledger-balances/latest: Get latest saved ledger balances for a company
app.get('/api/ledger-balances/latest', async (req, res) => {
  try {
    const { companyName } = req.query;
    if (!companyName) {
      return res.status(400).json({ message: 'companyName is required' });
    }

    // Find the latest saved record to get the latest period
    const latestRecord = await LedgerBalance.findOne({
      where: { companyName },
      order: [['createdAt', 'DESC']]
    });

    if (!latestRecord) {
      return res.json({ success: true, period: null, records: [] });
    }

    const records = await LedgerBalance.findAll({
      where: { companyName, period: latestRecord.period }
    });

    const mapped = await mapLedgerBalancesWithPreviousYear(companyName, latestRecord.period, records);

    res.json({
      success: true,
      period: latestRecord.period,
      records: mapped
    });
  } catch (err) {
    console.error('Error fetching latest ledger balances:', err);
    res.status(500).json({ message: 'Failed to fetch latest ledger balances', error: err.message });
  }
});

// GET /api/ledger-balances/companies: Get all saved companies
app.get('/api/ledger-balances/companies', async (req, res) => {
  try {
    const companies = await LedgerBalance.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('companyName')), 'companyName']],
      order: [['companyName', 'ASC']]
    });
    res.json({
      success: true,
      companies: companies.map(c => c.get('companyName'))
    });
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ message: 'Failed to fetch companies', error: err.message });
  }
});

// GET /api/ledger-balances/periods: Get all saved periods for a company
app.get('/api/ledger-balances/periods', async (req, res) => {
  try {
    const { companyName } = req.query;
    if (!companyName) {
      return res.status(400).json({ message: 'companyName is required' });
    }

    const periods = await LedgerBalance.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('period')), 'period']],
      where: { companyName },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      periods: periods.map(p => p.get('period'))
    });
  } catch (err) {
    console.error('Error fetching periods:', err);
    res.status(500).json({ message: 'Failed to fetch periods', error: err.message });
  }
});

// GET /api/ledger-balances/by-period: Get ledger balances for a specific period
app.get('/api/ledger-balances/by-period', async (req, res) => {
  try {
    const { companyName, period } = req.query;
    if (!companyName || !period) {
      return res.status(400).json({ message: 'companyName and period are required' });
    }

    const normalizedPeriod = normalizePeriod(period);
    const records = await LedgerBalance.findAll({
      where: { companyName, period: normalizedPeriod }
    });

    const mapped = await mapLedgerBalancesWithPreviousYear(companyName, normalizedPeriod, records);

    res.json({
      success: true,
      period: normalizedPeriod,
      records: mapped
    });
  } catch (err) {
    console.error('Error fetching ledger balances by period:', err);
    res.status(500).json({ message: 'Failed to fetch ledger balances', error: err.message });
  }
});

// POST /api/ledger-balances: Save current ledger balances
app.post('/api/ledger-balances', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { companyName, period, records } = req.body;
    if (!companyName || !period || !Array.isArray(records)) {
      return res.status(400).json({ message: 'companyName, period, and records (array) are required' });
    }

    const normalizedPeriod = normalizePeriod(period);

    // Remove existing records for this company and period
    await LedgerBalance.destroy({
      where: { companyName, period: normalizedPeriod },
      transaction
    });

    // Create new records
    const recordsToCreate = records.map(r => ({
      companyName,
      period: normalizedPeriod,
      code: r.code,
      head: r.head,
      openingBalance: parseFloat(r.openingBalance || 0),
      totalCredit: parseFloat(r.totalCredit || 0),
      totalDebit: parseFloat(r.totalDebit || 0),
      endingBalance: parseFloat(r.endingBalance || 0),
      detailListBalance: parseFloat(r.detailListBalance !== undefined ? r.detailListBalance : (r.endingBalance || 0)),
      type: r.type
    }));

    await LedgerBalance.bulkCreate(recordsToCreate, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Ledger balances saved successfully' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error saving ledger balances:', err);
    res.status(500).json({ message: 'Failed to save ledger balances', error: err.message });
  }
});

// POST /api/ledger-balances/single: Create a single ledger balance record
app.post('/api/ledger-balances/single', async (req, res) => {
  try {
    const { companyName, period, code, head, openingBalance, totalCredit, totalDebit, endingBalance, detailListBalance, type } = req.body;
    if (!companyName || !period || !code || !head) {
      return res.status(400).json({ message: 'companyName, period, code, and head are required' });
    }

    const normalizedPeriod = normalizePeriod(period);

    let finalType = type;
    if (!finalType) {
      const codeStr = String(code);
      if (codeStr.startsWith('5')) {
        finalType = 'Income';
      } else if (codeStr.startsWith('6')) {
        finalType = 'Expense';
      } else {
        const headLower = head.toLowerCase();
        if (headLower.includes('interest') || headLower.includes('fee') || headLower.includes('commission') || headLower.includes('income')) {
          finalType = 'Income';
        } else if (headLower.includes('expense') || headLower.includes('salary') || headLower.includes('rent') || headLower.includes('depreciation')) {
          finalType = 'Expense';
        } else if (headLower.includes('reserve') || headLower.includes('capital')) {
          finalType = 'Reserves';
        } else if (headLower.includes('deposit') || headLower.includes('savings')) {
          finalType = 'Deposits';
        } else if (headLower.includes('loan') || headLower.includes('kcc') || headLower.includes('advance')) {
          finalType = 'Loan and Advance';
        } else if (headLower.includes('bank') || headLower.includes('cash')) {
          finalType = 'Balance with MDDCCB Bank';
        } else {
          finalType = 'Other Assets';
        }
      }
    }

    const record = await LedgerBalance.create({
      companyName,
      period: normalizedPeriod,
      code,
      head,
      openingBalance: parseFloat(openingBalance || 0),
      totalCredit: parseFloat(totalCredit || 0),
      totalDebit: parseFloat(totalDebit || 0),
      endingBalance: parseFloat(endingBalance || 0),
      detailListBalance: parseFloat(detailListBalance !== undefined ? detailListBalance : (endingBalance || 0)),
      type: finalType
    });
    res.json(record);

  } catch (err) {
    console.error('Error creating single ledger balance:', err);
    res.status(500).json({ message: 'Error creating record', error: err.message });
  }
});

// PUT /api/ledger-balances/:id: Update an existing ledger record
app.put('/api/ledger-balances/:id', async (req, res) => {
  try {
    const record = await LedgerBalance.findByPk(req.params.id);
    if (!record) {
      return res.status(404).send('Record not found');
    }

    const { code, head, openingBalance, totalCredit, totalDebit, endingBalance, detailListBalance, type } = req.body;

    await record.update({
      code: code !== undefined ? code : record.code,
      head: head !== undefined ? head : record.head,
      openingBalance: openingBalance !== undefined ? parseFloat(openingBalance || 0) : record.openingBalance,
      totalCredit: totalCredit !== undefined ? parseFloat(totalCredit || 0) : record.totalCredit,
      totalDebit: totalDebit !== undefined ? parseFloat(totalDebit || 0) : record.totalDebit,
      endingBalance: endingBalance !== undefined ? parseFloat(endingBalance || 0) : record.endingBalance,
      detailListBalance: detailListBalance !== undefined ? parseFloat(detailListBalance || 0) : record.detailListBalance,
      type: type !== undefined ? type : record.type
    });

    res.json(record);
  } catch (err) {
    console.error('Error updating ledger balance:', err);
    res.status(500).json({ message: 'Error updating record', error: err.message });
  }
});

// DELETE /api/ledger-balances/:id: Delete an existing ledger record
app.delete('/api/ledger-balances/:id', async (req, res) => {
  try {
    const record = await LedgerBalance.findByPk(req.params.id);
    if (!record) {
      return res.status(404).send('Record not found');
    }
    await record.destroy();
    res.sendStatus(204);
  } catch (err) {
    console.error('Error deleting ledger balance:', err);
    res.status(500).json({ message: 'Error deleting record', error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Syncing database in background...');
  sequelize.query('DROP TABLE IF EXISTS Customers;').then(() => {
    return sequelize.query('ALTER TABLE LedgerBalances ADD COLUMN detailListBalance REAL;').catch(err => {
      console.log('detailListBalance column alteration status:', err.message);
    });
  }).then(() => {
    return sequelize.sync();
  }).then(() => {
    console.log('Database synced successfully (re-created Customers table).');
  }).catch(err => {
    console.error('Failed to sync database:', err);
  });
});
