const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/db');
const app = express();
const origins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(value => value.trim()).filter(Boolean) : null;

app.use(cors({ origin: origins || (process.env.NODE_ENV === 'production' ? false : true) }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/budget', require('./routes/budget'));
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok', project: 'Retail Management System' });
  } catch (err) {
    console.error('Health check database error:', err.message);
    res.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  if (process.env.NODE_ENV === 'production' && !origins?.length)
    throw new Error('CORS_ORIGIN must list the production frontend origin(s)');
  await pool.query('SELECT 1');
  const port = Number(process.env.PORT || 5001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`Retail API listening on http://localhost:${port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0), err => {
      console.error('Error closing PostgreSQL pool:', err.message);
      process.exit(1);
    }));
    setTimeout(() => process.exit(1), 10000).unref();
  });
  return server;
}

if (require.main === module) {
  start().catch(err => {
    console.error('Retail API failed to start:', err.message);
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.start = start;
