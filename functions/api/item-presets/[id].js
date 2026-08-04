// DELETE /api/item-presets/:id — xoá 1 mẫu hàng đã lưu (không cần nữa/lưu nhầm).
// PUT    /api/item-presets/:id — sửa lại 1 mẫu hàng đã lưu (kể cả đổi tên).
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "DELETE") return deletePreset(context, auth);
  if (context.request.method === "PUT")    return updatePreset(context, auth);
  return errorJson("Method not allowed", 405);
}

async function deletePreset({ env, params }, { tenantId }) {
  const sql = getDb(env);

  const rows = await sql`
    DELETE FROM item_presets WHERE id = ${params.id} AND tenant_id = ${tenantId} RETURNING id
  `;
  if (!rows.length) return errorJson("Không tìm thấy mẫu này", 404);

  return json({ deleted: true });
}

async function updatePreset(context, { tenantId }) {
  const { request, env, params } = context;
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const name = (body.name || "").trim();
  if (!name) return errorJson("Tên hàng là bắt buộc", 422);

  const purity      = parseFloat(body.purity) || 0;
  const grossWeight = parseFloat(body.gross_weight) || 0;
  const stoneWeight = parseFloat(body.stone_weight) || 0;
  const price       = parseInt(body.price) || 0;
  const now = new Date().toISOString();

  const sql = getDb(env);
  const rows = await sql`
    UPDATE item_presets SET name = ${name}, purity = ${purity}, gross_weight = ${grossWeight},
           stone_weight = ${stoneWeight}, price = ${price}, updated_at = ${now}
    WHERE id = ${params.id} AND tenant_id = ${tenantId}
    RETURNING id
  `;
  if (!rows.length) return errorJson("Không tìm thấy mẫu này", 404);

  return json({ id: params.id, updated: true });
}
