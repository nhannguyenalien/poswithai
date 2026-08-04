// POST /api/auth/login  — Đăng nhập bằng email + mật khẩu
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { createToken, verifyPassword } from "../../_auth.js";

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const { email, password } = body;
  if (!email || !password) return errorJson("Email và mật khẩu là bắt buộc", 422);

  const sql   = getDb(env);
  const users = await sql`
    SELECT u.id, u.tenant_id, u.name, u.email, u.password_hash, u.status
    FROM users u
    WHERE LOWER(u.email) = ${email.toLowerCase().trim()}
    LIMIT 1
  `;

  if (!users.length) return errorJson("Email hoặc mật khẩu không đúng", 401);

  const user = users[0];
  if (user.status !== "active") return errorJson("Tài khoản đã bị khóa", 403);
  if (!user.password_hash)      return errorJson("Tài khoản này chỉ đăng nhập bằng Google", 400);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return errorJson("Email hoặc mật khẩu không đúng", 401);

  const token = await createToken(
    { userId: user.id, tenantId: user.tenant_id, email: user.email },
    env.JWT_SECRET
  );

  return json({ token, user: { id: user.id, name: user.name, email: user.email } });
}