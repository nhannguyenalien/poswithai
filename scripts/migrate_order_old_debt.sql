-- ============================================================
-- Migration: lưu "nợ cũ" (tiền + vàng 99) của khách hàng tại THỜI ĐIỂM
-- lập hoá đơn — chỉ để hiển thị lại đúng lịch sử trên hoá đơn in (giống
-- mẫu tham chiếu có dòng "Nợ cũ"), KHÔNG cộng vào total/gold_debt_99 của
-- chính đơn này (tránh tính trùng nợ — công nợ tổng vẫn do
-- /api/customers/:id/debt tính trực tiếp từ orders + customer_debt_adjustments).
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS old_money_debt INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS old_gold_debt_99 REAL DEFAULT 0;
