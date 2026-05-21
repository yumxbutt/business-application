const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContactBalance = sequelize.define(
  'ContactBalance',
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
    contactId: {
      type: DataTypes.INTEGER,
      field: 'contact_id',
      allowNull: false,
      unique: true,
    },
    receivableBalance: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'receivable_balance',
      allowNull: false,
      defaultValue: 0,
    },
    payableBalance: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'payable_balance',
      allowNull: false,
      defaultValue: 0,
    },
    netBalance: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'net_balance',
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'contact_balances',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['contact_id'] }],
  }
);

module.exports = { ContactBalance };