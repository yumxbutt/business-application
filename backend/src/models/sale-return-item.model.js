const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleReturnItem = sequelize.define(
  'SaleReturnItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleReturnId: {
      type: DataTypes.INTEGER,
      field: 'sale_return_id',
      allowNull: false,
    },
    saleItemId: {
      type: DataTypes.INTEGER,
      field: 'sale_item_id',
      allowNull: false,
    },
    productId: {
      type: DataTypes.INTEGER,
      field: 'product_id',
      allowNull: false,
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
    tableName: 'sale_return_items',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { SaleReturnItem };