const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { rows: all } = await pool.query('SELECT * FROM Customer ORDER BY registration_date DESC');
    const { rows: spend } = await pool.query('SELECT * FROM vw_customer_spend ORDER BY total_spent DESC');
    const map = {};
    spend.forEach(s => { map[s.customer_id] = s; });
    const customers = all.map(c => ({ ...c, ...(map[c.customer_id] || { total_orders:0, total_spent:0 }) }));
    res.json(req.user.role === 'cashier' ? customers.map(({ email, phone, address, ...customer }) => customer) : customers);
  } catch (err) { sendError(res, err); }
});

router.get('/top', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows: rows } = await pool.query(`
      SELECT customer_name, total_spent, total_orders, last_purchase FROM vw_customer_spend
      WHERE total_spent > (SELECT AVG(total_amount) FROM Sale WHERE customer_id IS NOT NULL)
      ORDER BY total_spent DESC`);
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

// GET /api/customers/:id/history — all sales with items for a customer
router.get('/:id/history', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows: sales } = await pool.query(`
      SELECT s.sale_id, s.sale_date, s.total_amount,
             COUNT(si.sale_item_id) AS item_count
      FROM Sale s JOIN Sale_Item si ON s.sale_id=si.sale_id
      WHERE s.customer_id=$1
      GROUP BY s.sale_id ORDER BY s.sale_date DESC`, [req.params.id]);

    // Get items for each sale
    const result = await Promise.all(sales.map(async sale => {
      const { rows: items } = await pool.query(`
        SELECT si.quantity, si.unit_price, si.product_name_at_sale AS product_name, c.category_name
        FROM Sale_Item si
        JOIN Product p  ON si.product_id  = p.product_id
        JOIN Category c ON p.category_id  = c.category_id
        WHERE si.sale_id=$1`, [sale.sale_id]);
      return { ...sale, items };
    }));
    res.json(result);
  } catch (err) { sendError(res, err); }
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { first_name, last_name, email, phone, address } = req.body;
  const firstName = typeof first_name === 'string' ? first_name.trim() : '';
  const lastName = typeof last_name === 'string' ? last_name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80 ||
      (cleanEmail && (cleanEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) ||
      (cleanPhone && !/^\d{1,10}$/.test(cleanPhone)))
    return res.status(400).json({ error: 'Enter valid names, email, and a phone number of up to 10 digits' });
  try {
    const { rows: result } = await pool.query(
      'INSERT INTO Customer (first_name,last_name,email,phone,address) VALUES ($1,$2,$3,$4,$5) RETURNING customer_id',
      [firstName, lastName, cleanEmail||null, cleanPhone||null, address||null]
    );
    res.status(201).json({ message: 'Customer added', customer_id: result[0].customer_id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    sendError(res, err);
  }
});

// GET /api/customers/settings/discount — get global discount
router.get('/settings/discount', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query(
      "SELECT setting_value FROM Store_Settings WHERE setting_key='registered_customer_discount'"
    );
    res.json({ discount: rows.length ? Number(rows[0].setting_value) : 5 });
  } catch (err) { sendError(res, err); }
});

// PATCH /api/customers/settings/discount — update global discount
router.patch('/settings/discount', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { discount } = req.body;
  if (discount == null || !Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > 100)
    return res.status(400).json({ error: 'discount must be 0-100' });
  try {
    await pool.query(`
      INSERT INTO Store_Settings (setting_key, setting_value, updated_by)
      VALUES ('registered_customer_discount', $1, $2)
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value=EXCLUDED.setting_value, updated_by=EXCLUDED.updated_by`,
      [String(discount), req.user.username]
    );
    res.json({ message: 'Discount updated', discount });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
