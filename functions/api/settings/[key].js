// PUT /api/settings/:key — cập nhật 1 key cụ thể
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "PUT") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { key }   = context.params;
  const { value } = body;
  const sql = getDb(context.env);
  const now = new Date().toISOString();

  await sql`
    INSERT INTO settings (id, tenant_id, key, value, updated_at)
    VALUES (${crypto.randomUUID()}, ${auth.tenantId}, ${key}, ${String(value)}, ${now})
    ON CONFLICT (tenant_id, key) DO UPDATE SET value = ${String(value)}, updated_at = ${now}
  `;
  return json({ key, value });
}
