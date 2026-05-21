const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryBalance = sequelize.define(
  'InventoryBalance',
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
    // Stored in base unit quantity
    quantity: {
      type: DataTypes.DECIMAL(14, 4),
      defaultValue: 0,
      allowNull: false,
    },
  },
  {
    tableName: 'inventory_balances',
    underscored: true,
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['branch_id', 'product_id'] }],
  }
);

module.exports = { InventoryBalance };
