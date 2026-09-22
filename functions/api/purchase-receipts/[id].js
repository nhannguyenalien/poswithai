import { errorJson, getDb, handleOptions, json } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { validateUuid } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "inventory.read");
  if (allowed instanceof Response) return allowed;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  const { id } = context.params;
  const idError = validateUuid(id, "id");
  if (idError) return errorJson("ID phiếu nhập không hợp lệ", 422, "VALIDATION_ERROR", [idError]);
  const sql = getDb(context.env);
  const receipts = await sql`
    SELECT pr.id, pr.receipt_no, pr.status, pr.total_amount, pr.note,
           pr.received_at, pr.created_at, s.id AS supplier_id,
           s.name AS supplier_name, s.phone AS supplier_phone
    FROM purchase_receipts pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id AND s.tenant_id = pr.tenant_id
    WHERE pr.id = ${id} AND pr.tenant_id = ${auth.tenantId}
    LIMIT 1
  `;
  if (!receipts.length) return errorJson("Không tìm thấy phiếu nhập", 404, "PURCHASE_RECEIPT_NOT_FOUND");
  const items = await sql`
    SELECT pri.id, pri.product_variant_id, pri.quantity, pri.unit_cost,
           pri.line_total, pv.sku, pv.barcode, p.id AS product_id,
           p.name AS product_name
    FROM purchase_receipt_items pri
    JOIN product_variants pv ON pv.id = pri.product_variant_id AND pv.tenant_id = pri.tenant_id
    JOIN products p ON p.id = pv.product_id AND p.tenant_id = pri.tenant_id
    WHERE pri.purchase_receipt_id = ${id} AND pri.tenant_id = ${auth.tenantId}
    ORDER BY p.name, pv.sku
  `;
  return json({
    receipt: {
      ...receipts[0],
      total_amount: Number(receipts[0].total_amount),
      items: items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        line_total: Number(item.line_total),
      })),
    },
  });
}
