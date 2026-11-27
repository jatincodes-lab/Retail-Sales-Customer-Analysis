const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  const cookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('retail_session='));
  const token = (auth?.startsWith('Bearer ') && auth.slice(7)) || cookie?.slice('retail_session='.length);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};
