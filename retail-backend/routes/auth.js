const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const sendError = require('../utils/errors');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 80 ||
      typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72)
    return res.status(400).json({ error: 'username and password are required' });
  try {
    const { rows } = await pool.query(
      'SELECT user_id,username,password_hash,role FROM app_user WHERE username=$1 AND active=true',
      [username.trim()]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const token = jwt.sign(
      { id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.user_id, username: user.username, role: user.role } });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
