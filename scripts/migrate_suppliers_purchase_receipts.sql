BEGIN;

SET LOCAL search_path = public;

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  tax_code TEXT,
  address TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS suppliers_tenant_name_idx ON suppliers(tenant_id, name);

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  supplier_id TEXT REFERENCES suppliers(id),
  receipt_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
  note TEXT,
  received_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, receipt_no)
);
CREATE INDEX IF NOT EXISTS purchase_receipts_tenant_date_idx ON purchase_receipts(tenant_id, received_at DESC);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  purchase_receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost BIGINT NOT NULL CHECK (unit_cost >= 0),
  line_total BIGINT NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_receipt_idx ON purchase_receipt_items(purchase_receipt_id);

COMMIT;
