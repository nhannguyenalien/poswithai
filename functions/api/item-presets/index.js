// GET  /api/item-presets?kind=custom|tradein&search=... — danh sách mẫu hàng đã lưu, để
// chọn nhanh lại cho hoá đơn nháp thay vì gõ lại tên/tuổi/trọng lượng/công mỗi lần.
// POST /api/item-presets — lưu 1 mẫu mới (hoặc cập nhật nếu đã có mẫu cùng tên+loại).
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return listPresets(context, auth);
  if (context.request.method === "POST") return savePreset(context, auth);
  return errorJson("Method not allowed", 405);
}

async function listPresets({ request, env }, { tenantId }) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  const search = (url.searchParams.get("search") || "").trim();
  if (!kind) return errorJson("Thiếu tham số kind", 422);

  const sql = getDb(env);
  const rows = await sql`
    SELECT id, name, purity, gross_weight, stone_weight, price
    FROM item_presets
    WHERE tenant_id = ${tenantId} AND kind = ${kind}
    ORDER BY updated_at DESC
  `;

  if (!search) return json({ presets: rows.slice(0, 50) });

  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const term = norm(search);
  const filtered = rows.filter(r => norm(r.name).includes(term)).slice(0, 50);
  return json({ presets: filtered });
}

async function savePreset({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const kind = body.kind;
  const name = (body.name || "").trim();
  if (!["custom", "tradein"].includes(kind)) return errorJson("kind phải là 'custom' hoặc 'tradein'", 422);
  if (!name) return errorJson("Tên hàng là bắt buộc", 422);

  const purity      = parseFloat(body.purity) || 0;
  const grossWeight = parseFloat(body.gross_weight) || 0;
  const stoneWeight = parseFloat(body.stone_weight) || 0;
  const price       = parseInt(body.price) || 0;

  const sql = getDb(env);
  const now = new Date().toISOString();

  // Trùng tên + loại (không phân biệt hoa/thường) thì cập nhật số liệu mới nhất thay vì
  // tạo thêm 1 mẫu trùng lặp — tên hàng hay lặp lại chính là lý do cần tính năng này.
  const existing = await sql`
    SELECT id FROM item_presets WHERE tenant_id = ${tenantId} AND kind = ${kind} AND LOWER(name) = LOWER(${name}) LIMIT 1
  `;

  if (existing.length) {
    await sql`
      UPDATE item_presets SET purity = ${purity}, gross_weight = ${grossWeight},
             stone_weight = ${stoneWeight}, price = ${price}, updated_at = ${now}
      WHERE id = ${existing[0].id}
    `;
    return json({ id: existing[0].id, updated: true });
  }

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO item_presets (id, tenant_id, kind, name, purity, gross_weight, stone_weight, price, created_at, updated_at)
    VALUES (${id}, ${tenantId}, ${kind}, ${name}, ${purity}, ${grossWeight}, ${stoneWeight}, ${price}, ${now}, ${now})
  `;
  return json({ id, updated: false }, 201);
}
