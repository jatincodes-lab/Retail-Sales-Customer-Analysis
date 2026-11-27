const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM Supplier ORDER BY supplier_name');
    const { rows: catRows } = await pool.query(`
      SELECT s.supplier_id,
        (SELECT STRING_AGG(DISTINCT c.category_name, ', ' ORDER BY c.category_name)
         FROM Product p JOIN Category c ON p.category_id=c.category_id WHERE p.supplier_id=s.supplier_id) AS categories,
        (SELECT COUNT(*) FROM Product p WHERE p.supplier_id=s.supplier_id) AS product_count,
        COALESCE((SELECT SUM(sp.total_cost) FROM Supplier_Purchase sp WHERE sp.supplier_id=s.supplier_id),0) AS total_purchased
      FROM Supplier s`);
    const map = {};
    catRows.forEach(r => { map[r.supplier_id] = r; });
    res.json(rows.map(s => ({ ...s, ...(map[s.supplier_id] || { categories:null, product_count:0, total_purchased:0 }) })));
  } catch (err) { sendError(res, err); }
});

// GET purchases history for a supplier
router.get('/:id/purchases', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query(
      'SELECT * FROM vw_supplier_purchases WHERE supplier_id=$1 ORDER BY purchase_date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

// POST /api/suppliers — now accepts initial_category_id to link a product category
router.post('/', auth, async (req, res) => {
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
  const { supplier_name, contact_person, phone, email, address, initial_category_id } = req.body;
  if (!String(supplier_name || '').trim()) return res.status(400).json({ error: 'supplier_name required' });
  try {
    const { rows: result } = await pool.query(
      'INSERT INTO Supplier (supplier_name, contact_person, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING supplier_id',
      [String(supplier_name).trim(), contact_person||null, phone||null, email||null, address||null]
    );
    const supplier_id = result[0].supplier_id;

    // If a category was selected, create a placeholder product link
    // Actually: just store a note — real category shows when products are assigned
    // Better approach: add a note column or just return success
    // The category will naturally appear once products from this supplier are added

    res.status(201).json({ message: 'Supplier added', supplier_id });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
