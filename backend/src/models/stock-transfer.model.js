const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockTransfer = sequelize.define(
  'StockTransfer',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fromBranchId: {
      type: DataTypes.INTEGER,
      field: 'from_branch_id',
      allowNull: false,
    },
    toBranchId: {
      type: DataTypes.INTEGER,
      field: 'to_branch_id',
      allowNull: false,
    },
    transferDate: {
      type: DataTypes.DATEONLY,
      field: 'transfer_date',
      allowNull: false,
    },
    transferNo: {
      type: DataTypes.STRING(50),
      field: 'transfer_no',
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'posted',
    },
    createdById: {
      type: DataTypes.INTEGER,
      field: 'created_by',
    },
  },
  {
    tableName: 'stock_transfers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['transfer_no'] }],
  }
);

module.exports = { StockTransfer };
