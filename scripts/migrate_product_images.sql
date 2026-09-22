BEGIN;

CREATE TABLE IF NOT EXISTS product_images (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  image_url text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON product_images (tenant_id, product_id, is_primary DESC, sort_order, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_object_key ON product_images (object_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_primary
  ON product_images (tenant_id, product_id) WHERE is_primary;

COMMIT;
