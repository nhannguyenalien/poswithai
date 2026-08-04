-- ============================================================
-- SEED DATA — chỉ dùng để test, KHÔNG dùng ở production
-- Chạy TRƯỚC hoặc dùng POST /api/setup thay thế
-- ============================================================

-- Nếu muốn reset sạch (cẩn thận!):
-- TRUNCATE tenants, users, roles, categories, channels, settings CASCADE;

-- Dùng POST /api/setup thay vì chạy file này:
-- curl -X POST http://localhost:8788/api/setup \
--   -H "Content-Type: application/json" \
--   -d '{
--     "tenant_name": "Tiệm Vàng ABC",
--     "tenant_slug": "tiem-vang-abc",
--     "admin_email": "admin@example.com",
--     "admin_password": "demo123456",
--     "admin_name": "Chủ tiệm"
--   }'
-- Sau đó login tại /login.html
