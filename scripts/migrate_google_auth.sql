-- Migration: Chuyển sang Google OAuth
-- Chạy trong Neon SQL Editor TRƯỚC khi deploy

-- Thêm cột Google
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url  TEXT;

-- Bỏ NOT NULL constraint (Google user không có password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Index để tìm nhanh theo google_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
  WHERE google_id IS NOT NULL;
