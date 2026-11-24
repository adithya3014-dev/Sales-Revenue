
const mysql = require('mysql2/promise');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

const databaseName = process.env.DB_NAME || 'sales_revenue_dashboard';
const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(dbConfig.host);
let pool;

function quoteIdentifier(value) {
  return `\`${value.replace(/`/g, '``')}\``;
}

async function getConnectionOptions() {
  const options = { ...dbConfig };
  const caPath = process.env.DB_SSL_CA;

  if (!isLocalDatabase && !caPath) {
    throw new Error('DB_SSL_CA must point to the Aiven CA certificate for remote MySQL connections.');
  }

  if (caPath) {
    options.ssl = {
      ca: await fs.readFile(path.resolve(__dirname, '../../', caPath), 'utf8')
    };
  }

  return options;
}

async function initializeDatabase() {
  if (!/^[A-Za-z0-9_$-]+$/.test(databaseName)) {
    throw new Error('DB_NAME may only contain letters, numbers, underscores, and hyphens.');
  }

  const connectionOptions = await getConnectionOptions();

  if (isLocalDatabase) {
    const serverConnection = await mysql.createConnection(connectionOptions);
    try {
      await serverConnection.query(
        `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } finally {
      await serverConnection.end();
    }
  }

  pool = mysql.createPool({ ...connectionOptions, database: databaseName });

  try {
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    const statements = schema
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement && !/^CREATE DATABASE\b|^USE\b/i.test(statement));

    for (const statement of statements) {
      await pool.query(statement);
    }

    await pool.query('SELECT 1');
    return pool;
  } catch (error) {
    await pool.end();
    pool = undefined;
    throw error;
  }
}

function getDbConnection() {
  if (!pool) {
    throw new Error('Database has not been initialized.');
  }
  return pool;
}

module.exports = { dbConfig, databaseName, initializeDatabase, getDbConnection };
