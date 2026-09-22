BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

ALTER TABLE product_images
  DROP CONSTRAINT IF EXISTS product_images_embedding_status_check;
ALTER TABLE product_images
  ADD CONSTRAINT product_images_embedding_status_check
  CHECK (embedding_status IN ('pending', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS idx_product_images_embedding_ready
  ON product_images (tenant_id, product_id)
  WHERE embedding_status = 'ready' AND embedding IS NOT NULL;

-- Build an HNSW index after the catalog has real embeddings. Creating it on an
-- empty demo table adds overhead without improving search.
-- CREATE INDEX CONCURRENTLY idx_product_images_embedding_hnsw
--   ON product_images USING hnsw (embedding vector_cosine_ops);

COMMIT;
