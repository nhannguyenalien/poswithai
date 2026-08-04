-- ============================================================
-- Migration: API token để tích hợp bên ngoài (public API) — tách biệt hoàn toàn với JWT
-- phiên đăng nhập trên web (JWT ngắn hạn, gắn với 1 lần đăng nhập trình duyệt). API token
-- dài hạn, có thể đặt tên/thu hồi riêng từng cái, KHÔNG lưu token thật — chỉ lưu bản băm
-- SHA-256, giống cách GitHub/Stripe lưu personal access token/API key.
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,   -- SHA-256(token thật), token thật không bao giờ lưu
  token_prefix TEXT NOT NULL,        -- vài ký tự đầu để nhận diện trong danh sách (VD: pos_a1b2c3d4...)
  created_by TEXT,                   -- user đã tạo token — dùng làm created_by khi API token này thao tác dữ liệu
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_tenant ON api_tokens(tenant_id);
