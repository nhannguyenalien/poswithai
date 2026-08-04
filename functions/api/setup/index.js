// functions/api/setup/index.js
// POST /api/setup — Tạo tenant + gắn Google account, chỉ dùng được với setupPending token
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { verifyToken, createToken, hashPassword } from "../../_auth.js";

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorJson("Method not allowed", 405);

  // Đọc temp token (setupPending) từ Authorization header
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return errorJson("Thiếu token", 401);

  const payload = await verifyToken(header.slice(7), env.JWT_SECRET);
  if (!payload)              return errorJson("Token không hợp lệ hoặc hết hạn", 401);
  if (!payload.setupPending) return errorJson("Token này không phải setup token", 403);
  if (!payload.googleId)     return errorJson("Thiếu googleId trong token", 400);

  let body;
  try { body = await request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const { tenant_name, tenant_slug, admin_password, } = body;
  if (!tenant_name || !tenant_slug) return errorJson("Tên tiệm và slug là bắt buộc", 422);

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(tenant_slug)) {
    return errorJson("Slug chỉ được dùng chữ thường, số và dấu gạch ngang", 422);
  }

  const sql = getDb(env);

  // Kiểm tra slug trùng
  const existing = await sql`SELECT id FROM tenants WHERE slug = ${tenant_slug} LIMIT 1`;
  if (existing.length) return errorJson("Slug đã tồn tại, chọn slug khác", 409);

  // Kiểm tra google_id đã setup chưa (double-submit protection)
  const existingUser = await sql`SELECT id FROM users WHERE google_id = ${payload.googleId} LIMIT 1`;
  if (existingUser.length) return errorJson("Tài khoản Google này đã được setup", 409);

  const now      = new Date().toISOString();
  const tenantId = crypto.randomUUID();
  const roleId   = crypto.randomUUID();
  const userId   = crypto.randomUUID();

  // Tạo tenant + role + user + danh mục mặc định + channel + settings trong CÙNG 1
  // transaction — nếu 1 bước lỗi giữa chừng thì rollback hết, tránh để lại tenant
  // "nửa vời" (vd thiếu settings/channel) mà lần đăng nhập sau lại bị coi là đã setup xong
  // (do google_id đã tồn tại trong bảng users) nên không tự sửa được.
  const pwHash = admin_password ? await hashPassword(admin_password) : null;
  const defaultCategories = ["Nhẫn", "Dây chuyền", "Lắc tay", "Bông tai", "Mặt dây chuyền", "Khác"];
  const defaultSettings = [
    ["shop_name",           tenant_name],
    ["low_stock_threshold", "5"],
    ["currency",            "VND"],
  ];

  try {
    await sql.transaction([
      sql`
        INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
        VALUES (${tenantId}, ${tenant_name}, ${tenant_slug}, 'active', ${now}, ${now})
      `,
      sql`
        INSERT INTO roles (id, tenant_id, name, permissions, created_at)
        VALUES (${roleId}, ${tenantId}, 'owner', '["*"]', ${now})
      `,
      sql`
        INSERT INTO users (id, tenant_id, role_id, name, email, google_id, avatar_url,
                           password_hash, status, created_at, updated_at)
        VALUES (${userId}, ${tenantId}, ${roleId},
                ${payload.name || payload.email}, ${payload.email},
                ${payload.googleId}, ${payload.avatar || null},
                ${pwHash}, 'active', ${now}, ${now})
      `,
      ...defaultCategories.map(name => sql`
        INSERT INTO categories (id, tenant_id, name, created_at)
        VALUES (${crypto.randomUUID()}, ${tenantId}, ${name}, ${now})
      `),
      sql`
        INSERT INTO channels (id, tenant_id, name, type, status, created_at)
        VALUES (${crypto.randomUUID()}, ${tenantId}, 'Cửa hàng', 'pos', 'active', ${now})
      `,
      ...defaultSettings.map(([key, value]) => sql`
        INSERT INTO settings (id, tenant_id, key, value, updated_at)
        VALUES (${crypto.randomUUID()}, ${tenantId}, ${key}, ${value}, ${now})
      `),
    ]);
  } catch (err) {
    return errorJson("Không tạo được tiệm, vui lòng thử lại: " + err.message, 500);
  }

  // Tạo full JWT để đăng nhập luôn
  const token = await createToken(
    { userId, tenantId, email: payload.email },
    env.JWT_SECRET
  );

  return json({ token, tenant_name, redirect: "/dashboard.html" }, 201);
}