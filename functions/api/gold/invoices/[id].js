// GET    /api/gold/invoices/:id  — chi tiết hoá đơn
// PUT    /api/gold/invoices/:id  — cập nhật trạng thái
// DELETE /api/gold/invoices/:id  — huỷ hoá đơn
import { getDb, json, errorJson, handleOptions } from "../../../_db.js";
import { requireAuth } from "../../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  const method  = context.request.method;

  if (method === "GET")    return getInvoice(context, auth, id);
  if (method === "PUT")    return updateInvoice(context, auth, id);
  if (method === "DELETE") return cancelInvoice(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function getInvoice({ env }, { tenantId }, id) {
  const sql      = getDb(env);
  const invoices = await sql`
    SELECT gi.*, c.name AS customer_db_name, c.phone AS customer_db_phone
    FROM gold_invoices gi
    LEFT JOIN customers c ON c.id = gi.customer_id
    WHERE gi.id = ${id} AND gi.tenant_id = ${tenantId}
    LIMIT 1
  `;
  if (!invoices.length) return errorJson("Không tìm thấy hoá đơn", 404);

  const items   = await sql`
    SELECT * FROM gold_invoice_items
    WHERE invoice_id = ${id} ORDER BY sort_order
  `;
  const returns = await sql`
    SELECT * FROM gold_invoice_returns
    WHERE invoice_id = ${id} ORDER BY sort_order
  `;

  return json({ invoice: invoices[0], items, returns });
}

async function updateInvoice({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { status, notes } = body;
  if (!["completed", "cancelled"].includes(status)) {
    return errorJson("Status phải là completed hoặc cancelled", 422);
  }

  const sql  = getDb(env);
  const now  = new Date().toISOString();
  const rows = await sql`
    UPDATE gold_invoices
    SET status = ${status},
        notes  = COALESCE(${notes || null}, notes),
        updated_at = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id, invoice_number, status
  `;
  if (!rows.length) return errorJson("Không tìm thấy hoá đơn", 404);
  return json(rows[0]);
}

async function cancelInvoice({ env }, { tenantId }, id) {
  const sql  = getDb(env);
  const now  = new Date().toISOString();
  const rows = await sql`
    UPDATE gold_invoices
    SET status = 'cancelled', updated_at = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId} AND status != 'cancelled'
    RETURNING id, invoice_number
  `;
  if (!rows.length) return errorJson("Không tìm thấy hoặc đã huỷ rồi", 404);
  return json({ success: true, ...rows[0] });
}
