const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
    glCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    glHead: { type: DataTypes.STRING, allowNull: false },
    openingBalance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    credit: { type: DataTypes.DOUBLE, defaultValue: 0 },
    debit: { type: DataTypes.DOUBLE, defaultValue: 0 },
    closingBalance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    detailListBalance: { type: DataTypes.DOUBLE, defaultValue: 0 }
  });
  return Customer;
};
