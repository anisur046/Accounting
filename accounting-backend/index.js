const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize, User, Transaction, Report, Customer } = require('./models');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Syncing database in background...');
  sequelize.sync().then(() => {
    console.log('Database synced successfully.');
  }).catch(err => {
    console.error('Failed to sync database:', err);
  });
});
