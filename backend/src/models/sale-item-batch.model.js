const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleItemBatch = sequelize.define(
  'SaleItemBatch',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleItemId: {
      type: DataTypes.INTEGER,
      field: 'sale_item_id',
      allowNull: false,
    },
    inventoryBatchId: {
      type: DataTypes.INTEGER,
      field: 'inventory_batch_id',
      allowNull: false,
    },
    quantityAllocated: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'quantity_allocated',
      allowNull: false,
    },
  },
  {
    tableName: 'sale_item_batches',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { SaleItemBatch };

