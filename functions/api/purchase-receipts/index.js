import { errorJson, getDb, handleOptions, json } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { pageMeta, parseDateRange, parsePagination, validateInteger, validateUuid, validationError } from "../../_validation.js";
import { findIdempotency, isIdempotencyUniqueViolation, parseIdempotency } from "../../_idempotency.js";

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
  const pagination = parsePagination(url, { defaultLimit: 30, maxLimit: 100 });
  const range = parseDateRange(url);
  const errors = [...pagination.errors, ...range.errors];
  if (errors.length) return validationError(errors);
  const { limit, offset } = pagination;
  const from = range.from ? `${range.from}T00:00:00.000Z` : "";
  const to = range.to ? `${range.to}T23:59:59.999Z` : "";
  const sql = getDb(env);
  const [count, rows] = await Promise.all([
    sql`SELECT COUNT(*) AS total FROM purchase_receipts WHERE tenant_id = ${tenantId} AND (${from} = '' OR received_at >= ${from}) AND (${to} = '' OR received_at <= ${to})`,
    sql`SELECT pr.id, pr.receipt_no, pr.status, pr.total_amount, pr.note, pr.received_at, s.id AS supplier_id, s.name AS supplier_name, COUNT(pri.id) AS item_count FROM purchase_receipts pr LEFT JOIN suppliers s ON s.id = pr.supplier_id LEFT JOIN purchase_receipt_items pri ON pri.purchase_receipt_id = pr.id WHERE pr.tenant_id = ${tenantId} AND (${from} = '' OR pr.received_at >= ${from}) AND (${to} = '' OR pr.received_at <= ${to}) GROUP BY pr.id, s.id, s.name ORDER BY pr.received_at DESC LIMIT ${limit} OFFSET ${offset}`,
  ]);
  return json({ receipts: rows.map(row => ({ ...row, total_amount: Number(row.total_amount), item_count: Number(row.item_count) })), pagination: pageMeta({ limit, offset, returned: rows.length, total: count[0].total }) });
}

