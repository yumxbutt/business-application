const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentTransactionSplit = sequelize.define(
  'PaymentTransactionSplit',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    paymentTransactionId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'payment_transaction_id',
    },
    paymentAccountId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'payment_account_id',
    },
    accountHeadId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'account_head_id',
    },
    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    createdAt: { type: DataTypes.DATE, field: 'created_at' },
  },
  {
    tableName: 'payment_transaction_splits',
    timestamps: false,
    updatedAt: false,
  }
);

module.exports = { PaymentTransactionSplit };
