require('dotenv').config();

const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

const dialect = process.env.DB_DIALECT || 'mysql';
const isMySql = dialect === 'mysql';
const dbName = process.env.DB_NAME || 'business_management';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD ?? '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 3306);

const ensureMySqlDatabase = async () => {
  if (!isMySql) {
    return;
  }

  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
};

const logging = process.env.NODE_ENV === 'development' ? console.log : false;

const createSequelize = () => {
  if (dialect === 'sqlite') {
    return new Sequelize({
      dialect: 'sqlite',
      storage: process.env.DB_STORAGE || 'database/dev.sqlite',
      logging,
    });
  }

  return new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging,
  });
};

const sequelize = createSequelize();

const connectDB = async () => {
  try {
    if (isMySql) {
      await ensureMySqlDatabase();
    }

    await sequelize.authenticate();
    console.log(`Database connected successfully (${dialect}).`);
    return true;
  } catch (error) {
    console.error(`Unable to connect to ${dialect} database at ${dbHost}:${dbPort}/${dbName}:`, error);
    return false;
  }
};

module.exports = { sequelize, connectDB };
