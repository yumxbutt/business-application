const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Expense = sequelize.define(
  'Expense',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    branchId: {
      type: DataTypes.INTEGER,
      field: 'branch_id',
      allowNull: false,
    },
    contactId: {
      type: DataTypes.INTEGER,
      field: 'contact_id',
    },
    expenseDate: {
      type: DataTypes.DATEONLY,
      field: 'expense_date',
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    accountHeadId: {
      type: DataTypes.INTEGER,
      field: 'account_head_id',
    },
    category: {
      type: DataTypes.STRING(100),
    },
    description: {
      type: DataTypes.TEXT,
    },
    receiptNo: {
      type: DataTypes.STRING(50),
      field: 'receipt_no',
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'posted',
    },
    createdById: {
      type: DataTypes.INTEGER,
      field: 'created_by',
    },
  },
  {
    tableName: 'expenses',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { Expense };
