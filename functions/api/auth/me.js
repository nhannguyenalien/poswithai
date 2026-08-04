// functions/api/auth/me.js
// GET /api/auth/me — thông tin user đang đăng nhập
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const sql   = getDb(context.env);
  const users = await sql`
    SELECT u.id, u.name, u.email, u.avatar_url, u.status,
           r.name        AS role_name,
           r.permissions AS role_permissions,
           t.id          AS tenant_id,
           t.name        AS tenant_name,
           t.slug        AS tenant_slug
    FROM users u
    LEFT JOIN roles   r ON r.id = u.role_id
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.id = ${auth.userId}
    LIMIT 1
  `;
  if (!users.length) return errorJson("Không tìm thấy user", 404);
  return json(users[0]);
}
