// GET  /api/gold/types  — danh sách loại vàng
// POST /api/gold/types  — tạo loại vàng mới
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return getTypes(context, auth);
  if (context.request.method === "POST") return createType(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getTypes({ env }, { tenantId }) {
  const sql  = getDb(env);
  const rows = await sql`
    SELECT gt.*,
           gph.buy_price, gph.sell_price, gph.effective_at AS price_updated_at
    FROM gold_types gt
    LEFT JOIN LATERAL (
      SELECT buy_price, sell_price, effective_at
      FROM gold_price_history
      WHERE gold_type_id = gt.id AND tenant_id = ${tenantId}
      ORDER BY effective_at DESC LIMIT 1
    ) gph ON true
    WHERE gt.tenant_id = ${tenantId}
    ORDER BY gt.name
  `;
  return json({ types: rows });
}

async function createType({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }
  const { name, purity } = body;
  if (!name) return errorJson("Tên là bắt buộc", 422);

  const sql = getDb(env);
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = await sql`
    INSERT INTO gold_types (id, tenant_id, name, purity, created_at)
    VALUES (${id}, ${tenantId}, ${name}, ${purity || null}, ${now})
    RETURNING *
  `;
  return json(rows[0], 201);
}
