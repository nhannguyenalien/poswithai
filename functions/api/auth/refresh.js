import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { sha256Hex } from "../../_auth.js";
import { createMobileSession } from "../../_mobile-session.js";

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  if (!body.refresh_token?.startsWith("posr_")) return errorJson("Refresh token không hợp lệ", 401, "REFRESH_TOKEN_INVALID");
  const sql = getDb(env);
  const hash = await sha256Hex(body.refresh_token);
  const rows = await sql`
    SELECT rt.id, rt.user_id, rt.tenant_id, u.email, u.name, u.status, rt.expires_at, rt.revoked_at
    FROM mobile_refresh_tokens rt JOIN users u ON u.id = rt.user_id AND u.tenant_id = rt.tenant_id
    WHERE rt.token_hash = ${hash} LIMIT 1
  `;
  if (!rows.length || rows[0].revoked_at || new Date(rows[0].expires_at) <= new Date() || rows[0].status !== "active") {
    return errorJson("Refresh token không hợp lệ hoặc đã hết hạn", 401, "REFRESH_TOKEN_INVALID");
  }
  const session = await createMobileSession(sql, env, { id: rows[0].user_id, tenant_id: rows[0].tenant_id, email: rows[0].email });
  const replacementHash = await sha256Hex(session.refresh_token);
  const replacement = await sql`SELECT id FROM mobile_refresh_tokens WHERE token_hash = ${replacementHash} LIMIT 1`;
  await sql`UPDATE mobile_refresh_tokens SET revoked_at = NOW(), last_used_at = NOW(), replaced_by = ${replacement[0].id} WHERE id = ${rows[0].id}`;
  return json(session);
}
