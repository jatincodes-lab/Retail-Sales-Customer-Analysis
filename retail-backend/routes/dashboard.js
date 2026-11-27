const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows: [products] } = await pool.query('SELECT COUNT(*) AS count FROM Product');
    const { rows: [customers] } = await pool.query('SELECT COUNT(*) AS count FROM Customer');
    const { rows: [sales] } = await pool.query('SELECT COUNT(*) AS count FROM Sale');
    const { rows: [revenue] } = await pool.query('SELECT COALESCE(SUM(total_amount),0) AS total FROM Sale');
    const { rows: [suppliers] } = await pool.query('SELECT COUNT(*) AS count FROM Supplier');
    const { rows: lowStock } = await pool.query(`
      SELECT p.product_id,p.product_name,i.quantity_in_stock,p.reorder_level,s.supplier_name,s.phone AS supplier_phone
      FROM Product p JOIN Inventory i ON p.product_id=i.product_id
      JOIN Supplier s ON p.supplier_id=s.supplier_id
      WHERE i.quantity_in_stock<=p.reorder_level ORDER BY i.quantity_in_stock ASC`);
    const { rows: [profit] } = await pool.query('SELECT * FROM vw_profit_summary');
    const { rows: [budget] } = await pool.query('SELECT * FROM vw_budget_balance');
    const { rows: topCustomers } = await pool.query('SELECT * FROM vw_customer_spend ORDER BY total_spent DESC LIMIT 5');
    const { rows: salesSummary } = await pool.query('SELECT * FROM vw_sales_summary ORDER BY sale_date DESC LIMIT 10');
    const { rows: catRevenue } = await pool.query(`
      SELECT c.category_name,SUM(si.quantity*si.unit_price) AS revenue
      FROM Sale_Item si JOIN Product p ON si.product_id=p.product_id
      JOIN Category c ON p.category_id=c.category_id GROUP BY c.category_name ORDER BY revenue DESC`);
    const { rows: topProducts } = await pool.query(`
      SELECT p.product_name,SUM(si.quantity) AS total_sold,SUM(si.quantity*si.unit_price) AS revenue
      FROM Sale_Item si JOIN Product p ON si.product_id=p.product_id
      GROUP BY p.product_name ORDER BY total_sold DESC LIMIT 5`);
    const [{ rows: salesTrend }, { rows: recentActivity }] = await Promise.all([
      pool.query(`
        SELECT s.sale_id,s.sale_date,COALESCE(SUM(si.quantity*si.unit_price),0) AS revenue,
               COALESCE(SUM(si.quantity*(si.unit_price-p.cost_price)),0) AS gross_profit
        FROM Sale s
        LEFT JOIN Sale_Item si ON si.sale_id=s.sale_id
        LEFT JOIN Product p ON p.product_id=si.product_id
        GROUP BY s.sale_id,s.sale_date ORDER BY s.sale_date DESC,s.sale_id DESC LIMIT 12`),
      pool.query(`
        SELECT * FROM (
          SELECT 'sale'::text AS activity_type,s.sale_id::text AS activity_id,s.sale_date AS activity_date,
                 COALESCE(c.first_name || ' ' || c.last_name,'Guest') AS customer_name,
                 s.total_amount AS amount,COUNT(si.sale_item_id)::integer AS total_items
          FROM Sale s LEFT JOIN Customer c ON c.customer_id=s.customer_id
          LEFT JOIN Sale_Item si ON si.sale_id=s.sale_id
          GROUP BY s.sale_id,s.sale_date,c.first_name,c.last_name,s.total_amount
          UNION ALL
          SELECT 'customer'::text,c.customer_id::text,c.registration_date::timestamp,
                 c.first_name || ' ' || c.last_name,NULL::numeric,0::integer
          FROM Customer c
        ) activity
        ORDER BY activity_date DESC,activity_type,activity_id DESC LIMIT 5`),
    ]);
    res.json({ counts:{ products:products.count,customers:customers.count,sales:sales.count,
      suppliers:suppliers.count,total_revenue:Number(revenue.total),low_stock:lowStock.length },
      profit, budget, lowStock, topCustomers, salesSummary, catRevenue, topProducts,
      salesTrend, recentActivity,
      timestamp:new Date().toISOString() });
  } catch (err) { sendError(res, err); }
});

router.get('/manager', auth, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Manager only' });
  try {
    const { rows: lowStock } = await pool.query(`
      SELECT p.product_id,p.product_name,i.quantity_in_stock,p.reorder_level,s.supplier_name,s.phone AS supplier_phone
      FROM Product p JOIN Inventory i ON p.product_id=i.product_id
      JOIN Supplier s ON p.supplier_id=s.supplier_id
      WHERE i.quantity_in_stock<=p.reorder_level ORDER BY i.quantity_in_stock ASC`);
    const { rows: currentDuties } = await pool.query(`
      SELECT e.employee_id,CONCAT(e.first_name,' ',e.last_name) AS employee_name,
             e.role,d.duty_name,d.department,da.shift,da.notes,
             CONCAT(m.first_name,' ',m.last_name) AS assigned_by_name
      FROM Employee e
      LEFT JOIN Duty_Assignment da ON e.employee_id=da.employee_id AND da.status='active'
      LEFT JOIN Duty d ON da.duty_id=d.duty_id
      LEFT JOIN Employee m ON da.assigned_by=m.employee_id
      WHERE e.status='active' ORDER BY e.role,e.first_name`);
    const { rows: [empCount] } = await pool.query("SELECT COUNT(*) AS count FROM Employee WHERE status='active'");
    const { rows: [assigned] } = await pool.query("SELECT COUNT(*) AS count FROM Duty_Assignment WHERE status='active'");
    const { rows: [unassigned] } = await pool.query(`
      SELECT COUNT(*) AS count FROM Employee e WHERE e.status='active'
      AND NOT EXISTS (SELECT 1 FROM Duty_Assignment da WHERE da.employee_id=e.employee_id AND da.status='active')`);
    res.json({ lowStock,currentDuties,
      counts:{ active_employees:empCount.count,assigned:assigned.count,unassigned:unassigned.count,low_stock:lowStock.length } });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
