const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Purchase = sequelize.define(
  'Purchase',
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
    billNo: {
      type: DataTypes.STRING(50),
      field: 'bill_no',
      allowNull: false,
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      field: 'purchase_date',
      allowNull: false,
    },
    subTotal: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'sub_total',
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0,
    },
    additionalExpensesTotal: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'additional_expenses_total',
      defaultValue: 0,
    },
    additionalExpenses: {
      type: DataTypes.TEXT('long'),
      field: 'additional_expenses',
      allowNull: true,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_amount',
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'paid_amount',
      defaultValue: 0,
    },
    dueAmount: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'due_amount',
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'draft',
    },
    createdById: {
      type: DataTypes.INTEGER,
      field: 'created_by',
    },
  },
  {
    tableName: 'purchases',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['branch_id', 'bill_no'] }],
  }
);

module.exports = { Purchase };
