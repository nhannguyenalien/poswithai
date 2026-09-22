import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { validateUuid, validationError } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);
  const allowed = await requirePermission(context, auth, "inventory.read");
  if (allowed instanceof Response) return allowed;

  const { request, env } = context;
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variant_id");
  const idError = validateUuid(variantId, "variant_id", { optional: true });
  if (idError) return validationError([idError]);
  const sql = getDb(env);

  // Ngưỡng tồn thấp lấy từ settings — đồng nhất với trang Báo cáo
  const settingRows = await sql`
    SELECT value FROM settings
    WHERE tenant_id = ${auth.tenantId} AND key = 'low_stock_threshold'
    LIMIT 1
  `;
  const threshold = parseInt(settingRows[0]?.value || "5");

  if (variantId) {
    // Tồn kho 1 variant
    const rows = await sql`
      SELECT ss.qty, pv.sku, p.name AS product_name
      FROM stock_snapshots ss
      JOIN product_variants pv ON pv.id = ss.product_variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE ss.product_variant_id = ${variantId} AND ss.tenant_id = ${auth.tenantId}
      LIMIT 1
    `;
    return json(rows.length ? { ...rows[0], qty: Number(rows[0].qty || 0) } : { qty: 0 });
  }

  // Tồn kho toàn bộ
  const rows = await sql`
    SELECT pv.id AS variant_id, pv.sku, pv.barcode, pv.price,
           p.id AS product_id, p.name AS product_name, p.product_type,
           COALESCE(ss.qty, 0) AS qty,
           (
             SELECT it.unit_cost FROM inventory_transactions it
             WHERE it.product_variant_id = pv.id AND it.type = 'IN'
             ORDER BY it.created_at DESC LIMIT 1
           ) AS last_cost
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN stock_snapshots ss ON ss.product_variant_id = pv.id
    WHERE p.tenant_id = ${auth.tenantId} AND p.status = 'active'
    ORDER BY p.name, pv.sku
  `;

  const items = rows.map(row => ({
    ...row,
    qty: Number(row.qty || 0),
    price: Number(row.price || 0),
    last_cost: row.last_cost === null ? null : Number(row.last_cost),
  }));
  return json({
    items,
    total_skus: rows.length,
    threshold,
    low_stock: items.filter(item => item.qty <= threshold),
  });
}
