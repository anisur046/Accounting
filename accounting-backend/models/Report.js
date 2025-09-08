const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Report = sequelize.define('Report', {
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = Report;
