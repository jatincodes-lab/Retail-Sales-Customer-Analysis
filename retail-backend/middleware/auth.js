const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async (req, res, next) => {
  const auth = req.headers.authorization;
  const cookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('retail_session='));
  const token = (auth?.startsWith('Bearer ') && auth.slice(7)) || cookie?.slice('retail_session='.length);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  try {
    const { rows } = await pool.query('SELECT active,role FROM app_user WHERE user_id=$1', [req.user.id]);
    if (!rows.length || !rows[0].active) return res.status(401).json({ error: 'Account is inactive' });
    req.user.role = rows[0].role;
    return next();
  } catch (err) { return next(err); }
};
