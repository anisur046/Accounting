const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const LedgerBalance = sequelize.define('LedgerBalance', {
    companyName: { type: DataTypes.STRING, allowNull: false },
    period: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    head: { type: DataTypes.STRING, allowNull: false },
    openingBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalCredit: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalDebit: { type: DataTypes.FLOAT, defaultValue: 0 },
    endingBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
    detailListBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
    type: { type: DataTypes.STRING, allowNull: false }
  });
  return LedgerBalance;
};
