// DELETE /api/debt-adjustments/:id — xoá 1 bút toán công nợ nhập tay (nhập nhầm/sửa lại).
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "DELETE") return errorJson("Method not allowed", 405);

  const { id } = context.params;
  const sql = getDb(context.env);

  const rows = await sql`
    DELETE FROM customer_debt_adjustments
    WHERE id = ${id} AND tenant_id = ${auth.tenantId}
    RETURNING id
  `;
  if (!rows.length) return errorJson("Không tìm thấy bút toán công nợ này", 404);

  return json({ deleted: true });
}
