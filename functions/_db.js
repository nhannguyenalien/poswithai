import { neon } from "@neondatabase/serverless";

/**
 * Trả về Neon SQL client.
 * Dùng tagged-template — tự parameterize, không bao giờ bị SQL injection.
 *
 * Ví dụ:
 *   const sql = getDb(env);
 *   const rows = await sql`SELECT * FROM products WHERE tenant_id = ${tenantId}`;
 *   // rows là array of plain objects, ví dụ: [{ id: '...', name: '...' }]
 */
export function getDb(env) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL chưa được set. Chạy: wrangler pages secret put DATABASE_URL");
  }
  return neon(env.DATABASE_URL);
}

/**
 * Trả về Response JSON chuẩn.
 * Dùng cho mọi response thành công.
 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // cho phép gọi từ browser local khi dev
    },
  });
}

/**
 * Trả về Response lỗi dạng { error: message }.
 * status mặc định 400.
 */
export function errorJson(message, status = 400) {
  return json({ error: message }, status);
}

/**
 * Xử lý CORS preflight (OPTIONS request).
 * Gọi ở đầu mỗi route nếu cần hỗ trợ gọi từ domain khác.
 *
 * Ví dụ trong route:
 *   const preflight = handleOptions(request);
 *   if (preflight) return preflight;
 */
export function handleOptions(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  return null;
}
