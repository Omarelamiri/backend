require('dotenv').config();

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.POSTGRES_DB,       // Changed from DB_NAME
  process.env.POSTGRES_USER,     // Changed from DB_USER
  process.env.POSTGRES_PASSWORD, // Changed from DB_PASSWORD
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
  }
);

module.exports = sequelize;