-- ============================================================
-- Migration: Module Vàng — Hóa đơn bán sỉ
-- Chạy trong Neon SQL Editor
-- ============================================================

-- Hoá đơn bán sỉ vàng (header)
CREATE TABLE IF NOT EXISTS gold_invoices (
    id                   TEXT PRIMARY KEY,
    tenant_id            TEXT NOT NULL REFERENCES tenants(id),
    invoice_number       TEXT NOT NULL,
    customer_id          TEXT REFERENCES customers(id),
    customer_name        TEXT,        -- ghi nhanh nếu không chọn từ CRM
    customer_phone       TEXT,
    customer_address     TEXT,
    invoice_date         TEXT NOT NULL,
    gold_price_per_chi   INTEGER NOT NULL DEFAULT 0,  -- Giá vàng 99/chỉ tại thời điểm lập hoá đơn

    -- Thống kê vàng (lưu sau khi tính toán)
    gold_delivered       REAL NOT NULL DEFAULT 0,   -- Vàng giao mới (quy đổi 99)
    gold_prev_debt       REAL NOT NULL DEFAULT 0,   -- Nợ cũ vàng
    gold_transferred     REAL NOT NULL DEFAULT 0,   -- Vàng chuyển/nhận
    gold_returned        REAL NOT NULL DEFAULT 0,   -- Dê khách trả (quy đổi)
    gold_to_money        REAL NOT NULL DEFAULT 0,   -- TL quy tiền
    gold_remaining       REAL NOT NULL DEFAULT 0,   -- Còn lại vàng
    gold_customer_paid   REAL NOT NULL DEFAULT 0,   -- KH thanh toán vàng
    gold_customer_debt   REAL NOT NULL DEFAULT 0,   -- Khách nợ vàng

    -- Thống kê tiền
    total_making_fee        INTEGER NOT NULL DEFAULT 0,  -- Tổng tiền công
    discount_percent        REAL    NOT NULL DEFAULT 0,  -- Chiết khấu %
    money_prev_debt         INTEGER NOT NULL DEFAULT 0,  -- Nợ cũ tiền
    making_fee_paid_back    INTEGER NOT NULL DEFAULT 0,  -- Tiền công trả khách
    gold_money_value        INTEGER NOT NULL DEFAULT 0,  -- Tiền vàng thanh toán (TL quy tiền × giá)
    invoice_discount        INTEGER NOT NULL DEFAULT 0,  -- Giảm cả toa
    total_money             INTEGER NOT NULL DEFAULT 0,  -- Tổng cộng
    customer_paid_money     INTEGER NOT NULL DEFAULT 0,  -- Khách đã thanh toán tiền
    customer_money_debt     INTEGER NOT NULL DEFAULT 0,  -- Khách nợ tiền

    status      TEXT NOT NULL DEFAULT 'draft',  -- draft | completed | cancelled
    notes       TEXT,
    created_by  TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(tenant_id, invoice_number)
);

-- Chi tiết hàng bán ra
CREATE TABLE IF NOT EXISTS gold_invoice_items (
    id                   TEXT PRIMARY KEY,
    invoice_id           TEXT NOT NULL REFERENCES gold_invoices(id) ON DELETE CASCADE,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    product_name         TEXT NOT NULL,
    quantity             INTEGER NOT NULL DEFAULT 1,
    -- Nhập liệu (1 món)
    unit_gross_weight    REAL NOT NULL DEFAULT 0,  -- TL vàng+hột / món
    unit_stone_weight    REAL NOT NULL DEFAULT 0,  -- TL hột / món
    unit_making_fee      INTEGER NOT NULL DEFAULT 0,  -- Giá công / món
    gold_purity          REAL NOT NULL DEFAULT 99, -- Tuổi vàng
    -- Tính toán (1 món)
    unit_net_weight      REAL NOT NULL DEFAULT 0,  -- TL vàng / món
    unit_converted       REAL NOT NULL DEFAULT 0,  -- Sau quy đổi / món
    -- Tổng (× số lượng)
    total_gross          REAL NOT NULL DEFAULT 0,
    total_stone          REAL NOT NULL DEFAULT 0,
    total_net            REAL NOT NULL DEFAULT 0,
    total_converted      REAL NOT NULL DEFAULT 0,
    total_making_fee     INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT NOT NULL
);

-- Dê khách trả (vàng cũ đổi lại)
CREATE TABLE IF NOT EXISTS gold_invoice_returns (
    id                TEXT PRIMARY KEY,
    invoice_id        TEXT NOT NULL REFERENCES gold_invoices(id) ON DELETE CASCADE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    gold_type_name    TEXT NOT NULL,      -- Tên loại dê (tự nhập)
    gross_weight      REAL NOT NULL DEFAULT 0,  -- TL luôn hột
    stone_weight      REAL NOT NULL DEFAULT 0,  -- Hột
    net_weight        REAL NOT NULL DEFAULT 0,  -- TL vàng = gross - stone
    conversion_text   TEXT NOT NULL DEFAULT '99/99',  -- VD: 97.5/99
    converted_weight  REAL NOT NULL DEFAULT 0,  -- Dê sau quy đổi
    created_at        TEXT NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gold_invoices_tenant   ON gold_invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_invoices_customer ON gold_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_gold_items_invoice     ON gold_invoice_items(invoice_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gold_returns_invoice   ON gold_invoice_returns(invoice_id, sort_order);
