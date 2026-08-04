// GET  /api/settings       — lấy tất cả settings
// POST /api/settings       — cập nhật nhiều keys cùng lúc
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return getSettings(context, auth);
  if (context.request.method === "POST") return updateMultiple(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getSettings({ env }, { tenantId }) {
  const sql  = getDb(env);
  const rows = await sql`SELECT key, value FROM settings WHERE tenant_id = ${tenantId} ORDER BY key`;
  return json({ settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
}

async function updateMultiple({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }
  const sql = getDb(env);
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(body)) {
    await sql`
      INSERT INTO settings (id, tenant_id, key, value, updated_at)
      VALUES (${crypto.randomUUID()}, ${tenantId}, ${key}, ${String(value)}, ${now})
      ON CONFLICT (tenant_id, key) DO UPDATE SET value = ${String(value)}, updated_at = ${now}
    `;
  }
  return json({ updated: Object.keys(body).length });
}
