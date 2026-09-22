import { errorJson, getDb, handleOptions, json } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { pageMeta, parsePagination, validateEnum, validationError } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const permission = context.request.method === "GET" ? "inventory.read" : "inventory.write";
  const allowed = await requirePermission(context, auth, permission);
  if (allowed instanceof Response) return allowed;
  if (context.request.method === "GET") return list(context, auth);
  if (context.request.method === "POST") return create(context, auth);
  return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
}

async function list({ request, env }, { tenantId }) {
  const url = new URL(request.url);
  const pagination = parsePagination(url, { defaultLimit: 50, maxLimit: 100 });
  if (pagination.errors.length) return validationError(pagination.errors);
  const search = url.searchParams.get("search")?.trim() || "";
  const like = search ? `%${search}%` : "";
  const { limit, offset } = pagination;
  const sql = getDb(env);
  const [count, rows] = await Promise.all([
    sql`SELECT COUNT(*) AS total FROM suppliers WHERE tenant_id = ${tenantId} AND status = 'active' AND (${like} = '' OR name ILIKE ${like} OR phone ILIKE ${like} OR tax_code ILIKE ${like})`,
    sql`SELECT id, name, phone, email, tax_code, address, note, status, created_at, updated_at FROM suppliers WHERE tenant_id = ${tenantId} AND status = 'active' AND (${like} = '' OR name ILIKE ${like} OR phone ILIKE ${like} OR tax_code ILIKE ${like}) ORDER BY name LIMIT ${limit} OFFSET ${offset}`,
  ]);
  return json({ suppliers: rows, pagination: pageMeta({ limit, offset, returned: rows.length, total: count[0].total }) });
}

async function create({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  const name = body.name?.trim();
  const clean = value => typeof value === "string" && value.trim() ? value.trim() : null;
  const statusError = validateEnum(body.status || "active", ["active", "inactive"], "status");
  const errors = [
    ...(!name || name.length > 200 ? [{ field: "name", rule: "length", message: "Tên nhà cung cấp dài từ 1 đến 200 ký tự" }] : []),
    ...(statusError ? [statusError] : []),
  ];
  if (errors.length) return validationError(errors);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sql = getDb(env);
  const rows = await sql`INSERT INTO suppliers (id, tenant_id, name, phone, email, tax_code, address, note, status, created_at, updated_at) VALUES (${id}, ${tenantId}, ${name}, ${clean(body.phone)}, ${clean(body.email)}, ${clean(body.tax_code)}, ${clean(body.address)}, ${clean(body.note)}, ${body.status || "active"}, ${now}, ${now}) RETURNING id, name, phone, email, tax_code, address, note, status`;
  return json({ supplier: rows[0] }, 201);
}
