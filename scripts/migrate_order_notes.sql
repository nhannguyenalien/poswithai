-- ============================================================
-- Migration: Ghi chú đơn hàng — bán sỉ có ô "Ghi chú" trên UI nhưng
-- trước đây không hề gửi/lưu, dữ liệu nhập vào bị mất hoàn toàn.
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
