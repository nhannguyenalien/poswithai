import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET") return getTransactions(context, auth);
  if (context.request.method === "POST") return createTransaction(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getTransactions({ request, env }, { tenantId }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date"); // "today" hoặc ISO date
  const sql = getDb(env);

  const rows = await sql`
    SELECT it.*, pv.sku, p.name AS product_name,
           u.name AS created_by_name
    FROM inventory_transactions it
    JOIN product_variants pv ON pv.id = it.product_variant_id
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN users u ON u.id = it.created_by
    WHERE it.tenant_id = ${tenantId}
      AND (${date !== "today"} OR DATE(it.created_at) = CURRENT_DATE)
    ORDER BY it.created_at DESC
    LIMIT 100
  `;

  return json({ transactions: rows });
}

async function createTransaction({ request, env }, { tenantId, userId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { product_variant_id, type, quantity, unit_cost, note, reason } = body;

  if (!product_variant_id || !type || quantity === undefined || quantity === null) {
    return errorJson("product_variant_id, type, quantity là bắt buộc", 422);
  }
  if (!["IN", "OUT", "ADJUST"].includes(type)) {
    return errorJson("type phải là IN, OUT hoặc ADJUST", 422);
  }
  // ADJUST cho phép 0 (kiểm kho phát hiện hết hàng); IN/OUT phải > 0
  if (type === "ADJUST" ? quantity < 0 : quantity <= 0) {
    return errorJson(
      type === "ADJUST" ? "quantity không được âm" : "quantity phải lớn hơn 0",
      422
    );
  }

  const sql = getDb(env);

  // Kiểm tra variant thuộc tenant
  const variants = await sql`
    SELECT pv.id FROM product_variants pv
    WHERE pv.id = ${product_variant_id} AND pv.tenant_id = ${tenantId}
    LIMIT 1
  `;
  if (!variants.length) return errorJson("Không tìm thấy variant", 404);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const totalCost = unit_cost ? unit_cost * quantity : null;

  // Cập nhật stock_snapshot bằng phép cộng/trừ nguyên tử ngay trong SQL
  // (không đọc rồi ghi đè giá trị tuyệt đối ở JS) để tránh mất dữ liệu khi
  // có 2 giao dịch IN/OUT cùng lúc trên cùng 1 variant.
  let newQtyRows;
  if (type === "IN") {
    newQtyRows = await sql`
      INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at)
      VALUES (${product_variant_id}, ${tenantId}, ${quantity}, ${now})
      ON CONFLICT (product_variant_id)
      DO UPDATE SET qty = stock_snapshots.qty + ${quantity}, updated_at = ${now}
      RETURNING qty
    `;
  } else if (type === "OUT") {
    newQtyRows = await sql`
      UPDATE stock_snapshots
      SET qty = qty - ${quantity}, updated_at = ${now}
      WHERE product_variant_id = ${product_variant_id} AND tenant_id = ${tenantId}
        AND qty >= ${quantity}
      RETURNING qty
    `;
    if (!newQtyRows.length) {
      const cur = await sql`
        SELECT COALESCE(qty, 0) AS qty FROM stock_snapshots
        WHERE product_variant_id = ${product_variant_id} AND tenant_id = ${tenantId}
        LIMIT 1
      `;
      return errorJson(`Không đủ tồn kho. Hiện có: ${cur[0]?.qty ?? 0}`, 400);
    }
  } else {
    // ADJUST = set trực tiếp (không phụ thuộc giá trị cũ, không cần atomic-relative)
    newQtyRows = await sql`
      INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at)
      VALUES (${product_variant_id}, ${tenantId}, ${quantity}, ${now})
      ON CONFLICT (product_variant_id)
      DO UPDATE SET qty = ${quantity}, updated_at = ${now}
      RETURNING qty
    `;
  }
  const newQty = parseInt(newQtyRows[0].qty);

  // Insert transaction
  await sql`
    INSERT INTO inventory_transactions
      (id, tenant_id, product_variant_id, type, quantity, unit_cost, total_cost,
       reference_type, note, created_by, created_at)
    VALUES
      (${id}, ${tenantId}, ${product_variant_id}, ${type}, ${quantity},
       ${unit_cost || null}, ${totalCost}, ${"manual"}, ${note || null}, ${userId}, ${now})
  `;

  // Nếu ADJUST → ghi lý do vào stock_adjustments
  if (type === "ADJUST" && reason) {
    await sql`
      INSERT INTO stock_adjustments (id, tenant_id, inventory_transaction_id, reason, created_at)
      VALUES (${crypto.randomUUID()}, ${tenantId}, ${id}, ${reason}, ${now})
    `;
  }

  return json({ transaction_id: id, new_qty: newQty }, 201);
}
