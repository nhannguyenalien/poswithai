-- ============================================================
-- Migration: rate limit cho API token (chống spam/lạm dụng từ bên ngoài) — đếm số request
-- theo từng phút (fixed window) cho mỗi token, có thể chỉnh riêng từng token.
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 120;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  token_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,   -- mốc đầu phút hiện tại (date_trunc('minute', now()))
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (token_id, window_start)
);
