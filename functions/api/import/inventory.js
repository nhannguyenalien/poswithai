import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const { rows = [] } = body;
  if (!rows.length) return errorJson("Không có dữ liệu", 422);
  if (rows.length > 2000) return errorJson("Tối đa 2000 dòng", 422);

  const sql = getDb(context.env);
  const { tenantId, userId } = auth;
  const now = new Date().toISOString();
  const results = { total: rows.length, success: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; const rowNum = i + 1;
    try {
      const sku  = String(row.sku||"").trim();
      const qty  = parseInt(String(row.qty||row.quantity||"0").replace(/[^\d]/g,""))||0;
      const cost = parseInt(String(row.unit_cost||"0").replace(/[^\d]/g,""))||null;
      const note = String(row.note||"Nhập kho đầu kỳ").trim();
      if (!sku) { results.errors.push({ row:rowNum, message:"SKU không được trống" }); continue; }
      if (qty < 0) { results.errors.push({ row:rowNum, sku, message:"Số lượng phải >= 0" }); continue; }

      const vs = await sql`SELECT pv.id FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.tenant_id=${tenantId} AND pv.sku=${sku} LIMIT 1`;
      if (!vs.length) { results.errors.push({ row:rowNum, sku, message:`Không tìm thấy SKU "${sku}"` }); continue; }

      const vid = vs[0].id;
      await sql`INSERT INTO inventory_transactions (id,tenant_id,product_variant_id,type,quantity,unit_cost,total_cost,reference_type,note,created_by,created_at) VALUES (${crypto.randomUUID()},${tenantId},${vid},'IN',${qty},${cost},${cost?cost*qty:null},'import',${note},${userId},${now})`;
      await sql`INSERT INTO stock_snapshots (product_variant_id,tenant_id,qty,updated_at) VALUES (${vid},${tenantId},${qty},${now}) ON CONFLICT (product_variant_id) DO UPDATE SET qty=stock_snapshots.qty+${qty},updated_at=${now}`;
      results.success++;
    } catch(err) { results.errors.push({ row:rowNum, sku:row.sku, message:err.message }); }
  }
  return json(results);
}
