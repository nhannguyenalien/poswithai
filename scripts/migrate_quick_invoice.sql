-- ============================================================
-- Migration: Hoá đơn nháp (ẩn khỏi danh sách chính, không trừ kho,
-- vẫn lưu công nợ khách hàng) — dùng chung cho cả bán lẻ & bán sỉ
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_quick BOOLEAN NOT NULL DEFAULT false; -- true = hoá đơn nháp, ẩn khỏi /api/orders mặc định

-- Cho phép order_items không gắn với 1 product_variant có sẵn trong kho —
-- hoá đơn nháp có thể thêm mặt hàng gõ tay (tên tuỳ ý) mà không cần tồn tại trong danh mục sản phẩm.
ALTER TABLE order_items ALTER COLUMN product_variant_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_name TEXT; -- tên hàng gõ tay, dùng khi product_variant_id IS NULL
