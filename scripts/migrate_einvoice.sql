-- ============================================================
-- Migration: Hoá đơn điện tử (VAT) cho hoá đơn vàng
-- Chạy trong Neon SQL Editor
-- ============================================================

ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_status    TEXT NOT NULL DEFAULT 'none'; -- none | issued | error | cancelled
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_provider  TEXT;               -- matbao | misa | viettel
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_number    TEXT;               -- InvNo do nhà cung cấp trả về
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_fkey      TEXT;               -- mã tra cứu (fkey) dùng để tải PDF / huỷ / điều chỉnh
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_pdf_url   TEXT;
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_error     TEXT;
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS einvoice_issued_at TEXT;

-- Buyer/khách hàng cần MST khi xuất hoá đơn cho công ty (không bắt buộc với khách lẻ)
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_tax_code  TEXT;
ALTER TABLE gold_invoices ADD COLUMN IF NOT EXISTS customer_company   TEXT; -- Tên công ty (nếu xuất cho tổ chức)

-- Các key settings dùng cho tích hợp e-invoice (lưu qua bảng settings key-value có sẵn,
-- không cần bảng riêng). Không cần INSERT gì ở đây — chủ tiệm tự điền qua trang Settings:
--   einvoice_provider          matbao | misa | viettel
--   einvoice_base_url          base_url_api do nhà cung cấp cấp riêng cho tenant
--   einvoice_username          ApiUserName
--   einvoice_password          ApiPassword
--   einvoice_pattern           ApiInvPattern (mẫu số hoá đơn, do CQT cấp khi đăng ký)
--   einvoice_serial            ApiInvSerial (ký hiệu hoá đơn)
--   einvoice_payment_method    Hình thức thanh toán mặc định (vd: "Tiền mặt/Chuyển khoản")
--   einvoice_vat_rate_cong     % VAT áp cho tiền công chế tác (mặc định 10)
--   einvoice_vat_rate_vang     % VAT áp cho tiền vàng (mặc định 0 — nhiều nơi miễn thuế vàng miếng/nguyên liệu, tự xác nhận với kế toán)
