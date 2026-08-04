-- ============================================================
-- Migration: Khách hàng doanh nghiệp — nhập MST tự động tra cứu
-- tên/địa chỉ công ty qua API VietQR (tra cứu MST)
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_business BOOLEAN NOT NULL DEFAULT false; -- true = khách doanh nghiệp
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_code TEXT; -- Mã số thuế (chỉ có khi is_business = true)
