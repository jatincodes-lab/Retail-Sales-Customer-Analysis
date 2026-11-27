const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM Category ORDER BY category_name');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

// POST /api/categories
router.post('/', auth, async (req, res) => {
  const { category_name, description } = req.body;
  if (!category_name) return res.status(400).json({ error: 'category_name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO Category (category_name, description) VALUES ($1,$2) RETURNING category_id',
      [category_name, description||null]
    );
    res.status(201).json({ message: 'Category added', category_id: rows[0].category_id });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
