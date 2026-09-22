import { errorJson, getDb, handleOptions, json } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { validateEnum, validateUuid, validationError } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const permission = context.request.method === "GET" ? "inventory.read" : "inventory.write";
  const allowed = await requirePermission(context, auth, permission);
  if (allowed instanceof Response) return allowed;
  const { id } = context.params;
  const idError = validateUuid(id, "id");
  if (idError) return validationError([idError]);
  if (context.request.method === "GET") return getSupplier(context, auth, id);
  if (context.request.method === "PUT" || context.request.method === "PATCH") return updateSupplier(context, auth, id);
  if (context.request.method === "DELETE") return archiveSupplier(context, auth, id);
  return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
}

async function getSupplier({ env }, { tenantId }, id) {
  const sql = getDb(env);
  const rows = await sql`SELECT id, name, phone, email, tax_code, address, note, status, created_at, updated_at FROM suppliers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
  return rows.length ? json({ supplier: rows[0] }) : errorJson("Không tìm thấy nhà cung cấp", 404, "SUPPLIER_NOT_FOUND");
}

async function updateSupplier({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  const name = body.name?.trim();
  const status = body.status || "active";
  const statusError = validateEnum(status, ["active", "inactive"], "status");
  const errors = [
    ...(!name || name.length > 200 ? [{ field: "name", rule: "length", message: "Tên nhà cung cấp dài từ 1 đến 200 ký tự" }] : []),
    ...(statusError ? [statusError] : []),
  ];
  if (errors.length) return validationError(errors);
  const clean = value => typeof value === "string" && value.trim() ? value.trim() : null;
  const now = new Date().toISOString();
  const sql = getDb(env);
  const rows = await sql`
    UPDATE suppliers SET name = ${name}, phone = ${clean(body.phone)},
      email = ${clean(body.email)}, tax_code = ${clean(body.tax_code)},
      address = ${clean(body.address)}, note = ${clean(body.note)},
      status = ${status}, updated_at = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id, name, phone, email, tax_code, address, note, status, created_at, updated_at
  `;
  return rows.length ? json({ supplier: rows[0] }) : errorJson("Không tìm thấy nhà cung cấp", 404, "SUPPLIER_NOT_FOUND");
}

async function archiveSupplier({ env }, { tenantId }, id) {
  const sql = getDb(env);
  const now = new Date().toISOString();
  const rows = await sql`UPDATE suppliers SET status = 'inactive', updated_at = ${now} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`;
  return rows.length ? json({ archived: true, id }) : errorJson("Không tìm thấy nhà cung cấp", 404, "SUPPLIER_NOT_FOUND");
}
