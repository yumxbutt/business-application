require('dotenv').config();

const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

const dialect = process.env.DB_DIALECT || 'mysql';
const dbName = process.env.DB_NAME || 'business_management';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD ?? '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 3306);

const ensureMySqlDatabase = async () => {
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

const sequelize =
  dialect === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_STORAGE || 'database/dev.sqlite',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
      })
    : new Sequelize(
        dbName,
        dbUser,
        dbPassword,
        {
          host: dbHost,
          port: dbPort,
          dialect,
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
          logging: process.env.NODE_ENV === 'development' ? console.log : false,
        }
      );

const connectDB = async () => {
  try {
    if (dialect === 'mysql') {
      await ensureMySqlDatabase();
    }

    await sequelize.authenticate();
    console.log('Database connected successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to database:', error);
    return false;
  }
};

module.exports = { sequelize, connectDB };
