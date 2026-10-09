// Nguồn duy nhất mô tả các endpoint đọc dữ liệu dành cho tích hợp/AI agent.
// Dùng cho: trang /api-docs.html (qua GET /api/docs) và MCP server (/mcp).
// Chỉ liệt kê thao tác ĐỌC — thao tác ghi (tạo đơn, thanh toán...) cần Idempotency-Key và
// kiểm tra nghiệp vụ nên chưa mở cho agent; gọi REST trực tiếp, xem openapi.yaml.

const P = (type, description, extra = {}) => ({ type, description, ...extra });
const PAGE = {
  limit: P("integer", "Số dòng tối đa (1–200, mặc định 50)", { minimum: 1, maximum: 200 }),
  offset: P("integer", "Bỏ qua N dòng đầu (phân trang)", { minimum: 0 }),
};
const RANGE = {
  from: P("string", "Từ ngày YYYY-MM-DD"),
  to: P("string", "Đến ngày YYYY-MM-DD"),
};

// path có thể chứa {param} — sẽ được thay bằng argument cùng tên; argument còn lại thành query string.
export const TOOLS = [
  { name: "list_products", path: "/api/products", group: "Sản phẩm",
    description: "Tìm/liệt kê sản phẩm theo tên, SKU hoặc barcode.",
    properties: { search: P("string", "Tên, SKU hoặc barcode"), ...PAGE } },
  { name: "get_product", path: "/api/products/{id}", group: "Sản phẩm",
    description: "Chi tiết 1 sản phẩm.", properties: { id: P("string", "UUID sản phẩm") }, required: ["id"] },
  { name: "list_customers", path: "/api/customers", group: "Khách hàng",
    description: "Tìm/liệt kê khách hàng.", properties: { search: P("string", "Tên hoặc số điện thoại"), ...PAGE } },
  { name: "get_customer", path: "/api/customers/{id}", group: "Khách hàng",
    description: "Chi tiết 1 khách hàng.", properties: { id: P("string", "UUID khách hàng") }, required: ["id"] },
  { name: "get_customer_debt", path: "/api/customers/{id}/debt", group: "Khách hàng",
    description: "Công nợ (tiền VND + vàng quy 99) của 1 khách.", properties: { id: P("string", "UUID khách hàng") }, required: ["id"] },
  { name: "list_customer_debts", path: "/api/customers/debts", group: "Khách hàng",
    description: "Danh sách khách đang nợ / cửa hàng đang nợ khách.",
    properties: { direction: P("string", "all | customer_owes | shop_owes", { enum: ["all", "customer_owes", "shop_owes"] }), search: P("string", "Tên/SĐT khách"), ...PAGE } },
  { name: "list_orders", path: "/api/orders", group: "Đơn hàng",
    description: "Danh sách đơn hàng, lọc theo ngày/trạng thái.",
    properties: { status: P("string", "pending | completed | cancelled | ..."), ...RANGE, ...PAGE } },
  { name: "get_order", path: "/api/orders/{id}", group: "Đơn hàng",
    description: "Chi tiết 1 đơn hàng (dòng hàng, thanh toán).", properties: { id: P("string", "UUID đơn") }, required: ["id"] },
  { name: "get_stock", path: "/api/inventory/stock", group: "Kho",
    description: "Tồn kho hiện tại.", properties: { variant_id: P("string", "Lọc theo 1 variant") } },
  { name: "list_inventory_transactions", path: "/api/inventory", group: "Kho",
    description: "Lịch sử nhập/xuất/điều chỉnh kho.",
    properties: { type: P("string", "IN | OUT | ADJUST", { enum: ["IN", "OUT", "ADJUST"] }), search: P("string", "Từ khoá"), ...RANGE, ...PAGE } },
  { name: "list_suppliers", path: "/api/suppliers", group: "Nhà cung cấp",
    description: "Danh sách nhà cung cấp.", properties: { search: P("string", "Từ khoá"), ...PAGE } },
  { name: "list_purchase_receipts", path: "/api/purchase-receipts", group: "Nhà cung cấp",
    description: "Phiếu nhập hàng.", properties: { ...RANGE, ...PAGE } },
  { name: "get_gold_prices", path: "/api/gold/prices", group: "Vàng",
    description: "Giá vàng đã lưu.", properties: { date: P("string", "Ngày YYYY-MM-DD") } },
  { name: "list_gold_orders", path: "/api/gold/orders", group: "Vàng",
    description: "Đơn hàng vàng.", properties: { search: P("string", "Từ khoá") } },
  { name: "list_gold_invoices", path: "/api/gold/invoices", group: "Vàng",
    description: "Hoá đơn vàng.", properties: { search: P("string", "Từ khoá") } },
  { name: "report_revenue", path: "/api/reports/revenue", group: "Báo cáo",
    description: "Báo cáo doanh thu (mặc định 30 ngày gần nhất).", properties: { ...RANGE } },
  { name: "report_stock", path: "/api/reports/stock", group: "Báo cáo",
    description: "Báo cáo tồn kho.", properties: { filter: P("string", "Bộ lọc, vd low-stock") } },
  { name: "report_gold", path: "/api/reports/gold", group: "Báo cáo",
    description: "Báo cáo vàng.", properties: { ...RANGE } },
];

export function inputSchema(tool) {
  return { type: "object", properties: tool.properties || {}, required: tool.required || [], additionalProperties: false };
}

/** Dựng URL nội bộ cho 1 tool từ arguments. Trả null nếu thiếu tham số path. */
export function buildPath(tool, args = {}) {
  const query = new URLSearchParams();
  let path = tool.path;
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    if (!(key in (tool.properties || {}))) continue;
    if (path.includes(`{${key}}`)) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
    else query.set(key, String(value));
  }
  if (/\{\w+\}/.test(path)) return null;
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
