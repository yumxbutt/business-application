const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LedgerEntry = sequelize.define(
  'LedgerEntry',
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
    },
    accountHeadId: {
      type: DataTypes.INTEGER,
      field: 'account_head_id',
    },
    entryDate: {
      type: DataTypes.DATEONLY,
      field: 'entry_date',
      allowNull: false,
    },
    referenceType: {
      type: DataTypes.STRING(50),
      field: 'reference_type',
      allowNull: false,
    },
    referenceId: {
      type: DataTypes.INTEGER,
      field: 'reference_id',
    },
    referenceNo: {
      type: DataTypes.STRING(50),
      field: 'reference_no',
    },
    description: {
      type: DataTypes.TEXT,
    },
    debit: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0,
    },
    credit: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0,
    },
    createdById: {
      type: DataTypes.INTEGER,
      field: 'created_by',
    },
  },
  {
    tableName: 'ledger_entries',
    underscored: true,
    timestamps: false,
    createdAt: 'created_at',
  }
);

module.exports = { LedgerEntry };
