const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleItem = sequelize.define(
  'SaleItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleId: {
      type: DataTypes.INTEGER,
      field: 'sale_id',
      allowNull: false,
    },
    productId: {
      type: DataTypes.INTEGER,
      field: 'product_id',
    },
    sourceBranchId: {
      type: DataTypes.INTEGER,
      field: 'source_branch_id',
      allowNull: true,
    },
    unitId: {
      type: DataTypes.INTEGER,
      field: 'unit_id',
      allowNull: true,
      defaultValue: null,
    },
    unitQty: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'unit_qty',
      allowNull: true,
      defaultValue: null,
    },
    conversionFactor: {
      type: DataTypes.DECIMAL(14, 6),
      field: 'conversion_factor',
      allowNull: true,
      defaultValue: 1,
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'unit_price',
      allowNull: false,
    },
    lineAmount: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'line_amount',
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: 'sale_items',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { SaleItem };
