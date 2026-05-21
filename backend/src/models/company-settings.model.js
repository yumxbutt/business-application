const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanySettings = sequelize.define('CompanySettings', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  companyName: { type: DataTypes.STRING(200), field: 'company_name', allowNull: true },
  tagline: { type: DataTypes.STRING(300), field: 'tagline', allowNull: true },
  address: { type: DataTypes.TEXT, allowNull: true },
  phone: { type: DataTypes.STRING(50), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  logoUrl: { type: DataTypes.TEXT, field: 'logo_url', allowNull: true },
  footerNote: { type: DataTypes.TEXT, field: 'footer_note', allowNull: true },
  updatedById: { type: DataTypes.INTEGER, field: 'updated_by', allowNull: true },
}, { tableName: 'company_settings', underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = { CompanySettings };
