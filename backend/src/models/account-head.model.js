const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountHead = sequelize.define(
  'AccountHead',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(30),
      unique: true,
    },
    type: {
      type: DataTypes.ENUM('cash', 'bank', 'expense', 'income', 'receivable', 'payable', 'asset', 'liability'),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      field: 'is_active',
      defaultValue: true,
    },
  },
  {
    tableName: 'account_heads',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = { AccountHead };
