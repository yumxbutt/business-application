const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockTransferItem = sequelize.define(
  'StockTransferItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    stockTransferId: {
      type: DataTypes.INTEGER,
      field: 'stock_transfer_id',
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
    unitCost: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'unit_cost',
      allowNull: false,
      defaultValue: 0,
    },
    destinationBatchId: {
      type: DataTypes.INTEGER,
      field: 'destination_batch_id',
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'stock_transfer_items',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { StockTransferItem };
