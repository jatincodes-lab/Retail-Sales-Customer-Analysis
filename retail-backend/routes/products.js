const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const sendError = require('../utils/errors');
const router = express.Router();

const positiveInteger = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const nonNegativeNumber = value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_product_details ORDER BY product_name');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

router.get('/low-stock', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_low_stock ORDER BY quantity_in_stock ASC');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

router.get('/:id', async (req, res) => {
  if (!positiveInteger(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
  try {
    const { rows } = await pool.query('SELECT * FROM vw_product_details WHERE product_id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { sendError(res, err); }
});

router.post('/', auth, async (req, res) => {
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
  const { category_id, supplier_id, product_name, description, unit_price, cost_price = 0, reorder_level = 10 } = req.body;
  if (!positiveInteger(category_id) || !positiveInteger(supplier_id) || !String(product_name || '').trim() ||
      !nonNegativeNumber(unit_price) || Number(unit_price) === 0 || !nonNegativeNumber(cost_price) ||
      !Number.isSafeInteger(Number(reorder_level)) || Number(reorder_level) < 0) {
    return res.status(400).json({ error: 'Invalid product data' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO product (category_id,supplier_id,product_name,description,unit_price,cost_price,reorder_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING product_id`,
      [category_id, supplier_id, String(product_name).trim(), description || null, unit_price, cost_price, reorder_level]
    );
    const productId = rows[0].product_id;
    await client.query('INSERT INTO inventory (product_id,quantity_in_stock) VALUES ($1,0)', [productId]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Product added', product_id: productId });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error(rollbackError); }
    sendError(res, err);
  } finally { if (client) client.release(); }
});

router.patch('/:id', auth, async (req, res) => {
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
  if (!positiveInteger(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
  const { product_name, unit_price, cost_price, description, reorder_level, category_id, supplier_id, discount_all, discount_registered } = req.body;
  if (product_name != null && !String(product_name).trim()) return res.status(400).json({ error: 'Product name cannot be empty' });
  if (unit_price != null && (!nonNegativeNumber(unit_price) || Number(unit_price) === 0)) return res.status(400).json({ error: 'Invalid unit price' });
  if (cost_price != null && !nonNegativeNumber(cost_price)) return res.status(400).json({ error: 'Invalid cost price' });
  if (reorder_level != null && (!Number.isSafeInteger(Number(reorder_level)) || Number(reorder_level) < 0)) return res.status(400).json({ error: 'Invalid reorder level' });
  if (category_id != null && !positiveInteger(category_id)) return res.status(400).json({ error: 'Invalid category id' });
  if (supplier_id != null && !positiveInteger(supplier_id)) return res.status(400).json({ error: 'Invalid supplier id' });
  for (const value of [discount_all, discount_registered])
    if (value != null && (!nonNegativeNumber(value) || Number(value) > 100)) return res.status(400).json({ error: 'Discount must be between 0 and 100' });

  try {
    const { rowCount } = await pool.query(`
      UPDATE product SET product_name=COALESCE($1,product_name), unit_price=COALESCE($2,unit_price),
        cost_price=COALESCE($3,cost_price), description=COALESCE($4,description),
        reorder_level=COALESCE($5,reorder_level), category_id=COALESCE($6,category_id),
        supplier_id=COALESCE($7,supplier_id), discount_all=COALESCE($8,discount_all),
        discount_registered=COALESCE($9,discount_registered)
      WHERE product_id=$10`,
      [product_name == null ? null : String(product_name).trim(), unit_price ?? null, cost_price ?? null,
       description ?? null, reorder_level ?? null, category_id ?? null, supplier_id ?? null,
       discount_all ?? null, discount_registered ?? null, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated' });
  } catch (err) { sendError(res, err); }
});

router.patch('/:id/restock', auth, async (req, res) => {
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
  if (!positiveInteger(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
  const { quantity, supplier_id, unit_cost, notes } = req.body;
  if (!positiveInteger(quantity)) return res.status(400).json({ error: 'quantity must be a positive integer' });
  if (supplier_id != null && !positiveInteger(supplier_id)) return res.status(400).json({ error: 'Invalid supplier id' });
  if (unit_cost != null && !nonNegativeNumber(unit_cost)) return res.status(400).json({ error: 'Invalid unit cost' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: products } = await client.query('SELECT * FROM product WHERE product_id=$1 FOR UPDATE', [req.params.id]);
    if (!products.length) {
      const error = new Error('Product not found'); error.status = 404; throw error;
    }
    const product = products[0];
    const supplierId = supplier_id ?? product.supplier_id;
    const cost = unit_cost ?? product.cost_price;
    const { rows: purchases } = await client.query(
      `INSERT INTO supplier_purchase (supplier_id,product_id,quantity,unit_cost,total_cost,purchased_by,notes)
       VALUES ($1,$2,$3,$4,($3::integer::numeric * $4::numeric),$5,$6) RETURNING purchase_id,total_cost`,
      [supplierId, req.params.id, quantity, cost, req.user.username, notes || null]
    );
    await client.query('UPDATE product SET supplier_id=$1 WHERE product_id=$2', [supplierId, req.params.id]);
    await client.query(
      `INSERT INTO store_budget (amount,type,description,reference_id,created_by)
       VALUES (-$1::numeric,'purchase',$2,$3,$4)`,
      [purchases[0].total_cost, `Restock: ${product.product_name} x${quantity} from supplier`, purchases[0].purchase_id, req.user.username]
    );
    await client.query('SELECT sp_restock_product($1,$2)', [req.params.id, quantity]);
    await client.query('COMMIT');
    res.json({ message: `Restocked ${quantity} units. Budget deducted: Rs. ${purchases[0].total_cost}` });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error(rollbackError); }
    sendError(res, err);
  } finally { if (client) client.release(); }
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (!positiveInteger(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
  try {
    const { rowCount } = await pool.query('DELETE FROM product WHERE product_id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
