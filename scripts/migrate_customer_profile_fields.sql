-- ============================================================
-- Migration: Hồ sơ khách hàng — ngày sinh, CCCD, ngân hàng
-- Chạy trong Neon SQL Editor
-- ============================================================

-- Bổ sung các trường hồ sơ khách hàng cá nhân (đồng bộ với thông tin người bán
-- dùng ở chứng từ mua vào vàng — xem migrate_gold_invoice_purchase_info.sql) —
-- tất cả đều tuỳ chọn.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dob             TEXT;  -- Ngày/tháng/năm sinh
ALTER TABLE customers ADD COLUMN IF NOT EXISTS id_issue_date   TEXT;  -- Ngày cấp CCCD/CMND
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bank_name       TEXT;  -- Ngân hàng
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bank_account    TEXT;  -- Số tài khoản
