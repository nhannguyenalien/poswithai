-- ============================================================
-- Migration: Hàng cũ khách trả (thu lại) trên đơn bán lẻ
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS trade_in_total   INTEGER NOT NULL DEFAULT 0; -- Tổng tiền hàng cũ thu lại
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trade_in_details TEXT; -- JSON: [{name, weight, price_per_unit, amount}, ...]
