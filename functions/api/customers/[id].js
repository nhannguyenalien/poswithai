import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { validateUuid, validationError } from "../../_validation.js";
import { syncCustomerSupportContext } from "../../_support-chat.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  const idError = validateUuid(id, "id");
  if (idError) return validationError([idError]);
  const permission = context.request.method === "GET" ? "customers.read" : "customers.write";
  const allowed = await requirePermission(context, auth, permission);
  if (allowed instanceof Response) return allowed;
  if (context.request.method === "GET") return getCustomer(context, auth, id);
  if (context.request.method === "PUT") return updateCustomer(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function getCustomer({ env }, { tenantId }, id) {
  const sql = getDb(env);

  const customers = await sql`
    SELECT * FROM customers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
  `;
  if (!customers.length) return errorJson("Không tìm thấy khách hàng", 404);

  const orders = await sql`
    SELECT id, order_number, total, status, created_at
    FROM orders WHERE customer_id = ${id}
    ORDER BY created_at DESC LIMIT 20
  `;

  return json({ customer: customers[0], orders });
}

async function updateCustomer({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const {
    name, phone, email, id_card, address, is_business, tax_code,
    dob, id_issue_date, bank_name, bank_account,
  } = body;
  const sql = getDb(env);
  const now = new Date().toISOString();

  // is_business là boolean nên không thể dùng "|| null" như các cột text khác (false
  // sẽ bị coi là falsy và biến mất) — dùng "??" để chỉ giữ nguyên giá trị cũ khi client
  // thực sự không gửi field này (undefined), còn true/false đều được ghi đè bình thường.
  const rows = await sql`
    UPDATE customers
    SET name           = COALESCE(${name    || null}, name),
        phone          = COALESCE(${phone   || null}, phone),
        email          = COALESCE(${email   || null}, email),
        id_card        = COALESCE(${id_card || null}, id_card),
        address        = COALESCE(${address || null}, address),
        is_business    = COALESCE(${is_business ?? null}, is_business),
        tax_code       = COALESCE(${tax_code || null}, tax_code),
        dob            = COALESCE(${dob || null}, dob),
        id_issue_date  = COALESCE(${id_issue_date || null}, id_issue_date),
        bank_name      = COALESCE(${bank_name || null}, bank_name),
        bank_account   = COALESCE(${bank_account || null}, bank_account),
        updated_at     = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id, name, phone, email, id_card, address, is_business, tax_code,
              dob, id_issue_date, bank_name, bank_account
  `;

  if (!rows.length) return errorJson("Không tìm thấy khách hàng", 404);
  try { await syncCustomerSupportContext(sql, env, tenantId, id); }
  catch (err) { console.error("Không đồng bộ được dữ liệu khách sau khi cập nhật:", err.message); }
  return json(rows[0]);
}
