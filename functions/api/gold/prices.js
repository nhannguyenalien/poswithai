// GET  /api/gold/prices         — giá mới nhất tất cả loại
// GET  /api/gold/prices?date=   — giá theo ngày
// POST /api/gold/prices         — cập nhật giá mới
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return getPrices(context, auth);
  if (context.request.method === "POST") return createPrice(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getPrices({ request, env }, { tenantId }) {
  const date = new URL(request.url).searchParams.get("date") || new Date().toISOString();
  const sql  = getDb(env);

  // Lấy giá mới nhất của từng loại vàng tính đến ngày cần xem
  const rows = await sql`
    SELECT DISTINCT ON (gt.id)
           gt.id AS gold_type_id, gt.name, gt.purity,
           gph.id AS price_id, gph.buy_price, gph.sell_price, gph.effective_at
    FROM gold_types gt
    LEFT JOIN gold_price_history gph
           ON gph.gold_type_id = gt.id
          AND gph.tenant_id = ${tenantId}
          AND gph.effective_at <= ${date}
    WHERE gt.tenant_id = ${tenantId}
    ORDER BY gt.id, gph.effective_at DESC
  `;

  return json({ prices: rows, as_of: date });
}

async function createPrice({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { gold_type_id, buy_price, sell_price, effective_at } = body;
  if (!gold_type_id || !sell_price) return errorJson("gold_type_id và sell_price là bắt buộc", 422);

  const sql = getDb(env);

  // Kiểm tra loại vàng thuộc tenant
  const types = await sql`SELECT id FROM gold_types WHERE id = ${gold_type_id} AND tenant_id = ${tenantId} LIMIT 1`;
  if (!types.length) return errorJson("Không tìm thấy loại vàng", 404);

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = await sql`
    INSERT INTO gold_price_history (id, tenant_id, gold_type_id, buy_price, sell_price, effective_at, created_at)
    VALUES (${id}, ${tenantId}, ${gold_type_id},
            ${buy_price || sell_price}, ${sell_price},
            ${effective_at || now}, ${now})
    RETURNING *
  `;
  return json(rows[0], 201);
}
