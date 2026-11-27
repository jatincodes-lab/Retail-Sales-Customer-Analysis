require('dotenv').config();
const fs = require('node:fs');
const { Pool } = require('pg');

const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'retail_app',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'retail_db',
      }),
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  ...(process.env.DB_SSL === 'true' ? {
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DB_SSL_CA ? { ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') } : {}),
    },
  } : {}),
});

pool.on('error', err => console.error('Unexpected idle PostgreSQL client error:', err));

module.exports = pool;
