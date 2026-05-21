const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductUnit = sequelize.define(
  'ProductUnit',
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
    unitId: {
      type: DataTypes.INTEGER,
      field: 'unit_id',
      allowNull: false,
    },
    conversionFactor: {
      type: DataTypes.DECIMAL(14, 4),
      field: 'conversion_factor',
      allowNull: false,
      defaultValue: 1,
    },
    isBaseUnit: {
      type: DataTypes.BOOLEAN,
      field: 'is_base_unit',
      defaultValue: false,
    },
    isPurchaseUnit: {
      type: DataTypes.BOOLEAN,
      field: 'is_purchase_unit',
      defaultValue: false,
    },
    isSaleUnit: {
      type: DataTypes.BOOLEAN,
      field: 'is_sale_unit',
      defaultValue: false,
    },
  },
  {
    tableName: 'product_units',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = { ProductUnit };