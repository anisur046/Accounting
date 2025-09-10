// models/index.js
const Sequelize = require('sequelize');

const sequelize = new Sequelize('accounting_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
});

const User = require('./User')(sequelize, Sequelize.DataTypes);
const Transaction = require('./Transaction')(sequelize, Sequelize.DataTypes);
const Report = require('./Report')(sequelize, Sequelize.DataTypes);
const Customer = require('./Customer')(sequelize, Sequelize.DataTypes);

module.exports = { sequelize, User, Transaction, Report, Customer };
