const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

// GET /api/budget — current balance + history
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows: [balance] } = await pool.query('SELECT * FROM vw_budget_balance');
    const { rows: history } = await pool.query(
      'SELECT * FROM Store_Budget ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ balance, history });
  } catch (err) { sendError(res, err); }
});

// POST /api/budget/deposit — add funds to budget
router.post('/deposit', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { amount, description } = req.body;
  if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0)
    return res.status(400).json({ error: 'amount must be > 0' });
  try {
    await pool.query(
      'INSERT INTO Store_Budget (amount, type, description, created_by) VALUES ($1,$2,$3,$4)',
      [amount, 'deposit', description || 'Budget deposit', req.user.username]
    );
    res.json({ message: 'Budget updated' });
  } catch (err) { sendError(res, err); }
});

// GET /api/budget/profit — profit summary
router.get('/profit', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows: [profit] } = await pool.query('SELECT * FROM vw_profit_summary');
    const { rows: [budget] } = await pool.query('SELECT * FROM vw_budget_balance');
    const { rows: topProfit } = await pool.query(`
      SELECT si.product_name_at_sale AS product_name,
             SUM(si.quantity) AS units_sold,
             SUM(si.quantity * si.unit_price) AS revenue,
             SUM(si.quantity * si.unit_cost_at_sale) AS cost,
             SUM(si.quantity * (si.unit_price - si.unit_cost_at_sale)) AS profit
      FROM Sale_Item si
      GROUP BY si.product_id,si.product_name_at_sale ORDER BY profit DESC LIMIT 10
    `);
    res.json({ profit, budget, topProfit });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
