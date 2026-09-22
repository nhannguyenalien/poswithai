import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, hashPassword, verifyPassword } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (auth.isApiToken) return errorJson("Chỉ có thể đổi mật khẩu từ phiên đăng nhập", 403);

  let body;
  try { body = await context.request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const password = String(body.password || "");
  const confirmation = String(body.password_confirmation || "");
  const currentPassword = String(body.current_password || "");
  if (password.length < 8) return errorJson("Mật khẩu phải có ít nhất 8 ký tự", 422);
  if (password.length > 128) return errorJson("Mật khẩu không được quá 128 ký tự", 422);
  if (password !== confirmation) return errorJson("Mật khẩu nhập lại không khớp", 422);

  const sql = getDb(context.env);
  const users = await sql`
    SELECT password_hash FROM users
    WHERE id = ${auth.userId} AND tenant_id = ${auth.tenantId} AND status = 'active'
    LIMIT 1
  `;
  if (!users.length) return errorJson("Không tìm thấy tài khoản đang hoạt động", 404);
  if (users[0].password_hash && auth.authMethod !== "google") {
    if (!currentPassword) {
      return errorJson("Vui lòng nhập mật khẩu hiện tại", 422);
    }
    if (!(await verifyPassword(currentPassword, users[0].password_hash))) {
      return errorJson("Mật khẩu hiện tại không đúng", 401);
    }
  }

  const passwordHash = await hashPassword(password);
  const rows = await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, updated_at = ${new Date().toISOString()}
    WHERE id = ${auth.userId} AND tenant_id = ${auth.tenantId} AND status = 'active'
    RETURNING id, email
  `;
  if (!rows.length) return errorJson("Không cập nhật được mật khẩu", 404);

  return json({ ok: true, email: rows[0].email });
}
