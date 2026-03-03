// knexfile.js - Veritabanı Konfigürasyonu
// Silah Fabrikası ERP Sistemi
require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'erp_savunma',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './server/seeds',
    },
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 2, max: 20 },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './server/seeds',
    },
  },
};
