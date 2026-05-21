const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseItem = sequelize.define(
  'PurchaseItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    purchaseId: {
      type: DataTypes.INTEGER,
      field: 'purchase_id',
      allowNull: false,
    },
    productId: {
      type: DataTypes.INTEGER,
      field: 'product_id',
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
    salePrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'sale_price',
      allowNull: true,
      defaultValue: null,
    },
    batchId: {
      type: DataTypes.INTEGER,
      field: 'batch_id',
      allowNull: true,
      defaultValue: null,
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
    baseQty: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'base_qty',
      allowNull: true,
      defaultValue: null,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: 'purchase_items',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { PurchaseItem };
