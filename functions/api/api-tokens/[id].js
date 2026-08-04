// DELETE /api/api-tokens/:id — thu hồi 1 API token (đánh dấu revoked_at, không xoá hẳn để
// còn dấu vết lịch sử) — token đã thu hồi không dùng gọi API được nữa ngay lập tức.
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (auth.isApiToken) return errorJson("Chỉ tài khoản đăng nhập mới được quản lý API token", 403);
  if (context.request.method !== "DELETE") return errorJson("Method not allowed", 405);

  const { id } = context.params;
  const sql = getDb(context.env);
  const now = new Date().toISOString();

  const rows = await sql`
    UPDATE api_tokens SET revoked_at = ${now}
    WHERE id = ${id} AND tenant_id = ${auth.tenantId} AND revoked_at IS NULL
    RETURNING id
  `;
  if (!rows.length) return errorJson("Không tìm thấy token này hoặc đã bị thu hồi trước đó", 404);

  return json({ revoked: true });
}
