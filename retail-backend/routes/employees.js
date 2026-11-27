const express = require('express');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const sendError = require('../utils/errors');
const router  = express.Router();

// GET /api/employees
router.get('/', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query(`
      SELECT e.*,
             CONCAT(e.first_name,' ',e.last_name) AS full_name,
             d.duty_name, d.department,
             da.shift, da.assigned_date, da.status AS duty_status,
             CONCAT(m.first_name,' ',m.last_name) AS manager_name
      FROM Employee e
      LEFT JOIN Duty_Assignment da ON e.employee_id = da.employee_id AND da.status = 'active'
      LEFT JOIN Duty d    ON da.duty_id    = d.duty_id
      LEFT JOIN Employee m ON da.assigned_by = m.employee_id
      ORDER BY e.role, e.first_name
    `);

    // Check which employees were paid this month
    const currentMonth = new Date().toLocaleString('en-US', { month:'long', year:'numeric' });
    const { rows: paidThisMonth } = await pool.query(`
      SELECT DISTINCT employee_id FROM Salary_Payment
      WHERE month_year = $1`, [currentMonth]);
    const paidSet = new Set(paidThisMonth.map(r => r.employee_id));

    res.json(rows.map(e => ({ ...e, paid_this_month: paidSet.has(e.employee_id) })));
  } catch (err) { sendError(res, err); }
});

// GET /api/employees/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM Employee WHERE employee_id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    const { rows: payments } = await pool.query(
      'SELECT * FROM Salary_Payment WHERE employee_id = $1 ORDER BY payment_date DESC', [req.params.id]);
    const { rows: duties } = await pool.query(`
      SELECT da.*, d.duty_name, d.department, CONCAT(m.first_name,' ',m.last_name) AS assigned_by_name
      FROM Duty_Assignment da
      JOIN Duty d ON da.duty_id = d.duty_id
      JOIN Employee m ON da.assigned_by = m.employee_id
      WHERE da.employee_id = $1 ORDER BY da.assigned_date DESC`, [req.params.id]);
    res.json({ ...rows[0], payments, duties });
  } catch (err) { sendError(res, err); }
});

// POST /api/employees
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { first_name, last_name, email, phone, role, base_salary, join_date, address } = req.body;
  if (!first_name || !last_name || !['manager','cashier','stock_handler','rack_manager'].includes(role))
    return res.status(400).json({ error: 'first_name, last_name and role required' });
  try {
    const { rows: result } = await pool.query(
      'INSERT INTO Employee (first_name,last_name,email,phone,role,base_salary,join_date,address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING employee_id',
      [first_name, last_name, email||null, phone||null, role, base_salary ?? 0, join_date||null, address||null]
    );
    res.status(201).json({ message: 'Employee added', employee_id: result[0].employee_id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    sendError(res, err);
  }
});

// PATCH /api/employees/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { status } = req.body;
  if (!['active','inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { rowCount } = await pool.query('UPDATE Employee SET status=$1 WHERE employee_id=$2', [status, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: `Employee marked ${status}` });
  } catch (err) { sendError(res, err); }
});

// DELETE /api/employees/:id
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rowCount } = await pool.query('DELETE FROM Employee WHERE employee_id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee removed' });
  } catch (err) { sendError(res, err); }
});

// GET /api/employees/duties/list
router.get('/duties/list', auth, async (req, res) => {
  try {
    const { rows: rows } = await pool.query('SELECT * FROM Duty ORDER BY department, duty_name');
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

// POST /api/employees/:id/assign
router.post('/:id/assign', auth, async (req, res) => {
  if (req.user.role === 'cashier') return res.status(403).json({ error: 'Not authorized' });
  const { duty_id, shift, notes, manager_employee_id } = req.body;
  if (!Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) <= 0 ||
      !Number.isSafeInteger(Number(duty_id)) || Number(duty_id) <= 0 ||
      !Number.isSafeInteger(Number(manager_employee_id)) || Number(manager_employee_id) <= 0 ||
      !['morning','evening','night'].includes(shift || 'morning'))
    return res.status(400).json({ error: 'Invalid employee, duty, manager, or shift' });
  try {
    await pool.query('SELECT sp_assign_duty($1,$2,$3,$4,$5)',
      [req.params.id, duty_id, manager_employee_id, shift||'morning', notes||null]);
    res.json({ message: 'Duty assigned' });
  } catch (err) { sendError(res, err); }
});

// GET /api/employees/salary/summary
router.get('/salary/summary', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows: rows } = await pool.query('SELECT * FROM vw_salary_summary ORDER BY total_paid DESC');
    // Add paid_this_month flag
    const currentMonth = new Date().toLocaleString('en-US', { month:'long', year:'numeric' });
    const { rows: paidThisMonth } = await pool.query(
      'SELECT DISTINCT employee_id FROM Salary_Payment WHERE month_year = $1', [currentMonth]);
    const paidSet = new Set(paidThisMonth.map(r => r.employee_id));
    res.json(rows.map(e => ({ ...e, paid_this_month: paidSet.has(e.employee_id) })));
  } catch (err) { sendError(res, err); }
});

// POST /api/employees/:id/pay
router.post('/:id/pay', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { amount, month_year, payment_method, notes } = req.body;
  if (!Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) <= 0 ||
      amount == null || !Number.isFinite(Number(amount)) || Number(amount) === 0 ||
      typeof month_year !== 'string' || !month_year.trim() || month_year.length > 20)
    return res.status(400).json({ error: 'Invalid employee id, amount, or month_year' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: employees } = await client.query('SELECT employee_id FROM employee WHERE employee_id=$1 FOR UPDATE', [req.params.id]);
    if (!employees.length) {
      const error = new Error('Employee not found'); error.status = 404; throw error;
    }
    if (Number(amount) > 0) {
      const { rowCount } = await client.query(
        'SELECT payment_id FROM salary_payment WHERE employee_id=$1 AND month_year=$2 AND amount>0',
        [req.params.id, month_year.trim()]);
      if (rowCount) {
        const error = new Error(`Already paid for ${month_year}`); error.status = 409; throw error;
      }
    }
    await client.query('SELECT sp_pay_salary($1,$2,$3,$4,$5,$6)',
      [req.params.id, amount, month_year.trim(), req.user.username, payment_method||'cash', notes||null]);
    await client.query('COMMIT');
    res.json({ message: 'Salary paid' });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error(rollbackError); }
    if (err.code === '23505') return res.status(409).json({ error: `Already paid for ${month_year}` });
    sendError(res, err);
  } finally { if (client) client.release(); }
});

module.exports = router;
