// models/index.js
const Sequelize = require('sequelize');

const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false,
});

const User = require('./User')(sequelize, Sequelize.DataTypes);
const Transaction = require('./Transaction')(sequelize, Sequelize.DataTypes);
const Report = require('./Report')(sequelize, Sequelize.DataTypes);
const Customer = require('./Customer')(sequelize, Sequelize.DataTypes);
const LedgerBalance = require('./LedgerBalance')(sequelize, Sequelize.DataTypes);

module.exports = { sequelize, User, Transaction, Report, Customer, LedgerBalance };

