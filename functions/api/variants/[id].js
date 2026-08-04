import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";
import { saveMetalDetails } from "../../_metal.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  if (context.request.method === "PUT")    return updateVariant(context, auth, id);
  if (context.request.method === "DELETE") return deleteVariant(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function updateVariant({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }
  const { sku, barcode, price, attributes, metal } = body;
  const sql = getDb(env);
  const now = new Date().toISOString();

  const variants = await sql`
    SELECT pv.id, p.product_type FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = ${id} AND pv.tenant_id = ${tenantId} LIMIT 1
  `;
  if (!variants.length) return errorJson("Không tìm thấy variant", 404);

  const rows = await sql`
    UPDATE product_variants
    SET sku        = COALESCE(${sku        || null}, sku),
        barcode    = COALESCE(${barcode    || null}, barcode),
        price      = COALESCE(${price      ?? null}, price),
        attributes = COALESCE(${attributes ? JSON.stringify(attributes) : null}, attributes)
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING *
  `;
  if (metal) await saveMetalDetails(sql, id, variants[0].product_type, metal, now);
  return json(rows[0]);
}

async function deleteVariant({ env }, { tenantId }, id) {
  const sql = getDb(env);
  const used = await sql`SELECT 1 FROM order_items WHERE product_variant_id = ${id} LIMIT 1`;
  if (used.length) return errorJson("Variant đã có trong đơn hàng, không thể xóa", 409);

  await sql`DELETE FROM gold_product_details   WHERE product_variant_id = ${id}`;
  await sql`DELETE FROM silver_product_details WHERE product_variant_id = ${id}`;
  await sql`DELETE FROM stock_snapshots        WHERE product_variant_id = ${id}`;
  const rows = await sql`
    DELETE FROM product_variants WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
  `;
  if (!rows.length) return errorJson("Không tìm thấy variant", 404);
  return json({ success: true });
}
