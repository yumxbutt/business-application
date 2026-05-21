const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductBranchSetting = sequelize.define(
  'ProductBranchSetting',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      field: 'product_id',
      allowNull: false,
    },
    branchId: {
      type: DataTypes.INTEGER,
      field: 'branch_id',
      allowNull: false,
    },
    salePrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'sale_price',
      allowNull: true,
    },
    reorderLevel: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'reorder_level',
      allowNull: true,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      field: 'is_available',
      defaultValue: true,
    },
  },
  {
    tableName: 'product_branch_settings',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['product_id', 'branch_id'] }],
  }
);

module.exports = { ProductBranchSetting };