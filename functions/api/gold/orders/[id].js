// GET    /api/gold/orders/:id  — chi tiết phiếu đặt hàng
// PUT    /api/gold/orders/:id  — cập nhật trạng thái / tiền cọc / ngày hẹn giao
// DELETE /api/gold/orders/:id  — huỷ phiếu đặt hàng
import { getDb, json, errorJson, handleOptions } from "../../../_db.js";
import { requireAuth } from "../../../_auth.js";
import { ensureCustomerSupportLink, syncCustomerSupportContext } from "../../../_support-chat.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  const method = context.request.method;

  if (method === "GET")    return getOrder(context, auth, id);
  if (method === "PUT")    return updateOrder(context, auth, id);
  if (method === "DELETE") return cancelOrder(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function getOrder({ env }, { tenantId }, id) {
  const sql    = getDb(env);
  const orders = await sql`
    SELECT go.*, c.support_chat_url, c.support_chat_session
    FROM gold_orders go
    LEFT JOIN customers c ON c.id = go.customer_id
    WHERE go.id = ${id} AND go.tenant_id = ${tenantId} LIMIT 1
  `;
  if (!orders.length) return errorJson("Không tìm thấy phiếu đặt hàng", 404);

  // Phiếu cũ lập trước khi có link chat hỗ trợ — tạo bù ngay lúc mở lên (giống cơ chế
  // đơn bán lẻ/sỉ, xem functions/api/orders/[id].js) để QR luôn có trên phiếu in ra.
  if (orders[0].customer_id && !orders[0].support_chat_url) {
    try {
      orders[0] = await ensureCustomerSupportLink(sql, env, tenantId, {
        ...orders[0], id: orders[0].customer_id, name: orders[0].customer_name,
      });
    } catch (err) {
      console.error("Không tạo được link hỗ trợ khi mở phiếu gia công:", err.message);
    }
  }

  const items = await sql`
    SELECT * FROM gold_order_items WHERE order_id = ${id} ORDER BY sort_order
  `;

  return json({ order: orders[0], items });
}

async function updateOrder({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { status, notes, deposit_amount, expected_date } = body;
  if (status !== undefined && !["pending", "ready", "delivered", "cancelled"].includes(status)) {
    return errorJson("Status phải là pending, ready, delivered hoặc cancelled", 422);
  }

  const sql  = getDb(env);
  const now  = new Date().toISOString();

  const existingRows = await sql`
    SELECT total_amount, deposit_amount, customer_id FROM gold_orders WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
  `;
  if (!existingRows.length) return errorJson("Không tìm thấy phiếu đặt hàng", 404);

  const newDeposit   = deposit_amount !== undefined ? deposit_amount : existingRows[0].deposit_amount;
  const remaining    = existingRows[0].total_amount - newDeposit;

  const rows = await sql`
    UPDATE gold_orders
    SET status            = COALESCE(${status || null}, status),
        notes             = COALESCE(${notes !== undefined ? (notes || null) : null}, notes),
        deposit_amount    = ${newDeposit},
        remaining_amount  = ${remaining},
        expected_date     = COALESCE(${expected_date !== undefined ? (expected_date || null) : null}, expected_date),
        updated_at        = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id, order_number, status, deposit_amount, remaining_amount
  `;
  if (!rows.length) return errorJson("Không tìm thấy phiếu đặt hàng", 404);

  // Đẩy lại context mới nhất (trạng thái vừa đổi) lên bot — khách quét QR/nhắn bot ngay
  // sau đó sẽ thấy đúng tình trạng mới, dù hệ thống không tự nhắn tin trước cho khách
  // được (API hiện tại chỉ có tạo link chat + đẩy context, chưa có gửi tin chủ động).
  if (existingRows[0].customer_id) {
    try { await syncCustomerSupportContext(sql, env, tenantId, existingRows[0].customer_id); }
    catch (err) { console.error("Không đồng bộ được context sau khi đổi trạng thái phiếu:", err.message); }
  }

  return json(rows[0]);
}

async function cancelOrder({ env }, { tenantId }, id) {
  const sql  = getDb(env);
  const now  = new Date().toISOString();
  const rows = await sql`
    UPDATE gold_orders
    SET status = 'cancelled', updated_at = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId} AND status NOT IN ('cancelled', 'delivered')
    RETURNING id, order_number
  `;
  if (!rows.length) return errorJson("Không tìm thấy hoặc không thể huỷ (đã huỷ/đã giao)", 404);
  return json({ success: true, ...rows[0] });
}
