-- ============================================================
-- Migration: Thêm CCCD/CMND và địa chỉ cho khách hàng
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS id_card TEXT;  -- Số CCCD/CMND
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;  -- Địa chỉ
