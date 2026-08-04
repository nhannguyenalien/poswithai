import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET") return getOrders(context, auth);
  if (context.request.method === "POST") return createOrder(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getOrders({ request, env }, { tenantId }) {
  const url = new URL(request.url);
  const status      = url.searchParams.get("status") || "";
  const date        = url.searchParams.get("date") || "";
  const orderType   = url.searchParams.get("order_type") || "";
  const search      = url.searchParams.get("search") || "";
  const from        = url.searchParams.get("from") || "";
  const to          = url.searchParams.get("to") || "";
  const includeQuick= url.searchParams.get("include_quick") === "1";
  const fromTs = from ? `${from}T00:00:00.000Z` : "";
  const toTs   = to   ? `${to}T23:59:59.999Z`   : "";
  const searchLike = search ? `%${search}%` : "";
  const sql = getDb(env);

  // Hoá đơn nháp (is_quick) mặc định KHÔNG hiện trong danh sách chính thức — chỉ
  // truy cập được qua ID trực tiếp (chi tiết/in lại), trừ khi chủ động bật include_quick.
  const rows = await sql`
    SELECT o.id, o.order_number, o.status, o.order_type, o.is_quick, o.subtotal, o.discount, o.total,
           o.gold_debt_99, o.old_money_debt, o.old_gold_debt_99, o.created_at,
           c.name AS customer_name, c.phone AS customer_phone,
           COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
    WHERE o.tenant_id = ${tenantId}
      AND (${status} = '' OR o.status = ${status})
      AND (${orderType} = '' OR o.order_type = ${orderType})
      AND (${includeQuick} OR o.is_quick = false)
      AND (${date !== 'today'} OR DATE(o.created_at) = CURRENT_DATE)
      AND (${fromTs} = '' OR o.created_at >= ${fromTs})
      AND (${toTs} = '' OR o.created_at <= ${toTs})
      AND (${searchLike} = '' OR o.order_number ILIKE ${searchLike}
           OR c.name ILIKE ${searchLike} OR c.phone ILIKE ${searchLike})
    GROUP BY o.id, o.order_number, o.status, o.order_type, o.is_quick, o.subtotal, o.discount, o.total,
             o.gold_debt_99, o.old_money_debt, o.old_gold_debt_99, o.created_at, c.name, c.phone
    ORDER BY o.created_at DESC
    LIMIT 200
  `;

  return json({ orders: rows });
}

async function createOrder({ request, env }, { tenantId, userId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const {
    customer_id, channel_id, items = [], discount = 0, notes = null,
    order_type = "retail",
    // Hoá đơn nháp: ẩn khỏi danh sách chính thức (getOrders), thêm mặt hàng gõ tay
    // được (không cần có trong kho), KHÔNG trừ tồn kho — nhưng vẫn lưu công nợ khách
    // hàng bình thường qua total/payments như đơn thật.
    is_quick = false,
    trade_in_total = 0, trade_in_details = null,
    // Mô hình "quy về vàng 99" cho bán sỉ — mọi TL vàng bán ra/mua vào đều quy về
    // chỉ 99 trước, phần còn lại mới chọn quy ra tiền (có thể để một phần làm nợ vàng).
    gold_price_99 = 0, gold_sold_99 = 0, gold_bought_99 = 0,
    gold_to_money_99 = 0, making_fee_total = 0,
    // Nợ cũ của khách TẠI THỜI ĐIỂM lập đơn (snapshot, lấy từ /api/customers/:id/debt lúc
    // chọn khách) — chỉ để hiển thị lại đúng lịch sử trên hoá đơn in, KHÔNG cộng vào
    // total/gold_debt_99 của đơn này để tránh tính trùng nợ (xem migrate_order_old_debt.sql).
    old_money_debt = 0, old_gold_debt_99 = 0,
  } = body;
  // Toa chỉ có hàng cũ khách trả (mua vào), không bán gì mới — vẫn là 1 giao dịch hợp lệ
  // (mua vàng cũ của khách), nên chỉ chặn khi CẢ items lẫn trade_in_details đều trống.
  if (!items.length && !(trade_in_details && trade_in_details.length)) {
    return errorJson("Đơn hàng phải có ít nhất 1 sản phẩm hoặc 1 hàng cũ khách trả", 422);
  }
  if (is_quick && !customer_id) return errorJson("Hoá đơn nháp cần chọn khách hàng để lưu công nợ", 422);

  const sql = getDb(env);

  if (is_quick) {
    for (const item of items) {
      if (!item.product_variant_id && !item.item_name) {
        return errorJson("Mỗi mặt hàng trong hoá đơn nháp cần có tên hoặc chọn từ kho", 422);
      }
    }
  } else {
    // Kiểm tra tồn kho tất cả items trước khi tạo đơn
    for (const item of items) {
      const stock = await sql`
        SELECT COALESCE(ss.qty, 0) AS qty
        FROM product_variants pv
        LEFT JOIN stock_snapshots ss ON ss.product_variant_id = pv.id
        WHERE pv.id = ${item.product_variant_id} AND pv.tenant_id = ${tenantId}
        LIMIT 1
      `;
      if (!stock.length) return errorJson(`Không tìm thấy sản phẩm: ${item.product_variant_id}`, 404);
      if (parseInt(stock[0].qty) < item.quantity) {
        return errorJson(`Không đủ tồn kho. Variant ${item.product_variant_id} chỉ còn ${stock[0].qty}`, 400);
      }
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity - (i.discount || 0), 0);

  // Bán sỉ vàng dùng mô hình "quy về vàng 99": mọi TL bán ra/mua vào được quy đổi
  // theo tuổi về chỉ-99 rồi mới trừ ròng cho nhau; phần chỉ-99 còn lại mới chọn quy
  // ra tiền (gold_to_money_99), phần không quy thì để lại thành nợ vàng (gold_debt_99).
  // Khi đó unit_price của mỗi item vàng trong `items` chỉ còn là tiền công (không gồm
  // giá vàng), nên `subtotal` ở trên không bị trùng với tiền vàng cộng thêm dưới đây.
  // Đơn không phải bán sỉ vàng (không có hoạt động vàng nào) giữ nguyên công thức cũ.
  // Lưu ý: dùng gold_sold_99/gold_bought_99 để nhận diện toa vàng — KHÔNG dùng
  // gold_price_99>0, vì giá vàng có thể để trống nếu nhân viên để nguyên hết thành nợ
  // vàng (không quy đồng nào ra tiền) — nếu không, nợ vàng sẽ bị bỏ sót hoàn toàn.
  let total, goldDebt99 = 0, goldMoneyValue = 0;
  if (gold_sold_99 > 0 || gold_bought_99 > 0) {
    const goldRemaining99 = gold_sold_99 - gold_bought_99;
    goldDebt99 = goldRemaining99 - gold_to_money_99;
    goldMoneyValue = Math.round(gold_to_money_99 * gold_price_99);
    total = subtotal + goldMoneyValue - discount;
  } else {
    total = subtotal - discount - trade_in_total;
  }

  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Sinh order_number: DH + timestamp(base36) + hậu tố ngẫu nhiên, rồi tạo order —
  // thử lại vài lần nếu trùng order_number (2 đơn tạo cùng mili-giây vẫn có thể trùng
  // nếu chỉ dùng timestamp suông, nên cần cả retry lẫn hậu tố ngẫu nhiên).
  let orderNumber, created = false;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    orderNumber = "DH" + Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 5).toUpperCase();
    try {
      await sql`
        INSERT INTO orders (id, tenant_id, customer_id, channel_id, order_number, status, order_type, is_quick,
                            subtotal, discount, total, trade_in_total, trade_in_details,
                            gold_price_99, gold_sold_99, gold_bought_99, gold_to_money_99,
                            gold_debt_99, making_fee_total, notes, old_money_debt, old_gold_debt_99,
                            created_by, created_at, updated_at)
        VALUES (${orderId}, ${tenantId}, ${customer_id || null}, ${channel_id || null},
                ${orderNumber}, 'pending', ${order_type}, ${is_quick}, ${subtotal}, ${discount}, ${total},
                ${trade_in_total}, ${trade_in_details ? JSON.stringify(trade_in_details) : null},
                ${gold_price_99}, ${gold_sold_99}, ${gold_bought_99}, ${gold_to_money_99},
                ${goldDebt99}, ${making_fee_total}, ${notes || null}, ${old_money_debt}, ${old_gold_debt_99},
                ${userId}, ${now}, ${now})
      `;
      created = true;
    } catch (err) {
      if (!err.message?.includes("unique") || attempt === 4) {
        return errorJson("Không thể tạo đơn hàng, vui lòng thử lại: " + err.message, 500);
      }
      // trùng order_number — thử lại với số mới
    }
  }

  if (is_quick) {
    // Hoá đơn nháp: chỉ ghi order_items để lưu lại nội dung/tính tiền, KHÔNG đụng
    // tới kho — mặt hàng có thể gõ tay (item_name) hoặc chọn từ danh mục (product_variant_id).
    for (const item of items) {
      const itemId = crypto.randomUUID();
      const itemTotal = item.unit_price * item.quantity - (item.discount || 0);
      await sql`
        INSERT INTO order_items (id, order_id, product_variant_id, item_name, quantity, unit_price, discount, total, metal_details, created_at)
        VALUES (${itemId}, ${orderId}, ${item.product_variant_id || null}, ${item.item_name || null},
                ${item.quantity}, ${item.unit_price}, ${item.discount || 0}, ${itemTotal},
                ${item.metal_details ? JSON.stringify(item.metal_details) : null}, ${now})
      `;
    }
  } else {
    // Tạo order_items và trừ kho — trừ kho bằng UPDATE...WHERE qty>=X nguyên tử
    // (không check-rồi-ghi riêng lẻ) để tránh bán vượt tồn khi có đơn khác chen vào
    // giữa lúc kiểm tra (bước trên) và lúc trừ kho thực sự (bước này).
    const deductedSoFar = [];
    for (const item of items) {
      const deduction = await sql`
        UPDATE stock_snapshots
        SET qty = qty - ${item.quantity}, updated_at = ${now}
        WHERE product_variant_id = ${item.product_variant_id} AND tenant_id = ${tenantId}
          AND qty >= ${item.quantity}
        RETURNING qty
      `;

      if (!deduction.length) {
        // Tồn kho đã thay đổi bởi giao dịch khác kể từ bước kiểm tra ở trên.
        // Hoàn trả những item đã trừ thành công trong vòng lặp này, rồi xoá order dở dang.
        for (const done of deductedSoFar) {
          await sql`
            UPDATE stock_snapshots
            SET qty = qty + ${done.quantity}, updated_at = ${now}
            WHERE product_variant_id = ${done.product_variant_id} AND tenant_id = ${tenantId}
          `;
        }
        await sql`DELETE FROM order_items WHERE order_id = ${orderId}`;
        await sql`DELETE FROM orders WHERE id = ${orderId}`;
        return errorJson(
          `Tồn kho vừa thay đổi (variant ${item.product_variant_id} không còn đủ ${item.quantity}). Vui lòng thử lại.`,
          409
        );
      }

      const itemId = crypto.randomUUID();
      const itemTotal = item.unit_price * item.quantity - (item.discount || 0);

      await sql`
        INSERT INTO order_items (id, order_id, product_variant_id, quantity, unit_price, discount, total, metal_details, created_at)
        VALUES (${itemId}, ${orderId}, ${item.product_variant_id}, ${item.quantity},
                ${item.unit_price}, ${item.discount || 0}, ${itemTotal},
                ${item.metal_details ? JSON.stringify(item.metal_details) : null}, ${now})
      `;

      // Ghi inventory OUT
      const txId = crypto.randomUUID();
      await sql`
        INSERT INTO inventory_transactions
          (id, tenant_id, product_variant_id, type, quantity, reference_type, reference_id, created_by, created_at)
        VALUES
          (${txId}, ${tenantId}, ${item.product_variant_id}, 'OUT', ${item.quantity},
           'order', ${orderId}, ${userId}, ${now})
      `;

      deductedSoFar.push(item);
    }
  }

  return json({ order_id: orderId, order_number: orderNumber, total, gold_debt_99: goldDebt99 }, 201);
}
