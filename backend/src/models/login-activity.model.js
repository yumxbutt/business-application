const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LoginActivity = sequelize.define(
  'LoginActivity',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      field: 'user_id',
      allowNull: true,
    },
    usernameAttempted: {
      type: DataTypes.STRING(60),
      field: 'username_attempted',
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      field: 'ip_address',
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      field: 'user_agent',
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'login_activities',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = { LoginActivity };
