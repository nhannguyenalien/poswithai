// POST /api/backup/import — khôi phục dữ liệu từ file JSON đã xuất bởi /api/backup/export.
// Chỉ cho gọi bằng JWT phiên đăng nhập thật (không cho API token) vì đây là thao tác có
// thể GHI ĐÈ dữ liệu đang có — rủi ro cao hơn hẳn các API khác.
//
// An toàn dữ liệu:
//   - tenant_id của MỌI dòng luôn bị ép về tenant đang đăng nhập, bất kể file backup ghi
//     gì — chống trường hợp tải nhầm/cố ý file backup của tenant khác lên rồi ghi đè chéo.
//   - Dùng UPSERT (ON CONFLICT id DO UPDATE) nên khôi phục lặp lại nhiều lần vẫn an toàn
//     (idempotent), không tạo dòng trùng lặp.
//   - Không đụng tới bảng users/tenants/api_tokens — xem lý do trong _tables.js.
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";
import { BACKUP_TABLES } from "./_tables.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (auth.isApiToken) return errorJson("Chỉ tài khoản đăng nhập mới được khôi phục dữ liệu (không dùng API token)", 403);
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); } catch { return errorJson("File backup không hợp lệ (không đọc được JSON)", 400); }

  if (!body || typeof body.data !== "object") {
    return errorJson("File backup không đúng định dạng (thiếu trường 'data')", 422);
  }

  const sql = getDb(context.env);
  const summary = await restoreBackup(sql, auth.tenantId, body.data);

  return json({ restored: true, summary });
}

async function restoreBackup(sql, tenantId, data) {
  const summary = {};

  for (const t of BACKUP_TABLES) {
    const rows = Array.isArray(data[t.name]) ? data[t.name] : [];
    let ok = 0;
    const errors = [];

    for (const original of rows) {
      const row = { ...original };
      if (t.tenantFilter) row.tenant_id = tenantId; // không bao giờ tin tenant_id trong file
      if (t.selfParentCol) row[t.selfParentCol] = null; // categories: gắn lại parent_id ở bước 2

      const cols = Object.keys(row);
      if (!cols.length) continue;
      const values = cols.map(c => row[c]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
      const updateSet = cols.filter(c => c !== t.pk).map(c => `"${c}" = EXCLUDED."${c}"`).join(",");
      const colList = cols.map(c => `"${c}"`).join(",");

      const queryText = updateSet
        ? `INSERT INTO ${t.name} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${t.pk}") DO UPDATE SET ${updateSet}`
        : `INSERT INTO ${t.name} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${t.pk}") DO NOTHING`;

      try {
        await sql(queryText, values);
        ok++;
      } catch (err) {
        if (errors.length < 5) errors.push(err.message);
      }
    }

    summary[t.name] = { restored: ok, total: rows.length, errors: errors.length ? errors : undefined };
  }

  // Bước 2: gắn lại categories.parent_id (bỏ trống ở bước 1 để tránh lỗi FK tự tham chiếu
  // khi danh mục cha chưa kịp tồn tại lúc insert danh mục con).
  const categoryRows = Array.isArray(data.categories) ? data.categories : [];
  for (const c of categoryRows) {
    if (!c.parent_id) continue;
    try {
      await sql(`UPDATE categories SET parent_id = $1 WHERE id = $2 AND tenant_id = $3`, [c.parent_id, c.id, tenantId]);
    } catch { /* bỏ qua — không chặn cả bản khôi phục chỉ vì 1 liên kết cha/con lỗi */ }
  }

  return summary;
}
