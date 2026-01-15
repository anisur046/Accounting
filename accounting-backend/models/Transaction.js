const Transaction = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    amount: { type: DataTypes.FLOAT, allowNull: false },
    type: { type: DataTypes.ENUM('income', 'expense'), allowNull: false },
    description: { type: DataTypes.STRING },
    customerName: { type: DataTypes.STRING },
    customerEmail: { type: DataTypes.STRING },
    customerPhone: { type: DataTypes.STRING },
    customerAddress: { type: DataTypes.STRING },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });
  return Transaction;
};

module.exports = Transaction;
