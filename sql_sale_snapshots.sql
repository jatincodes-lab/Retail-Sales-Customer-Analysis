-- Apply after schema.sql and sql_budget_profit.sql.
-- Existing line costs are backfilled from today's product cost and explicitly marked as estimates.
BEGIN;

ALTER TABLE sale_item
    ADD COLUMN product_name_at_sale varchar(150),
    ADD COLUMN unit_cost_at_sale numeric(10,2),
    ADD COLUMN cost_is_estimated boolean NOT NULL DEFAULT true;

UPDATE sale_item si
SET product_name_at_sale = p.product_name,
    unit_cost_at_sale = p.cost_price
FROM product p
WHERE p.product_id = si.product_id;

ALTER TABLE sale_item
    ALTER COLUMN product_name_at_sale SET NOT NULL,
    ALTER COLUMN unit_cost_at_sale SET NOT NULL,
    ALTER COLUMN cost_is_estimated SET DEFAULT false,
    ADD CONSTRAINT sale_item_unit_cost_at_sale_nonnegative CHECK (unit_cost_at_sale >= 0);

CREATE INDEX IF NOT EXISTS sale_date_idx ON sale(sale_date DESC);
CREATE INDEX IF NOT EXISTS sale_customer_idx ON sale(customer_id);
CREATE INDEX IF NOT EXISTS sale_item_sale_idx ON sale_item(sale_id);
CREATE INDEX IF NOT EXISTS sale_item_product_idx ON sale_item(product_id);
CREATE INDEX IF NOT EXISTS supplier_purchase_supplier_date_idx ON supplier_purchase(supplier_id,purchase_date DESC);

CREATE TABLE IF NOT EXISTS auth_login_throttle (
    subject_hash char(64) PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    attempt_count integer NOT NULL CHECK (attempt_count > 0)
);
CREATE INDEX IF NOT EXISTS auth_login_throttle_window_idx ON auth_login_throttle(window_started_at);

CREATE TABLE IF NOT EXISTS request_idempotency (
    user_id integer NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    route_key varchar(80) NOT NULL,
    idempotency_key varchar(128) NOT NULL,
    request_hash char(64) NOT NULL,
    response_status smallint,
    response_body jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, route_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS request_idempotency_created_idx ON request_idempotency(created_at);

CREATE OR REPLACE VIEW vw_profit_summary AS
SELECT COALESCE(SUM(si.quantity * si.unit_price), 0) AS total_revenue,
       COALESCE(SUM(si.quantity * si.unit_cost_at_sale), 0) AS total_cost,
       COALESCE(SUM(si.quantity * (si.unit_price - si.unit_cost_at_sale)), 0) AS gross_profit,
       COUNT(*) FILTER (WHERE si.cost_is_estimated) AS estimated_cost_lines
FROM sale_item si;

CREATE OR REPLACE FUNCTION sp_add_sale_item(p_sale_id integer,p_product_id integer,p_quantity integer) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_price numeric(10,2);
  v_cost numeric(10,2);
  v_name varchar(150);
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT unit_price,cost_price,product_name INTO v_price,v_cost,v_name
  FROM product WHERE product_id=p_product_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found',p_product_id; END IF;
  UPDATE inventory SET quantity_in_stock=quantity_in_stock-p_quantity
   WHERE product_id=p_product_id AND quantity_in_stock>=p_quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for product %',p_product_id; END IF;
  INSERT INTO sale_item(sale_id,product_id,quantity,unit_price,product_name_at_sale,unit_cost_at_sale,cost_is_estimated)
   VALUES(p_sale_id,p_product_id,p_quantity,v_price,v_name,v_cost,false);
  UPDATE sale SET total_amount=(SELECT COALESCE(SUM(quantity*unit_price),0) FROM sale_item WHERE sale_id=p_sale_id)
   WHERE sale_id=p_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale % not found',p_sale_id; END IF;
END;
$$;

COMMIT;
