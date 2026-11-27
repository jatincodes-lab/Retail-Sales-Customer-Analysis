const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');

const testUrl = process.env.TEST_DATABASE_URL;

test('PostgreSQL schema, routines, constraints, and concurrent stock updates', { skip: !testUrl && 'Set TEST_DATABASE_URL to a disposable PostgreSQL database' }, async t => {
  const pool = new Pool({ connectionString: testUrl, max: 5 });
  const client = await pool.connect();
  const schema = `retail_test_${process.pid}_${randomBytes(5).toString('hex')}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(__dirname, '../../sql_budget_profit.sql'), 'utf8'));

    await t.test('migrations create the expected base and feature data', async () => {
      const { rows } = await client.query(`
        SELECT (SELECT COUNT(*) FROM product) AS products,
               (SELECT COUNT(*) FROM employee) AS employees,
               (SELECT COUNT(*) FROM vw_product_details) AS product_view,
               (SELECT balance FROM vw_budget_balance) AS budget`);
      assert.equal(Number(rows[0].products), 15);
      assert.ok(Number(rows[0].employees) > 0);
      assert.equal(Number(rows[0].product_view), 15);
      assert.equal(Number(rows[0].budget), 500000);
    });

    await t.test('sale routines update sale totals and inventory atomically', async () => {
      const { rows: [{ sale_id: saleId }] } = await client.query('SELECT sp_process_sale(NULL) AS sale_id');
      await client.query('SELECT sp_add_sale_item($1,$2,$3)', [saleId, 15, 2]);
      const { rows: [sale] } = await client.query('SELECT total_amount FROM sale WHERE sale_id=$1', [saleId]);
      const { rows: [stock] } = await client.query('SELECT quantity_in_stock FROM inventory WHERE product_id=15');
      assert.equal(Number(sale.total_amount), 900);
      assert.equal(stock.quantity_in_stock, 43);
      await assert.rejects(client.query('SELECT sp_add_sale_item($1,$2,$3)', [saleId, 15, 999]), /Insufficient stock/);
      const { rows: [unchanged] } = await client.query('SELECT quantity_in_stock FROM inventory WHERE product_id=15');
      assert.equal(unchanged.quantity_in_stock, 43);
    });

    await t.test('restock and duty functions work; duplicate payroll is rejected', async () => {
      await client.query('SELECT sp_restock_product($1,$2)', [15, 3]);
      await client.query('SELECT sp_assign_duty($1,$2,$3,$4,$5)', [1, 1, 1, 'morning', null]);
      await client.query('SELECT sp_pay_salary($1,$2,$3,$4,$5,$6)', [1, 100, 'Test Month', 'test', 'cash', null]);
      await assert.rejects(
        client.query('SELECT sp_pay_salary($1,$2,$3,$4,$5,$6)', [1, 100, 'Test Month', 'test', 'cash', null]),
        error => error.code === '23505'
      );
      await client.query('SELECT sp_pay_salary($1,$2,$3,$4,$5,$6)', [1, -10, 'Test Month', 'test', 'cash', 'deduction']);
      const { rows: [stock] } = await client.query('SELECT quantity_in_stock FROM inventory WHERE product_id=15');
      assert.equal(stock.quantity_in_stock, 46);
    });

    await t.test('simultaneous sales cannot sell the same remaining stock twice', async () => {
      await client.query('UPDATE inventory SET quantity_in_stock=5 WHERE product_id=15');
      const first = await pool.connect();
      const second = await pool.connect();
      try {
        await first.query(`SET search_path TO "${schema}"`);
        await second.query(`SET search_path TO "${schema}"`);
        await first.query('BEGIN');
        await second.query('BEGIN');
        const a = await first.query('UPDATE inventory SET quantity_in_stock=quantity_in_stock-4 WHERE product_id=15 AND quantity_in_stock>=4 RETURNING product_id');
        const bPromise = second.query('UPDATE inventory SET quantity_in_stock=quantity_in_stock-4 WHERE product_id=15 AND quantity_in_stock>=4 RETURNING product_id');
        await first.query('COMMIT');
        const b = await bPromise;
        await second.query('COMMIT');
        assert.equal(a.rowCount, 1);
        assert.equal(b.rowCount, 0);
        const { rows: [stock] } = await client.query('SELECT quantity_in_stock FROM inventory WHERE product_id=15');
        assert.equal(stock.quantity_in_stock, 1);
      } finally {
        first.release();
        second.release();
      }
    });
  } finally {
    try {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  }
});
