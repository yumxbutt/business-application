const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      field: 'category_id',
      allowNull: true,
    },
    typeId: {
      type: DataTypes.INTEGER,
      field: 'type_id',
      allowNull: true,
    },
    defaultUnitId: {
      type: DataTypes.INTEGER,
      field: 'default_unit_id',
      allowNull: true,
    },
    sku: {
      type: DataTypes.STRING(60),
      allowNull: true,
      unique: true,
    },
    barcode: {
      type: DataTypes.STRING(80),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: 'products',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = { Product };