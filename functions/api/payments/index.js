import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { order_id, method, amount, reference_no } = body;
  if (!order_id || !method || !amount) return errorJson("order_id, method, amount là bắt buộc", 422);

  const sql = getDb(context.env);

  // Lấy thông tin đơn hàng
  const orders = await sql`
    SELECT * FROM orders WHERE id = ${order_id} AND tenant_id = ${auth.tenantId} LIMIT 1
  `;
  if (!orders.length) return errorJson("Không tìm thấy đơn hàng", 404);
  if (orders[0].status === "cancelled") return errorJson("Đơn hàng đã bị hủy", 400);

  // Tính đã thanh toán
  const paid = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments WHERE order_id = ${order_id} AND status = 'completed'
  `;
  const alreadyPaid = parseInt(paid[0].total);
  const orderTotal = parseInt(orders[0].total);

  // Đơn tổng dương = thu tiền từ khách (amount phải > 0).
  // Đơn tổng âm = hàng cũ khách trả thu vào nhiều hơn giá trị mua, tiệm phải hoàn tiền lại
  // cho khách (amount phải < 0) — hai chiều đối xứng nhau qua dấu của orderTotal.
  if (orderTotal >= 0) {
    if (amount <= 0) return errorJson("Số tiền phải lớn hơn 0", 422);
    if (alreadyPaid + amount > orderTotal) {
      return errorJson(`Số tiền vượt quá tổng đơn. Còn nợ: ${orderTotal - alreadyPaid}`, 400);
    }
  } else {
    if (amount >= 0) return errorJson("Đơn này khách được hoàn tiền lại, số tiền phải nhỏ hơn 0", 422);
    if (alreadyPaid + amount < orderTotal) {
      return errorJson(`Số tiền hoàn vượt quá số cần hoàn. Còn cần hoàn: ${orderTotal - alreadyPaid}`, 400);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO payments (id, tenant_id, order_id, method, amount, status, payment_date, reference_no, created_at)
    VALUES (${id}, ${auth.tenantId}, ${order_id}, ${method}, ${amount}, 'completed', ${now}, ${reference_no || null}, ${now})
  `;

  const newPaid = alreadyPaid + amount;
  const remaining = orderTotal - newPaid;

  // Tự động hoàn thành đơn nếu đã thu/hoàn đủ tiền (sign-aware theo chiều của orderTotal)
  const settled = orderTotal >= 0 ? remaining <= 0 : remaining >= 0;
  if (settled) {
    await sql`UPDATE orders SET status = 'completed', updated_at = ${now} WHERE id = ${order_id}`;
  }

  return json({
    payment_id: id,
    paid_total: newPaid,
    remaining,
    order_completed: settled,
  }, 201);
}
