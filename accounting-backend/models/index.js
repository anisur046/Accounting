// models/index.js
const { Sequelize } = require('sequelize');

// Update these values for your SQL database
const sequelize = new Sequelize('accounting_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql', // or 'postgres', 'sqlite', etc.
});

module.exports = { sequelize };
