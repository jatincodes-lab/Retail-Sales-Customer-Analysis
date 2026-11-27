const BAD_REQUEST_CODES = new Set(['22P02', '22003', '22007', '22001', '23514']);

function sendError(res, err, fallback = 'Internal server error') {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'A record with these details already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'A referenced record does not exist or is still in use' });
  if (BAD_REQUEST_CODES.has(err.code)) return res.status(400).json({ error: 'Invalid request data' });
  console.error(err);
  return res.status(500).json({ error: fallback });
}

module.exports = sendError;
