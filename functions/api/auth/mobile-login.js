import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { verifyPassword } from "../../_auth.js";
import { createMobileSession } from "../../_mobile-session.js";

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  if (!body.email || !body.password) return errorJson("Email và mật khẩu là bắt buộc", 422, "VALIDATION_ERROR");
  const sql = getDb(env);
  const users = await sql`
    SELECT id, tenant_id, name, email, password_hash, status FROM users
    WHERE LOWER(email) = ${body.email.toLowerCase().trim()} LIMIT 1
  `;
  if (!users.length || !users[0].password_hash || !(await verifyPassword(body.password, users[0].password_hash))) {
    return errorJson("Email hoặc mật khẩu không đúng", 401, "CREDENTIALS_INVALID");
  }
  if (users[0].status !== "active") return errorJson("Tài khoản đã bị khóa", 403, "ACCOUNT_DISABLED");
  return json({ ...(await createMobileSession(sql, env, users[0])), user: { id: users[0].id, name: users[0].name, email: users[0].email } });
}
