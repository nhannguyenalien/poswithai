-- ============================================================
-- Migration: Điều chỉnh công nợ khách hàng nhập tay (nợ cũ trước khi
-- dùng phần mềm, hoặc chỉnh sửa/xoá bớt nợ thủ công) — tách riêng khỏi
-- orders vì không phải là 1 hoá đơn thật, chỉ là 1 bút toán công nợ.
-- Đã chạy trực tiếp trên Neon — file này để lưu lại tài liệu migration
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_debt_adjustments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  money_amount INTEGER NOT NULL DEFAULT 0,   -- + tăng nợ tiền, - giảm nợ tiền
  gold_amount_99 REAL NOT NULL DEFAULT 0,    -- + tăng nợ vàng (chỉ 99), - giảm
  note TEXT,                                 -- lý do (VD: "Nợ cũ trước khi dùng phần mềm")
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cda_customer ON customer_debt_adjustments(customer_id);
