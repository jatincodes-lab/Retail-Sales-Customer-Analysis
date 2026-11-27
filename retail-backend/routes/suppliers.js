const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

router.get('/', auth, async (req, res) => {
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
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
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
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
  const { supplier_name, contact_person, phone, email, address } = req.body;
  const name = typeof supplier_name === 'string' ? supplier_name.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!name || name.length > 150 || (cleanPhone && !/^\d{1,10}$/.test(cleanPhone)) ||
      (cleanEmail && (cleanEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) ||
      (contact_person && String(contact_person).trim().length > 100))
    return res.status(400).json({ error: 'Enter valid supplier details; phone must be up to 10 digits' });
  try {
    const { rows: result } = await pool.query(
      'INSERT INTO Supplier (supplier_name, contact_person, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING supplier_id',
      [name, contact_person ? String(contact_person).trim() : null, cleanPhone||null, cleanEmail||null, address||null]
    );
    const supplier_id = result[0].supplier_id;

    res.status(201).json({ message: 'Supplier added', supplier_id });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
