const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const sendError = require('../utils/errors');
const router = express.Router();
const positiveInteger = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;

router.get('/', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const { rows } = date
      ? await pool.query(`SELECT vs.*,vs.sale_date::date AS sale_day FROM vw_sales_summary vs
                          WHERE vs.sale_date >= $1::date AND vs.sale_date < $1::date + INTERVAL '1 day'
                          ORDER BY vs.sale_date DESC`, [date])
      : await pool.query('SELECT * FROM vw_sales_summary ORDER BY sale_date DESC');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

router.get('/daily', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_daily_sales ORDER BY sale_day DESC LIMIT 60');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

router.get('/:id', auth, async (req, res) => {
  if (!positiveInteger(req.params.id)) return res.status(400).json({ error: 'Invalid sale id' });
  try {
    const { rows: sales } = await pool.query(`
      SELECT s.*,COALESCE(c.first_name || ' ' || c.last_name,'Guest') AS customer_name,
             CASE WHEN s.customer_id IS NOT NULL THEN 1 ELSE 0 END AS is_registered
      FROM sale s LEFT JOIN customer c ON s.customer_id=c.customer_id WHERE s.sale_id=$1`, [req.params.id]);
    if (!sales.length) return res.status(404).json({ error: 'Sale not found' });
    const { rows: items } = await pool.query(`
      SELECT si.*,p.product_name FROM sale_item si JOIN product p ON si.product_id=p.product_id
      WHERE si.sale_id=$1 ORDER BY si.sale_item_id`, [req.params.id]);
    res.json({ ...sales[0], items });
  } catch (err) { sendError(res, err); }
});

router.post('/', auth, async (req, res) => {
  const { customer_id, items } = req.body;
  if (customer_id != null && !positiveInteger(customer_id)) return res.status(400).json({ error: 'Invalid customer id' });
  if (!Array.isArray(items) || items.length === 0 || items.length > 100)
    return res.status(400).json({ error: 'items must contain between 1 and 100 entries' });

  const quantities = new Map();
  for (const item of items) {
    if (!item || !positiveInteger(item.product_id) || !positiveInteger(item.quantity))
      return res.status(400).json({ error: 'Each item needs a valid product_id and positive integer quantity' });
    const total = (quantities.get(Number(item.product_id)) || 0) + Number(item.quantity);
    if (!Number.isSafeInteger(total) || total > 2147483647)
      return res.status(400).json({ error: 'Combined item quantity is too large' });
    quantities.set(Number(item.product_id), total);
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: settings } = await client.query(
      "SELECT setting_value FROM store_settings WHERE setting_key='registered_customer_discount'");
    const baseDiscount = settings.length ? Number(settings[0].setting_value) : 5;
    if (!Number.isFinite(baseDiscount) || baseDiscount < 0 || baseDiscount > 100)
      throw new Error('The registered customer discount setting is invalid');

    const { rows: sales } = await client.query(
      'INSERT INTO sale(customer_id) VALUES($1) RETURNING sale_id', [customer_id || null]);
    const saleId = sales[0].sale_id;
    const registered = customer_id != null;

    // Stable lock order reduces deadlocks; the conditional update prevents overselling under concurrency.
    for (const [productId, quantity] of [...quantities].sort((a, b) => a[0] - b[0])) {
      const { rows: products } = await client.query(
        'SELECT unit_price,discount_all,discount_registered FROM product WHERE product_id=$1 FOR KEY SHARE', [productId]);
      if (!products.length) {
        const error = new Error(`Product ${productId} not found`); error.status = 404; throw error;
      }
      const { rowCount } = await client.query(
        `UPDATE inventory SET quantity_in_stock=quantity_in_stock-$1
         WHERE product_id=$2 AND quantity_in_stock >= $1 RETURNING product_id`, [quantity, productId]);
      if (!rowCount) {
        const error = new Error(`Insufficient stock for product ${productId}`); error.status = 409; throw error;
      }
      await client.query(`
        INSERT INTO sale_item(sale_id,product_id,quantity,unit_price)
        SELECT $1,$2,$3,ROUND(unit_price * (1 - LEAST(
          discount_all / 100 + CASE WHEN $4 THEN discount_registered / 100 + $5::numeric / 100 ELSE 0 END,
          0.9)),2)
        FROM product WHERE product_id=$2`,
      [saleId, productId, quantity, registered, baseDiscount]);
    }

    const { rows: totals } = await client.query(`
      UPDATE sale SET total_amount=(SELECT COALESCE(SUM(quantity*unit_price),0) FROM sale_item WHERE sale_id=$1)
      WHERE sale_id=$1 RETURNING total_amount`, [saleId]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Sale created', sale_id: saleId, total: totals[0].total_amount });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error(rollbackError); }
    sendError(res, err);
  } finally { if (client) client.release(); }
});

module.exports = router;
