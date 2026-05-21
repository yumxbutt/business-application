const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentTransaction = sequelize.define(
  'PaymentTransaction',
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
      allowNull: false,
    },
    transactionType: {
      type: DataTypes.ENUM('receipt', 'payment'),
      field: 'transaction_type',
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    entryDate: {
      type: DataTypes.DATEONLY,
      field: 'entry_date',
      allowNull: false,
    },
    referenceNo: {
      type: DataTypes.STRING(50),
      field: 'reference_no',
    },
    description: {
      type: DataTypes.TEXT,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      field: 'payment_method',
    },
    createdById: {
      type: DataTypes.INTEGER,
      field: 'created_by',
    },
  },
  {
    tableName: 'payment_transactions',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { PaymentTransaction };
