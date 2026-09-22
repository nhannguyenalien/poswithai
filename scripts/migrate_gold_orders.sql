-- ============================================================
-- Migration: Module Vàng — Đặt hàng theo yêu cầu
-- Chạy trong Neon SQL Editor
-- ============================================================

-- Phiếu đặt hàng (header) — khách đặt trước một món hàng vàng chưa có sẵn
-- (đặt gia công theo mẫu, chốt giá vàng hôm nay để giao sau), có thể đặt cọc.
CREATE TABLE IF NOT EXISTS gold_orders (
    id                TEXT PRIMARY KEY,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id),
    order_number      TEXT NOT NULL,
    customer_id       TEXT REFERENCES customers(id),
    customer_name     TEXT,
    customer_phone    TEXT,
    customer_address  TEXT,
    order_date        TEXT NOT NULL,
    expected_date     TEXT,                          -- Ngày hẹn giao (tuỳ chọn)
    gold_price_per_chi  INTEGER NOT NULL DEFAULT 0,   -- Giá vàng 99/chỉ tham khảo lúc đặt
    total_amount        INTEGER NOT NULL DEFAULT 0,   -- Tổng tiền dự kiến (tính từ các món)
    deposit_amount       INTEGER NOT NULL DEFAULT 0,  -- Tiền cọc đã nhận
    remaining_amount      INTEGER NOT NULL DEFAULT 0, -- Còn lại phải thu khi giao hàng
    status      TEXT NOT NULL DEFAULT 'pending',       -- pending | ready | delivered | cancelled
    notes       TEXT,
    created_by  TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(tenant_id, order_number)
);

-- Chi tiết các món hàng khách đặt
CREATE TABLE IF NOT EXISTS gold_order_items (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES gold_orders(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    product_name    TEXT NOT NULL,                 -- Tên món (VD: Nhẫn vàng 18K mặt đá)
    description     TEXT,                          -- Mô tả yêu cầu / mẫu mã khách đưa
    quantity        INTEGER NOT NULL DEFAULT 1,
    gold_purity     REAL NOT NULL DEFAULT 99,       -- Tuổi vàng dự kiến
    weight          REAL NOT NULL DEFAULT 0,        -- TL dự kiến / món (chỉ)
    unit_price      INTEGER NOT NULL DEFAULT 0,     -- Giá vàng ước tính /chỉ dùng cho món này
    making_fee      INTEGER NOT NULL DEFAULT 0,     -- Tiền công dự kiến / món
    amount          INTEGER NOT NULL DEFAULT 0,     -- Thành tiền = SL × (TL × đơn giá + tiền công)
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gold_orders_tenant     ON gold_orders(tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_orders_customer   ON gold_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_gold_order_items_order ON gold_order_items(order_id, sort_order);
