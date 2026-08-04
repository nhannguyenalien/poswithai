-- ============================================================
-- Migration: Metal product details cho Gold & Silver
-- Chạy trong Neon SQL Editor
-- ============================================================

-- Bảng gold_product_details (nếu chưa có từ schema_v2.sql)
CREATE TABLE IF NOT EXISTS gold_product_details (
    id                  TEXT PRIMARY KEY,
    product_variant_id  TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    gold_type_id        TEXT REFERENCES gold_types(id),
    gross_weight        REAL NOT NULL DEFAULT 0,  -- Tổng TL vàng + đá (chỉ)
    stone_weight        REAL NOT NULL DEFAULT 0,  -- TL đá (chỉ)
    net_weight          REAL NOT NULL DEFAULT 0,  -- TL vàng thực = gross - stone
    making_fee          INTEGER NOT NULL DEFAULT 0, -- Tiền công (đ/món)
    created_at          TEXT NOT NULL,
    UNIQUE(product_variant_id)
);

-- Bảng silver_product_details (MỚI)
CREATE TABLE IF NOT EXISTS silver_product_details (
    id                  TEXT PRIMARY KEY,
    product_variant_id  TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    purity              TEXT NOT NULL DEFAULT '925',  -- 925 | 999 | 800 | khác
    gross_weight        REAL NOT NULL DEFAULT 0,  -- Tổng TL bạc + đá (gram)
    stone_weight        REAL NOT NULL DEFAULT 0,  -- TL đá (gram)
    net_weight          REAL NOT NULL DEFAULT 0,  -- TL bạc thực = gross - stone
    making_fee          INTEGER NOT NULL DEFAULT 0, -- Tiền công (đ/món)
    created_at          TEXT NOT NULL,
    UNIQUE(product_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_gold_details_variant   ON gold_product_details(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_silver_details_variant ON silver_product_details(product_variant_id);
