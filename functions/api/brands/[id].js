// PUT    /api/brands/:id    — cập nhật
// DELETE /api/brands/:id    — xóa
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  if (context.request.method === "PUT")    return updateBrand(context, auth, id);
  if (context.request.method === "DELETE") return deleteBrand(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function updateBrand({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { name, symbol, standard, address } = body;
  const sql = getDb(env);
  const now = new Date().toISOString();

  const rows = await sql`
    UPDATE brands
    SET name     = COALESCE(${name||null},     name),
        symbol   = COALESCE(${symbol||null},   symbol),
        standard = COALESCE(${standard||null}, standard),
        address  = COALESCE(${address||null},  address),
        updated_at = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING *
  `;
  if (!rows.length) return errorJson("Không tìm thấy nhãn hiệu", 404);
  return json(rows[0]);
}

async function deleteBrand({ env }, { tenantId }, id) {
  const sql = getDb(env);
  // Bỏ link trước khi xóa
  await sql`UPDATE products SET brand_id = NULL WHERE brand_id = ${id} AND tenant_id = ${tenantId}`;
  await sql`DELETE FROM brands WHERE id = ${id} AND tenant_id = ${tenantId}`;
  return json({ success: true });
}