async function create({ request, env }, { tenantId, userId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  const errors = [];
  if (body.supplier_id) errors.push(validateUuid(body.supplier_id, "supplier_id"));
  if (body.receipt_no != null && (typeof body.receipt_no !== "string" || !body.receipt_no.trim() || body.receipt_no.trim().length > 50)) errors.push({ field: "receipt_no", rule: "length", message: "Số phiếu dài từ 1 đến 50 ký tự" });
  if (body.received_at != null && (typeof body.received_at !== "string" || Number.isNaN(Date.parse(body.received_at)))) errors.push({ field: "received_at", rule: "date_time", message: "Ngày nhập không hợp lệ" });
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 200) {
    errors.push({ field: "items", rule: "length", message: "Phiếu nhập phải có từ 1 đến 200 dòng" });
  } else {
    body.items.forEach((item, index) => {
      errors.push(validateUuid(item.product_variant_id, `items.${index}.product_variant_id`));
      errors.push(validateInteger(item.quantity, `items.${index}.quantity`, { min: 1, max: 1000000 }));
      errors.push(validateInteger(item.unit_cost, `items.${index}.unit_cost`, { min: 0, max: Number.MAX_SAFE_INTEGER }));
      if (Number.isSafeInteger(item.quantity) && Number.isSafeInteger(item.unit_cost) && !Number.isSafeInteger(item.quantity * item.unit_cost)) errors.push({ field: `items.${index}.line_total`, rule: "safe_integer", message: "Thành tiền vượt giới hạn" });
    });
  }
  const validErrors = errors.filter(Boolean);
  if (validErrors.length) return validationError(validErrors);
  const total = body.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  if (!Number.isSafeInteger(total)) return validationError([{ field: "total_amount", rule: "safe_integer", message: "Tổng tiền vượt giới hạn" }]);
  const idempotency = await parseIdempotency(request, "purchase_receipt.create", body);
  if (idempotency.response) return idempotency.response;
  const sql = getDb(env);
  const replay = await findIdempotency(sql, tenantId, "purchase_receipt.create", idempotency.key, idempotency.hash);
  if (replay) return replay;
  if (body.supplier_id) {
    const suppliers = await sql`SELECT id FROM suppliers WHERE id = ${body.supplier_id} AND tenant_id = ${tenantId} AND status = 'active' LIMIT 1`;
    if (!suppliers.length) return errorJson("Không tìm thấy nhà cung cấp", 404, "SUPPLIER_NOT_FOUND");
  }
  const variantIds = [...new Set(body.items.map(item => item.product_variant_id))];
  const variants = await sql`SELECT id FROM product_variants WHERE tenant_id = ${tenantId} AND id = ANY(${variantIds}::text[])`;
  if (variants.length !== variantIds.length) return errorJson("Có sản phẩm không tồn tại hoặc không thuộc cửa hàng", 422, "VARIANT_NOT_FOUND");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const receivedAt = body.received_at ? new Date(body.received_at).toISOString() : now;
  const receiptNo = body.receipt_no?.trim() || `PN-${now.slice(0, 10).replaceAll('-', '')}-${id.slice(0, 6).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const queries = [
    sql`INSERT INTO api_idempotency_keys (id, tenant_id, operation, idempotency_key, request_hash, created_at, expires_at) VALUES (${crypto.randomUUID()}, ${tenantId}, 'purchase_receipt.create', ${idempotency.key}, ${idempotency.hash}, ${now}, ${expiresAt})`,
    sql`INSERT INTO purchase_receipts (id, tenant_id, supplier_id, receipt_no, status, total_amount, note, received_at, created_by, created_at) VALUES (${id}, ${tenantId}, ${body.supplier_id || null}, ${receiptNo}, 'completed', ${total}, ${body.note?.trim() || null}, ${receivedAt}, ${userId}, ${now})`,
  ];
  for (const item of body.items) {
    const transactionId = crypto.randomUUID();
    const lineTotal = item.quantity * item.unit_cost;
    queries.push(sql`INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at) VALUES (${item.product_variant_id}, ${tenantId}, ${item.quantity}, ${now}) ON CONFLICT (product_variant_id) DO UPDATE SET qty = stock_snapshots.qty + ${item.quantity}, updated_at = ${now}`);
    queries.push(sql`INSERT INTO inventory_transactions (id, tenant_id, product_variant_id, type, quantity, unit_cost, total_cost, reference_type, reference_id, note, created_by, created_at) VALUES (${transactionId}, ${tenantId}, ${item.product_variant_id}, 'IN', ${item.quantity}, ${item.unit_cost}, ${lineTotal}, 'purchase_receipt', ${id}, ${body.note?.trim() || null}, ${userId}, ${now})`);
    queries.push(sql`INSERT INTO purchase_receipt_items (id, tenant_id, purchase_receipt_id, product_variant_id, quantity, unit_cost, line_total) VALUES (${crypto.randomUUID()}, ${tenantId}, ${id}, ${item.product_variant_id}, ${item.quantity}, ${item.unit_cost}, ${lineTotal})`);
  }
  queries.push(sql`UPDATE api_idempotency_keys SET response_status = 201, response_body = jsonb_build_object('receipt_id', ${id}::text, 'receipt_no', ${receiptNo}::text, 'total_amount', ${total}::bigint) WHERE tenant_id = ${tenantId} AND operation = 'purchase_receipt.create' AND idempotency_key = ${idempotency.key}`);
  try {
    await sql.transaction(queries, { isolationLevel: "Serializable" });
    return json({ receipt_id: id, receipt_no: receiptNo, total_amount: total }, 201, { "Idempotency-Key": idempotency.key });
  } catch (error) {
    if (isIdempotencyUniqueViolation(error)) return await findIdempotency(sql, tenantId, "purchase_receipt.create", idempotency.key, idempotency.hash);
    if (error?.code === "23505") return errorJson("Số phiếu nhập đã tồn tại", 409, "RECEIPT_NO_EXISTS");
    console.error("Không thể tạo phiếu nhập:", error);
    return errorJson("Không thể tạo phiếu nhập", 500, "PURCHASE_RECEIPT_FAILED");
  }
}
