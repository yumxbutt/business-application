const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Stores the manually-set opening balance for a branch's trading ledger register.
 * One record per branch (upserted on each update).
 */
const BranchOpeningBalance = sequelize.define(
  'BranchOpeningBalance',
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
      unique: true,
    },
    openingBalance: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'opening_balance',
      allowNull: false,
      defaultValue: 0,
    },
    openingDate: {
      type: DataTypes.DATEONLY,
      field: 'opening_date',
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    setById: {
      type: DataTypes.INTEGER,
      field: 'set_by',
      allowNull: true,
    },
  },
  {
    tableName: 'branch_opening_balances',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = { BranchOpeningBalance };
