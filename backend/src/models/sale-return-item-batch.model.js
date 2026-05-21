const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleReturnItemBatch = sequelize.define(
  'SaleReturnItemBatch',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleReturnItemId: {
      type: DataTypes.INTEGER,
      field: 'sale_return_item_id',
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
    tableName: 'sale_return_item_batches',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  }
);

module.exports = { SaleReturnItemBatch };

