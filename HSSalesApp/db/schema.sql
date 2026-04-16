-- HS Sales schema for PostgreSQL
-- Notes:
-- - This creates a schema named `hs_sales` (so you don't need to create a new database).
-- - If you already have a `hs_sales` schema, it will not overwrite it.
-- - Run this from psql or any SQL client connected to your local Postgres instance.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS hs_sales;
SET search_path = hs_sales;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'sales');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL UNIQUE,
  unit varchar(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, lot_number)
);

-- Each purchase creates a new batch (even if the same lot_number is reused).
-- FIFO allocation for sales uses lot_batches.acquired_at.
CREATE TABLE IF NOT EXISTS lot_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  acquired_at date NOT NULL,
  unit_cost numeric(18,4) NOT NULL,
  original_quantity numeric(18,3) NOT NULL,
  remaining_quantity numeric(18,3) NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_quantity >= 0),
  CHECK (original_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  created_by uuid NOT NULL REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid NOT NULL REFERENCES lots(id),
  quantity numeric(18,3) NOT NULL,
  unit_cost numeric(18,4) NOT NULL,
  CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  created_by uuid NOT NULL REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(18,3) NOT NULL,
  unit_price numeric(18,4) NOT NULL,
  CHECK (quantity > 0)
);

-- How each sales item consumes stock from specific lot batches.
-- Profit/Loss is computed from (unit_price - unit_cost_at_time).
CREATE TABLE IF NOT EXISTS sales_item_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_item_id uuid NOT NULL REFERENCES sales_items(id) ON DELETE CASCADE,
  lot_batch_id uuid NOT NULL REFERENCES lot_batches(id),
  quantity_allocated numeric(18,3) NOT NULL,
  unit_cost_at_time numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_allocated > 0)
);

CREATE TABLE IF NOT EXISTS inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date date NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  created_by uuid NOT NULL REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_warehouse_id <> to_warehouse_id)
);

-- Transfer works by moving quantity from one lot batch to a destination.
-- If you transfer a partial quantity, the backend will split the source batch.
CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  lot_batch_id uuid NOT NULL REFERENCES lot_batches(id) ON DELETE RESTRICT,
  quantity numeric(18,3) NOT NULL,
  CHECK (quantity > 0)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_lot_batches_warehouse ON lot_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_lot_batches_lot ON lot_batches(lot_id);

