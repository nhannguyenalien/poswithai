import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import {
  pageMeta,
  parseDateRange,
  parsePagination,
  validateEnum,
  validateInteger,
  validateUuid,
  validationError,
} from "../../_validation.js";
import {
  findIdempotency,
  isIdempotencyUniqueViolation,
  parseIdempotency,
} from "../../_idempotency.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const permission = context.request.method === "GET" ? "inventory.read" : "inventory.write";
  const allowed = await requirePermission(context, auth, permission);
  if (allowed instanceof Response) return allowed;
  if (context.request.method === "GET") return getTransactions(context, auth);
  if (context.request.method === "POST") return createTransaction(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getTransactions({ request, env }, { tenantId }) {
  const url = new URL(request.url);
  const pagination = parsePagination(url, { defaultLimit: 30, maxLimit: 100 });
  const range = parseDateRange(url);
  const type = url.searchParams.get("type") || "";
  const typeError = validateEnum(type, ["IN", "OUT", "ADJUST"], "type", { optional: true });
  const errors = [...pagination.errors, ...range.errors, ...(typeError ? [typeError] : [])];
  if (errors.length) return validationError(errors);

  const today = url.searchParams.get("date") === "today";
  const search = url.searchParams.get("search")?.trim() || "";
  const searchLike = search ? `%${search}%` : "";
  const fromTs = range.from ? `${range.from}T00:00:00.000Z` : "";
  const toTs = range.to ? `${range.to}T23:59:59.999Z` : "";
  const { limit, offset } = pagination;
  const sql = getDb(env);
  const [countRows, rows] = await Promise.all([
    sql`
      SELECT COUNT(*) AS total
      FROM inventory_transactions it
      JOIN product_variants pv ON pv.id = it.product_variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE it.tenant_id = ${tenantId}
        AND (${type} = '' OR it.type = ${type})
        AND (${!today} OR DATE(it.created_at) = CURRENT_DATE)
        AND (${fromTs} = '' OR it.created_at >= ${fromTs})
        AND (${toTs} = '' OR it.created_at <= ${toTs})
        AND (${searchLike} = '' OR p.name ILIKE ${searchLike} OR pv.sku ILIKE ${searchLike} OR pv.barcode ILIKE ${searchLike})
    `,
    sql`
      SELECT it.id, it.type, it.quantity, it.unit_cost, it.total_cost, it.note,
             it.created_at, pv.id AS variant_id, pv.sku, pv.barcode,
             p.name AS product_name, u.name AS created_by_name
      FROM inventory_transactions it
      JOIN product_variants pv ON pv.id = it.product_variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN users u ON u.id = it.created_by
      WHERE it.tenant_id = ${tenantId}
        AND (${type} = '' OR it.type = ${type})
        AND (${!today} OR DATE(it.created_at) = CURRENT_DATE)
        AND (${fromTs} = '' OR it.created_at >= ${fromTs})
        AND (${toTs} = '' OR it.created_at <= ${toTs})
        AND (${searchLike} = '' OR p.name ILIKE ${searchLike} OR pv.sku ILIKE ${searchLike} OR pv.barcode ILIKE ${searchLike})
      ORDER BY it.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `,
  ]);
  return json({
    transactions: rows.map(normalizeTransaction),
    pagination: pageMeta({ limit, offset, returned: rows.length, total: countRows[0].total }),
  });
}

async function createTransaction({ request, env }, { tenantId, userId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  const { product_variant_id: variantId, type, quantity, unit_cost: unitCost = null, note = null, reason = null } = body;
  const errors = [
    validateUuid(variantId, "product_variant_id"),
    validateEnum(type, ["IN", "OUT", "ADJUST"], "type"),
    validateInteger(quantity, "quantity", { min: type === "ADJUST" ? 0 : 1, max: 1000000 }),
    validateInteger(unitCost, "unit_cost", { min: 0, max: Number.MAX_SAFE_INTEGER, optional: true }),
  ].filter(Boolean);
  if (errors.length) return validationError(errors);

  const idempotency = await parseIdempotency(request, "inventory.create", body);
  if (idempotency.response) return idempotency.response;
  const sql = getDb(env);
  const replay = await findIdempotency(sql, tenantId, "inventory.create", idempotency.key, idempotency.hash);
  if (replay) return replay;
  const variants = await sql`SELECT id FROM product_variants WHERE id = ${variantId} AND tenant_id = ${tenantId} LIMIT 1`;
  if (!variants.length) return errorJson("Không tìm thấy variant", 404, "VARIANT_NOT_FOUND");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const totalCost = unitCost === null ? null : unitCost * quantity;
  if (totalCost !== null && !Number.isSafeInteger(totalCost)) {
    return validationError([{ field: "total_cost", message: "Tổng giá vốn vượt giới hạn số nguyên an toàn" }]);
  }
  let stockSql;
  if (type === "OUT") {
    stockSql = sql`SELECT decrement_stock_or_fail(${variantId}, ${tenantId}, ${quantity}, ${now}) AS qty`;
  } else if (type === "IN") {
    stockSql = sql`INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at) VALUES (${variantId}, ${tenantId}, ${quantity}, ${now}) ON CONFLICT (product_variant_id) DO UPDATE SET qty = stock_snapshots.qty + ${quantity}, updated_at = ${now} RETURNING qty`;
  } else {
    stockSql = sql`INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at) VALUES (${variantId}, ${tenantId}, ${quantity}, ${now}) ON CONFLICT (product_variant_id) DO UPDATE SET qty = ${quantity}, updated_at = ${now} RETURNING qty`;
  }

  try {
    const result = await sql.transaction([
      sql`INSERT INTO api_idempotency_keys (id, tenant_id, operation, idempotency_key, request_hash, created_at, expires_at) VALUES (${crypto.randomUUID()}, ${tenantId}, 'inventory.create', ${idempotency.key}, ${idempotency.hash}, ${now}, ${expiresAt})`,
      stockSql,
      sql`INSERT INTO inventory_transactions (id, tenant_id, product_variant_id, type, quantity, unit_cost, total_cost, reference_type, note, created_by, created_at) VALUES (${id}, ${tenantId}, ${variantId}, ${type}, ${quantity}, ${unitCost}, ${totalCost}, 'manual', ${note}, ${userId}, ${now})`,
      ...(type === "ADJUST" && reason ? [sql`INSERT INTO stock_adjustments (id, tenant_id, inventory_transaction_id, reason, created_at) VALUES (${crypto.randomUUID()}, ${tenantId}, ${id}, ${reason}, ${now})`] : []),
      sql`UPDATE api_idempotency_keys SET response_status = 201, response_body = jsonb_build_object('transaction_id', ${id}, 'new_qty', (SELECT qty FROM stock_snapshots WHERE product_variant_id = ${variantId} AND tenant_id = ${tenantId})) WHERE tenant_id = ${tenantId} AND operation = 'inventory.create' AND idempotency_key = ${idempotency.key}`,
    ], { isolationLevel: "Serializable" });
    const stockResult = result[1][0];
    return json({ transaction_id: id, new_qty: Number(stockResult.qty) }, 201, { "Idempotency-Key": idempotency.key });
  } catch (error) {
    if (isIdempotencyUniqueViolation(error)) return await findIdempotency(sql, tenantId, "inventory.create", idempotency.key, idempotency.hash);
    if ((error?.message || "").includes("INSUFFICIENT_STOCK")) return errorJson("Không đủ tồn kho", 409, "INSUFFICIENT_STOCK");
    console.error("Không thể ghi giao dịch kho:", error);
    return errorJson("Không thể cập nhật tồn kho", 500, "INVENTORY_TRANSACTION_FAILED");
  }
}

function normalizeTransaction(row) {
  return {
    ...row,
    quantity: Number(row.quantity || 0),
    unit_cost: row.unit_cost === null ? null : Number(row.unit_cost),
    total_cost: row.total_cost === null ? null : Number(row.total_cost),
  };
}
