-- ============================================================
-- Migration: Mô hình "quy về vàng 99" cho đơn bán sỉ vàng
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
--
-- Mọi TL vàng bán ra / mua vào (hàng cũ khách trả) trong 1 toa được quy đổi
-- theo tuổi về chỉ-99 rồi trừ ròng cho nhau; phần chỉ-99 còn lại mới chọn quy
-- ra tiền (theo 1 giá vàng 99 duy nhất nhập ở đầu toa), phần không quy ra tiền
-- thì để lại thành nợ vàng — tách riêng với nợ tiền (qua payments như cũ).
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS gold_price_99    INTEGER NOT NULL DEFAULT 0; -- Giá vàng 99/chỉ dùng cho toa
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gold_sold_99     REAL NOT NULL DEFAULT 0;    -- Tổng vàng bán ra đã quy đổi 99 (chỉ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gold_bought_99   REAL NOT NULL DEFAULT 0;    -- Tổng vàng mua vào (hàng cũ) đã quy đổi 99 (chỉ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gold_to_money_99 REAL NOT NULL DEFAULT 0;    -- Phần vàng (99) chọn quy ra tiền
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gold_debt_99     REAL NOT NULL DEFAULT 0;    -- Nợ vàng còn lại (chỉ 99): dương = khách nợ tiệm, âm = tiệm nợ khách
ALTER TABLE orders ADD COLUMN IF NOT EXISTS making_fee_total INTEGER NOT NULL DEFAULT 0; -- Tổng tiền công của toa (lưu tham khảo, đã gộp sẵn trong subtotal qua order_items)
