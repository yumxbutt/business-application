const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentAccount = sequelize.define(
  'PaymentAccount',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    branchId: { type: DataTypes.BIGINT, allowNull: true, field: 'branch_id' },
    accountType: {
      type: DataTypes.ENUM('cash', 'bank'),
      allowNull: false,
      defaultValue: 'cash',
      field: 'account_type',
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    bankName: { type: DataTypes.STRING(150), allowNull: true, field: 'bank_name' },
    accountNumber: { type: DataTypes.STRING(100), allowNull: true, field: 'account_number' },
    bankBranchName: { type: DataTypes.STRING(150), allowNull: true, field: 'bank_branch_name' },
    openingBalance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'opening_balance',
    },
    openingDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'opening_date' },
    accountHeadId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'account_head_id',
      comment: 'Maps to cash (AST-001) or bank (AST-002) account head',
    },
    isActive: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
      field: 'is_active',
    },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    createdAt: { type: DataTypes.DATE, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
  },
  {
    tableName: 'payment_accounts',
    timestamps: true,
    underscored: false,
  }
);

module.exports = { PaymentAccount };
