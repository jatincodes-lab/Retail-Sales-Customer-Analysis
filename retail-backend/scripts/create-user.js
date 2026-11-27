require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function main() {
  const username = process.env.APP_USERNAME?.trim();
  const password = process.env.APP_PASSWORD;
  const role = process.env.APP_ROLE;
  if (!username || username.length > 80 || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72 ||
      !['admin', 'manager', 'cashier'].includes(role)) {
    throw new Error('Set APP_USERNAME (max 80 chars), APP_PASSWORD (at least 12 chars), and APP_ROLE (admin, manager, or cashier)');
  }
  const hash = await bcrypt.hash(password, 12);
  await pool.query('INSERT INTO app_user(username,password_hash,role) VALUES($1,$2,$3)', [username, hash, role]);
  console.log(`Created ${role} user ${username}`);
}

main().catch(err => {
  console.error('Could not create user:', err.code === '23505' ? 'username already exists' : err.message);
  process.exitCode = 1;
}).finally(() => pool.end());
