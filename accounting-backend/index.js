const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Report = require('./models/Report');

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
  const user = await User.create(req.body);
  res.json(user);
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

const PORT = process.env.PORT || 3001;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
