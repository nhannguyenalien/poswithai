BEGIN;

SET LOCAL search_path = public;

CREATE TABLE IF NOT EXISTS mobile_refresh_tokens (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES mobile_refresh_tokens(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_refresh_tokens_user
  ON mobile_refresh_tokens (tenant_id, user_id, expires_at);

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_expiry ON api_idempotency_keys (expires_at);

COMMIT;
