const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleReturn = sequelize.define(
  'SaleReturn',
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
    saleIdReference: {
      type: DataTypes.INTEGER,
      field: 'sale_id_reference',
    },
    contactId: {
      type: DataTypes.INTEGER,
      field: 'contact_id',
      allowNull: false,
    },
    returnDate: {
      type: DataTypes.DATEONLY,
      field: 'return_date',
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_amount',
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
    },
    createdById: {
      type: DataTypes.INTEGER,
      field: 'created_by',
    },
  },
  {
    tableName: 'sale_returns',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { SaleReturn };
