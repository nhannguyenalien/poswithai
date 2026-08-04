-- Chạy 1 lần nếu bảng users chưa có cột salt
-- Neon SQL Editor: paste và Run
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt TEXT;
