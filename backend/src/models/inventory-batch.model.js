const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryBatch = sequelize.define(
  'InventoryBatch',
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
    productId: {
      type: DataTypes.INTEGER,
      field: 'product_id',
      allowNull: false,
    },
    purchaseId: {
      type: DataTypes.INTEGER,
      field: 'purchase_id',
      allowNull: false,
    },
    purchaseItemId: {
      type: DataTypes.INTEGER,
      field: 'purchase_item_id',
      allowNull: false,
    },
    receivedDate: {
      type: DataTypes.DATEONLY,
      field: 'received_date',
      allowNull: false,
    },
    quantityReceived: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'quantity_received',
      allowNull: false,
    },
    quantityRemaining: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'quantity_remaining',
      allowNull: false,
    },
    costPrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'cost_price',
      allowNull: false,
    },
    salePrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'sale_price',
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
  },
  {
    tableName: 'inventory_batches',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = { InventoryBatch };
