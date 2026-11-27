const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

// GET /api/categories
router.get('/', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM Category ORDER BY category_name');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

// POST /api/categories
router.post('/', auth, async (req, res) => {
  const { category_name, description } = req.body;
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
  if (!String(category_name || '').trim() || String(category_name).trim().length > 100)
    return res.status(400).json({ error: 'category_name is required and must be at most 100 characters' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO Category (category_name, description) VALUES ($1,$2) RETURNING category_id',
      [String(category_name).trim(), description||null]
    );
    res.status(201).json({ message: 'Category added', category_id: rows[0].category_id });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
