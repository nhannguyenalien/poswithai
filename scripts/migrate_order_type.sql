-- ============================================================
-- Migration: Phân biệt đơn bán lẻ / bán sỉ để phục vụ trang
-- Danh sách đơn hàng (tra cứu, lọc theo loại đơn)
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'retail'; -- 'retail' | 'wholesale'
