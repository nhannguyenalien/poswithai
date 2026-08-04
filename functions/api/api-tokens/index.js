// GET  /api/api-tokens — danh sách API token của tenant (không bao giờ trả token thật,
//      chỉ trả token_prefix để nhận diện).
// POST /api/api-tokens — tạo 1 API token mới, trả về token THẬT đúng 1 lần duy nhất.
//
// Cả 2 route chỉ cho phép gọi bằng JWT phiên đăng nhập (không cho gọi bằng chính 1 API
// token khác) — tránh trường hợp 1 token bị lộ có thể tự sinh thêm token mới không giới hạn.
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, generateApiToken } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (auth.isApiToken) return errorJson("Chỉ tài khoản đăng nhập mới được quản lý API token", 403);

  if (context.request.method === "GET")  return listTokens(context, auth);
  if (context.request.method === "POST") return createToken(context, auth);
  return errorJson("Method not allowed", 405);
}

async function listTokens({ env }, { tenantId }) {
  const sql = getDb(env);
  const rows = await sql`
    SELECT id, name, token_prefix, created_at, last_used_at, revoked_at, rate_limit_per_minute
    FROM api_tokens WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
  `;
  return json({ tokens: rows });
}

async function createToken({ request, env }, { tenantId, userId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const name = (body.name || "").trim();
  if (!name) return errorJson("Cần đặt tên cho token (VD: 'Tích hợp kế toán')", 422);

  // Giới hạn request/phút — mặc định 120 (~2 request/giây), đủ rộng rãi cho tích hợp bình
  // thường mà vẫn chặn được spam. Cho phép chỉnh 1–6000 nếu bên tích hợp cần khác đi.
  let rateLimit = parseInt(body.rate_limit_per_minute);
  if (!Number.isFinite(rateLimit) || rateLimit <= 0) rateLimit = 120;
  rateLimit = Math.min(6000, Math.max(1, rateLimit));

  const { token, hash, prefix } = await generateApiToken();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const sql = getDb(env);
  await sql`
    INSERT INTO api_tokens (id, tenant_id, name, token_hash, token_prefix, created_by, created_at, rate_limit_per_minute)
    VALUES (${id}, ${tenantId}, ${name}, ${hash}, ${prefix}, ${userId}, ${now}, ${rateLimit})
  `;

  // "token" chỉ trả về đúng lần này — sau đó DB chỉ còn giữ hash, không ai xem lại được.
  return json({ id, name, token, prefix, created_at: now, rate_limit_per_minute: rateLimit }, 201);
}
