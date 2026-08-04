// GET /api/reports/stock?filter=all|low|zero
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);

  const url      = new URL(context.request.url);
  const filter   = url.searchParams.get("filter") || "all"; // all|low|zero
  const { tenantId } = auth;
  const sql = getDb(context.env);

  // Lấy ngưỡng tồn thấp từ settings
  const settingRows = await sql`
    SELECT value FROM settings
    WHERE tenant_id = ${tenantId} AND key = 'low_stock_threshold'
    LIMIT 1
  `;
  const threshold = parseInt(settingRows[0]?.value || "5");

  // ── 1. Danh sách tồn kho đầy đủ ───────────────────────
  const items = await sql`
    SELECT
      p.id          AS product_id,
      p.name        AS product_name,
      p.product_type,
      p.status      AS product_status,
      pv.id         AS variant_id,
      pv.sku,
      pv.barcode,
      pv.price      AS sell_price,
      COALESCE(ss.qty, 0) AS qty,
      COALESCE(ss.updated_at, pv.created_at) AS last_movement,
      -- Giá vốn gần nhất (từ ledger)
      (
        SELECT it.unit_cost
        FROM inventory_transactions it
        WHERE it.product_variant_id = pv.id AND it.type = 'IN'
        ORDER BY it.created_at DESC
        LIMIT 1
      ) AS last_cost,
      -- Tổng đã bán
      (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_variant_id = pv.id AND o.status = 'completed'
      ) AS total_sold
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN stock_snapshots ss ON ss.product_variant_id = pv.id
    WHERE p.tenant_id = ${tenantId}
      AND p.status    = 'active'
    ORDER BY p.name, pv.sku
  `;

  // Tính toán trong JS (nhẹ hơn SQL complex)
  const processed = items.map(i => ({
    ...i,
    qty:        parseInt(i.qty)        || 0,
    sell_price: parseInt(i.sell_price) || 0,
    last_cost:  i.last_cost ? parseInt(i.last_cost) : null,
    total_sold: parseInt(i.total_sold) || 0,
    stock_value: (parseInt(i.qty) || 0) * (i.last_cost ? parseInt(i.last_cost) : (parseInt(i.sell_price) || 0)),
    is_low:  (parseInt(i.qty) || 0) > 0 && (parseInt(i.qty) || 0) <= threshold,
    is_zero: (parseInt(i.qty) || 0) === 0,
  }));

  // Filter
  let filtered = processed;
  if (filter === "low")  filtered = processed.filter(i => i.is_low);
  if (filter === "zero") filtered = processed.filter(i => i.is_zero);

  // ── 2. Summary cards ──────────────────────────────────
  const totalSKUs    = processed.length;
  const totalUnits   = processed.reduce((s, i) => s + i.qty, 0);
  const totalValue   = processed.reduce((s, i) => s + i.stock_value, 0);
  const lowCount     = processed.filter(i => i.is_low).length;
  const zeroCount    = processed.filter(i => i.is_zero).length;

  // ── 3. Phân bổ tồn theo ngành ──────────────────────────
  const byType = {};
  processed.forEach(i => {
    const t = i.product_type || "general";
    if (!byType[t]) byType[t] = { qty: 0, value: 0, skus: 0 };
    byType[t].qty   += i.qty;
    byType[t].value += i.stock_value;
    byType[t].skus  += 1;
  });

  // ── 4. Top sản phẩm tồn lâu không bán ───────────────
  const noSale = processed
    .filter(i => i.qty > 0 && i.total_sold === 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return json({
    threshold,
    summary: { totalSKUs, totalUnits, totalValue, lowCount, zeroCount },
    items: filtered,
    byType,
    noSale,
    filter,
  });
}
