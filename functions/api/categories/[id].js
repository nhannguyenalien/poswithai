import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { validateUuid } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "categories.write");
  if (allowed instanceof Response) return allowed;
  const { id } = context.params;
  const idError = validateUuid(id);
  if (idError) return errorJson("ID danh mục không hợp lệ", 422, "VALIDATION_ERROR", [idError]);
  if (context.request.method === "PUT" || context.request.method === "PATCH") return updateCategory(context, auth, id);
  if (context.request.method === "DELETE") return deleteCategory(context, auth, id);
  return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
}

async function updateCategory({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  if (!body.name?.trim()) return errorJson("Tên danh mục là bắt buộc", 422, "VALIDATION_ERROR", [{ field: "name", rule: "required" }]);
  if (body.parent_id === id) return errorJson("Danh mục không thể là cha của chính nó", 422, "VALIDATION_ERROR");
  const sql = getDb(env);
  const rows = await sql`
    UPDATE categories SET name = ${body.name.trim()}, parent_id = ${body.parent_id || null}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id, name, parent_id
  `;
  return rows.length ? json(rows[0]) : errorJson("Không tìm thấy danh mục", 404, "NOT_FOUND");
}

async function deleteCategory({ env }, { tenantId }, id) {
  const sql = getDb(env);
  const dependencies = await sql`
    SELECT
      (SELECT COUNT(*) FROM products WHERE category_id = ${id} AND tenant_id = ${tenantId}) AS products,
      (SELECT COUNT(*) FROM categories WHERE parent_id = ${id} AND tenant_id = ${tenantId}) AS children
  `;
  if (Number(dependencies[0].products) || Number(dependencies[0].children)) {
    return errorJson("Danh mục đang được sử dụng", 409, "CATEGORY_IN_USE", dependencies[0]);
  }
  const rows = await sql`DELETE FROM categories WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`;
  return rows.length ? json({ deleted: true, id }) : errorJson("Không tìm thấy danh mục", 404, "NOT_FOUND");
}
