// Danh sách bảng được sao lưu/khôi phục — dùng chung cho export.js và import.js.
// Thứ tự trong mảng CHÍNH LÀ thứ tự insert lúc khôi phục — phải xếp bảng cha trước bảng
// con (đúng thứ tự khoá ngoại) để không bị lỗi FK khi restore vào CSDL trống.
//
// KHÔNG sao lưu (cố ý loại trừ):
//   - tenants, users        — thông tin đăng nhập/tài khoản, không nên ghi đè qua backup
//   - api_tokens/api_rate_limits — chỉ lưu bản băm (hash) của token thật, backup lại vô
//     nghĩa vì không thể dùng lại được — tạo token mới sau khi khôi phục nếu cần
//   - activity_logs         — nhật ký thao tác, không phải dữ liệu nghiệp vụ cần khôi phục
//
// "tenantFilter: true" — bảng có sẵn cột tenant_id, lọc/khôi phục trực tiếp theo tenant.
// "parentTable/parentKey" — bảng con không có tenant_id, lọc gián tiếp qua bảng cha đã
// export (chỉ lấy các dòng có khoá ngoại trỏ tới 1 dòng đã thuộc về tenant này).
export const BACKUP_TABLES = [
  { name: "channels",                  tenantFilter: true, pk: "id" },
  { name: "categories",                tenantFilter: true, pk: "id", selfParentCol: "parent_id" },
  { name: "brands",                    tenantFilter: true, pk: "id" },
  { name: "gold_types",                tenantFilter: true, pk: "id" },
  { name: "products",                  tenantFilter: true, pk: "id" },
  { name: "product_variants",          tenantFilter: true, pk: "id" },
  { name: "gold_product_details",      parentTable: "product_variants", parentKey: "product_variant_id", pk: "id" },
  { name: "silver_product_details",    parentTable: "product_variants", parentKey: "product_variant_id", pk: "id" },
  { name: "customers",                 tenantFilter: true, pk: "id" },
  { name: "customer_addresses",        parentTable: "customers", parentKey: "customer_id", pk: "id" },
  { name: "gold_price_history",        tenantFilter: true, pk: "id" },
  { name: "roles",                     tenantFilter: true, pk: "id" },
  { name: "settings",                  tenantFilter: true, pk: "id" },
  { name: "item_presets",              tenantFilter: true, pk: "id" },
  { name: "orders",                    tenantFilter: true, pk: "id" },
  { name: "order_items",               parentTable: "orders", parentKey: "order_id", pk: "id" },
  { name: "payments",                  tenantFilter: true, pk: "id" },
  { name: "inventory_transactions",    tenantFilter: true, pk: "id" },
  { name: "stock_snapshots",           tenantFilter: true, pk: "product_variant_id" },
  { name: "stock_adjustments",         tenantFilter: true, pk: "id" },
  { name: "customer_debt_adjustments", tenantFilter: true, pk: "id" },
  { name: "gold_invoices",             tenantFilter: true, pk: "id" },
  { name: "gold_invoice_items",        parentTable: "gold_invoices", parentKey: "invoice_id", pk: "id" },
  { name: "gold_invoice_returns",      parentTable: "gold_invoices", parentKey: "invoice_id", pk: "id" },
];

export const BACKUP_VERSION = 1;
