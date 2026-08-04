-- ============================================================
-- Migration: Lưu chi tiết vàng/bạc (tuổi, TL vàng+hột, TL hột, TL vàng thực,
-- quy đổi 99) theo từng dòng order_items — trước đây chỉ lưu unit_price (tiền
-- công), mất hết breakdown trừ hao khi xem lại/in hoá đơn.
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS metal_details TEXT;
-- JSON: { metalType, purity, basePurity, grossWeight, stoneWeight, netWeight, unit, conv99 }
-- null với mặt hàng không phải vàng/bạc.
