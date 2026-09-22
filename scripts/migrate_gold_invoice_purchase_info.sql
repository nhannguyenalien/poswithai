-- ============================================================
-- Migration: Module Vàng — Thông tin người bán (chứng từ mua vào)
-- Chạy trong Neon SQL Editor
-- ============================================================

-- Thông tin người bán cá nhân (dùng khi lập "Chứng từ mua vào hàng hoá dịch vụ
-- của cá nhân không kinh doanh" — mẫu 02/TNDN) — tất cả đều tuỳ chọn.
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_id_card         TEXT;    -- Số CCCD/CMND
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_dob             TEXT;    -- Ngày/tháng/năm sinh
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_id_issue_date   TEXT;    -- Ngày cấp CCCD
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_bank_name       TEXT;    -- Ngân hàng
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_bank_account    TEXT;    -- Số tài khoản
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS receive_transfer_amount  INTEGER NOT NULL DEFAULT 0;  -- Nhận tiền tài khoản
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS receive_cash_amount      INTEGER NOT NULL DEFAULT 0;  -- Nhận tiền mặt

-- Đơn giá/thành tiền riêng cho từng dòng dê khách trả (mua vào), để in đúng
-- bảng "CHI TIẾT HÀNG HÓA MUA VÀO" trên chứng từ — giá thu mua có thể khác
-- giá vàng bán ra chung của hoá đơn.
ALTER TABLE gold_invoice_returns ADD COLUMN IF NOT EXISTS unit_price  INTEGER NOT NULL DEFAULT 0;  -- Đơn giá (đ/chỉ)
ALTER TABLE gold_invoice_returns ADD COLUMN IF NOT EXISTS line_total  INTEGER NOT NULL DEFAULT 0;  -- Thành tiền
