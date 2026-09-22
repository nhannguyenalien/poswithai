import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { syncCustomerSupportContext } from "../../_support-chat.js";
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
  const allowed = await requirePermission(context, auth, "payments.write");
  if (allowed instanceof Response) return allowed;

  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { order_id, method, amount, reference_no } = body;
  if (!order_id || !method || amount === undefined || amount === null) {
    return errorJson("order_id, method, amount là bắt buộc", 422);
  }
  if (!Number.isSafeInteger(amount) || amount === 0) {
    return errorJson("Số tiền phải là số nguyên VND khác 0", 422, "INVALID_PAYMENT_AMOUNT");
  }

  const idempotency = await parseIdempotency(context.request, "payments.create", body);
  if (idempotency.response) return idempotency.response;

  const sql = getDb(context.env);
  const replay = await findIdempotency(sql, auth.tenantId, "payments.create", idempotency.key, idempotency.hash);
  if (replay) return replay;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let result;
  try {
    // Ghi trực tiếp bằng transaction permissive thay vì gọi create_payment_atomic.
    // Một số database production còn giữ phiên bản function cũ chặn số tiền vượt
    // phần còn lại của riêng toa, trong khi nghiệp vụ cho phép thu/trả kèm nợ cũ.
    const transactionResults = await sql.transaction([
      sql`
        INSERT INTO api_idempotency_keys
          (id, tenant_id, operation, idempotency_key, request_hash, created_at, expires_at)
        VALUES (${crypto.randomUUID()}, ${auth.tenantId}, 'payments.create', ${idempotency.key},
                ${idempotency.hash}, ${now}, ${expiresAt})
      `,
      sql`
        WITH target_order AS MATERIALIZED (
          SELECT id, tenant_id, customer_id, total
          FROM orders
          WHERE id = ${order_id} AND tenant_id = ${auth.tenantId} AND status <> 'cancelled'
          FOR UPDATE
        ), inserted AS (
          INSERT INTO payments
            (id, tenant_id, order_id, method, amount, status, payment_date, reference_no, created_at)
          SELECT ${id}, tenant_id, id, ${method}, ${amount}, 'completed', ${now},
                 NULLIF(${reference_no || ""}, ''), ${now}
          FROM target_order
          RETURNING order_id, amount
        ), payment_state AS MATERIALIZED (
          SELECT o.customer_id, o.total,
                 (COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0)
                   + i.amount)::BIGINT AS paid_total
          FROM target_order o
          JOIN inserted i ON i.order_id = o.id
          LEFT JOIN payments p ON p.order_id = o.id
          GROUP BY o.customer_id, o.total, i.amount
        ), updated AS (
          UPDATE orders o
          SET status = 'completed', updated_at = ${now}
          FROM payment_state s
          WHERE o.id = ${order_id} AND o.tenant_id = ${auth.tenantId}
            AND ((s.total >= 0 AND s.total - s.paid_total <= 0)
              OR (s.total < 0 AND s.total - s.paid_total >= 0))
          RETURNING o.id
        ), computed AS MATERIALIZED (
          SELECT jsonb_build_object(
            'payment_id', ${id}::text,
            'paid_total', s.paid_total,
            'remaining', s.total - s.paid_total,
            'order_completed', EXISTS (SELECT 1 FROM updated),
            'customer_id', s.customer_id
          ) AS body
          FROM payment_state s
        ), saved AS (
          UPDATE api_idempotency_keys keys
          SET response_status = 201, response_body = computed.body - 'customer_id'
          FROM computed
          WHERE keys.tenant_id = ${auth.tenantId}
            AND keys.operation = 'payments.create'
            AND keys.idempotency_key = ${idempotency.key}
          RETURNING computed.body
        )
        SELECT body FROM saved
      `,
    ], { isolationLevel: "ReadCommitted" });
    result = transactionResults[1][0]?.body;
  } catch (err) {
    if (isIdempotencyUniqueViolation(err)) {
      return await findIdempotency(sql, auth.tenantId, "payments.create", idempotency.key, idempotency.hash);
    }
    console.error("Không thể tạo payment transaction:", err);
    return errorJson("Không thể ghi nhận thanh toán, vui lòng thử lại", 500, "PAYMENT_CREATE_FAILED");
  }

  if (!result) {
    return errorJson("Không thể đọc kết quả thanh toán", 500, "PAYMENT_CREATE_FAILED");
  }

  if (result.customer_id) {
    try { await syncCustomerSupportContext(sql, context.env, auth.tenantId, result.customer_id); }
    catch (err) { console.error("Không đồng bộ được dữ liệu khách sau khi thu tiền:", err.message); }
  }

  const { customer_id, ...responseBody } = result;
  return json(responseBody, 201, { "Idempotency-Key": idempotency.key });
}
