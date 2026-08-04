// GET  /api/brands          — danh sách nhãn hiệu
// POST /api/brands          — tạo nhãn hiệu mới
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return getBrands(context, auth);
  if (context.request.method === "POST") return createBrand(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getBrands({ env }, { tenantId }) {
  const sql   = getDb(env);
  const rows  = await sql`
    SELECT id, name, symbol, standard, address, created_at
    FROM brands
    WHERE tenant_id = ${tenantId}
    ORDER BY name ASC
  `;
  return json({ brands: rows });
}

async function createBrand({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { name, symbol, standard, address } = body;
  if (!name?.trim()) return errorJson("Tên nhãn hiệu là bắt buộc", 422);

  const sql = getDb(env);
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const rows = await sql`
      INSERT INTO brands (id, tenant_id, name, symbol, standard, address, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${name.trim()}, ${symbol||null}, ${standard||null}, ${address||null}, ${now}, ${now})
      RETURNING *
    `;
    return json(rows[0], 201);
  } catch (err) {
    if (err.message.includes("unique")) return errorJson("Nhãn hiệu này đã tồn tại", 409);
    return errorJson(err.message, 500);
  }
}