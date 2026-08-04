-- ============================================================
-- Migration: mẫu hàng hoá lưu sẵn để tái sử dụng nhanh trong hoá đơn nháp — cho cả
-- "Mục tuỳ ý" (kind='custom') lẫn "Hàng cũ khách trả / dẻ" (kind='tradein'), tránh phải
-- gõ lại tên/tuổi/trọng lượng/công mỗi lần cho những món hay lặp lại, giảm sai sót gõ nhầm.
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

CREATE TABLE IF NOT EXISTS item_presets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- 'custom' (mục tuỳ ý) | 'tradein' (hàng cũ khách trả)
  name TEXT NOT NULL,
  purity REAL DEFAULT 0,         -- tuổi
  gross_weight REAL DEFAULT 0,   -- TL vàng+hột (giá trị gợi ý, vẫn sửa lại được mỗi lần dùng)
  stone_weight REAL DEFAULT 0,   -- TL hột (trừ hao)
  price INTEGER DEFAULT 0,       -- công/đơn giá — chỉ có ý nghĩa với kind='custom'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_presets_tenant_kind ON item_presets(tenant_id, kind);
