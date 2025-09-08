const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Transaction = sequelize.define('Transaction', {
  amount: { type: DataTypes.FLOAT, allowNull: false },
  type: { type: DataTypes.ENUM('income', 'expense'), allowNull: false },
  description: { type: DataTypes.STRING },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = Transaction;

