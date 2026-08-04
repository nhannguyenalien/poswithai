// GET /api/backup/export — xuất toàn bộ dữ liệu nghiệp vụ của tenant hiện tại thành 1 file
// JSON duy nhất (tải về trình duyệt). Dùng sql() dạng gọi hàm thường (không phải tagged
// template) vì cần dựng câu SQL với TÊN BẢNG động — driver Neon hỗ trợ cả 2 cách gọi, tên
// bảng luôn lấy từ BACKUP_TABLES cố định (không bao giờ từ input người dùng) nên an toàn.
import { getDb, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";
import { BACKUP_TABLES, BACKUP_VERSION } from "./_tables.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);

  const backup = await buildBackup(getDb(context.env), auth.tenantId);

  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="pos-backup-${auth.tenantId}-${new Date().toISOString().slice(0,10)}.json"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function buildBackup(sql, tenantId) {
  const data = {};
  const idSets = {}; // table name -> Set(id đã export) — dùng để lọc bảng con theo bảng cha

  for (const t of BACKUP_TABLES) {
    let rows;
    if (t.tenantFilter) {
      rows = await sql(`SELECT * FROM ${t.name} WHERE tenant_id = $1`, [tenantId]);
    } else {
      const parentIds = [...(idSets[t.parentTable] || [])];
      rows = parentIds.length
        ? await sql(`SELECT * FROM ${t.name} WHERE ${t.parentKey} = ANY($1)`, [parentIds])
        : [];
    }
    data[t.name] = rows;
    idSets[t.name] = new Set(rows.map(r => r.id).filter(Boolean));
  }

  return {
    version: BACKUP_VERSION,
    tenant_id: tenantId,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(BACKUP_TABLES.map(t => [t.name, data[t.name].length])),
    data,
  };
}
