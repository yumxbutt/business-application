const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductAttributeValue = sequelize.define(
  'ProductAttributeValue',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    attributeId: {
      type: DataTypes.INTEGER,
      field: 'attribute_id',
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      field: 'is_active',
      defaultValue: true,
    },
  },
  {
    tableName: 'product_attribute_values',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['attribute_id', 'code'] }],
  }
);

module.exports = { ProductAttributeValue };