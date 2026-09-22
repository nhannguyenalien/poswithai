import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { sha256Hex } from "../../_auth.js";

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  if (body.refresh_token) {
    const sql = getDb(env);
    await sql`UPDATE mobile_refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = ${await sha256Hex(body.refresh_token)}`;
  }
  return json({ revoked: true });
}
