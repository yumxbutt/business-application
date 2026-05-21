const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductVariant = sequelize.define(
  'ProductVariant',
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
    sku: {
      type: DataTypes.STRING(80),
      allowNull: true,
      unique: true,
    },
    barcode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    attributeValueIds: {
      type: DataTypes.JSON,
      field: 'attribute_value_ids',
      defaultValue: [],
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'purchase_price',
      defaultValue: 0,
    },
    salePrice: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'sale_price',
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      field: 'is_active',
      defaultValue: true,
    },
  },
  {
    tableName: 'product_variants',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = { ProductVariant };