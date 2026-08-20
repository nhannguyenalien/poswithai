// GET  /api/gold/orders  — danh sách phiếu đặt hàng
// POST /api/gold/orders  — lập phiếu đặt hàng mới
import { getDb, json, errorJson, handleOptions } from "../../../_db.js";
import { requireAuth } from "../../../_auth.js";
import { ensureCustomerSupportLink, syncCustomerSupportContext } from "../../../_support-chat.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return listOrders(context, auth);
  if (context.request.method === "POST") return createOrder(context, auth);
  return errorJson("Method not allowed", 405);
}

async function listOrders({ request, env }, { tenantId }) {
  const url    = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const from   = url.searchParams.get("from")   || "";
  const to     = url.searchParams.get("to")     || "";
  const sql    = getDb(env);

  const rows = await sql`
    SELECT go.id, go.order_number, go.order_date, go.expected_date, go.status,
           go.customer_name, go.customer_phone,
           go.total_amount, go.deposit_amount, go.remaining_amount,
           COALESCE(SUM(goi.weight * goi.quantity), 0) AS total_weight
    FROM gold_orders go
    LEFT JOIN gold_order_items goi ON goi.order_id = go.id
    WHERE go.tenant_id = ${tenantId}
      AND (${status} = '' OR go.status = ${status})
      AND (${from}   = '' OR go.order_date >= ${from})
      AND (${to}     = '' OR go.order_date <= ${to})
      AND (${search} = ''
           OR go.order_number  ILIKE ${'%' + search + '%'}
           OR go.customer_name ILIKE ${'%' + search + '%'}
           OR go.customer_phone LIKE ${'%' + search + '%'})
    GROUP BY go.id, go.order_number, go.order_date, go.expected_date, go.status,
             go.customer_name, go.customer_phone, go.total_amount, go.deposit_amount, go.remaining_amount
    ORDER BY go.order_date DESC, go.created_at DESC
    LIMIT 100
  `;
  const summary = rows.reduce((acc, r) => {
    acc.total_amount += parseInt(r.total_amount) || 0;
    acc.total_weight  += parseFloat(r.total_weight) || 0;
    return acc;
  }, { total_amount: 0, total_weight: 0 });
  return json({ orders: rows, summary });
}

async function createOrder({ request, env }, { tenantId, userId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const {
    customer_id, customer_name, customer_phone, customer_address,
    order_date, expected_date, gold_price_per_chi = 0,
    deposit_amount = 0,
    items = [],
    notes,
  } = body;

  const sdt = (customer_phone || "").trim();
  if (!sdt) return errorJson("Cần nhập số điện thoại khách hàng", 422);
  if (!items.length) return errorJson("Cần ít nhất 1 món hàng đặt", 422);

  const processedItems = items.map((item, i) => {
    const qty        = item.quantity || 1;
    const purity     = item.gold_purity || 99;
    const weight     = item.weight || 0;
    const unit_price = item.unit_price || 0;
    const making_fee = item.making_fee || 0;
    const amount     = Math.round(qty * (weight * unit_price + making_fee));
    return {
      id: crypto.randomUUID(),
      sort_order: i,
      product_name: item.product_name || "Sản phẩm",
      description:  item.description || null,
      quantity: qty,
      gold_purity: purity,
      weight, unit_price, making_fee, amount,
    };
  });

  const total_amount     = processedItems.reduce((s, it) => s + it.amount, 0);
  const remaining_amount = total_amount - (deposit_amount || 0);

  const sql  = getDb(env);
  const id   = crypto.randomUUID();
  const now  = new Date().toISOString();
  const date = order_date || now.slice(0, 10);

  // Gắn phiếu với 1 khách hàng thật trong bảng customers (tra theo SĐT, tự tạo nếu chưa
  // có) — trước đây phiếu gia công chỉ lưu tên/SĐT rời rạc, không có customer_id nên
  // không thể tái dùng cơ chế link chat hỗ trợ (support_chat_url) đã có sẵn cho đơn bán
  // lẻ/sỉ (xem functions/_support-chat.js) để hiện QR cho khách quét hỏi bot.
  let customerRow = null;
  if (customer_id) {
    const rows = await sql`
      SELECT id, name, support_chat_url FROM customers WHERE id = ${customer_id} AND tenant_id = ${tenantId} LIMIT 1
    `;
    customerRow = rows[0] || null;
  }
  if (!customerRow) {
    const existing = await sql`
      SELECT id, name, support_chat_url FROM customers WHERE tenant_id = ${tenantId} AND phone = ${sdt} LIMIT 1
    `;
    if (existing.length) {
      customerRow = existing[0];
    } else {
      const newCustomerId = crypto.randomUUID();
      await sql`
        INSERT INTO customers (id, tenant_id, name, phone, address, created_at, updated_at)
        VALUES (${newCustomerId}, ${tenantId}, ${customer_name || null}, ${sdt}, ${customer_address || null}, ${now}, ${now})
      `;
      customerRow = { id: newCustomerId, name: customer_name, support_chat_url: null };
    }
  }

  // Sinh số phiếu: DH + ngày + sequence
  const countRow = await sql`
    SELECT COUNT(*)+1 AS seq FROM gold_orders WHERE tenant_id = ${tenantId}
  `;
  const seq          = String(countRow[0].seq).padStart(4, "0");
  const order_number = `DH${date.replace(/-/g, "")}${seq}`;

  await sql`
    INSERT INTO gold_orders (
      id, tenant_id, order_number, customer_id, customer_name,
      customer_phone, customer_address,
      order_date, expected_date, gold_price_per_chi,
      total_amount, deposit_amount, remaining_amount,
      status, notes, created_by, created_at, updated_at
    ) VALUES (
      ${id}, ${tenantId}, ${order_number},
      ${customerRow.id}, ${customer_name || null},
      ${sdt}, ${customer_address || null},
      ${date}, ${expected_date || null}, ${gold_price_per_chi},
      ${total_amount}, ${deposit_amount}, ${remaining_amount},
      'pending', ${notes || null}, ${userId}, ${now}, ${now}
    )
  `;

  for (const item of processedItems) {
    await sql`
      INSERT INTO gold_order_items (
        id, order_id, sort_order, product_name, description, quantity,
        gold_purity, weight, unit_price, making_fee, amount, created_at
      ) VALUES (
        ${item.id}, ${id}, ${item.sort_order}, ${item.product_name}, ${item.description}, ${item.quantity},
        ${item.gold_purity}, ${item.weight}, ${item.unit_price}, ${item.making_fee}, ${item.amount}, ${now}
      )
    `;
  }

  // Tạo link chat hỗ trợ cho khách (nếu chưa có) + đẩy luôn context mới nhất (gồm phiếu
  // gia công vừa lập) lên bot — để khách quét QR trên phiếu hỏi bot là có thông tin ngay,
  // không cần đợi đồng bộ riêng. Lỗi ở bước này không chặn việc lưu phiếu.
  try {
    const linked = await ensureCustomerSupportLink(sql, env, tenantId, customerRow);
    await syncCustomerSupportContext(sql, env, tenantId, customerRow.id, linked.support_chat_session);
  } catch (err) {
    console.error("Không tạo/đồng bộ được link hỗ trợ khi lập phiếu gia công:", err.message);
  }

  return json({ order_id: id, order_number }, 201);
}
