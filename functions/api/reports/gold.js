// GET /api/reports/gold?from=YYYY-MM-DD&to=YYYY-MM-DD
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

// Gộp 2 nguồn dữ liệu vàng: công cụ hoá đơn vàng độc lập (gold_invoices) VÀ đơn bán sỉ
// theo mô hình "quy về 99" (orders.gold_price_99 > 0) — trước đây báo cáo chỉ đọc
// gold_invoices nên vàng bán qua orders-wholesale.html hoàn toàn không xuất hiện ở đây.
const COMBINED_CTE = `
  WITH combined AS (
    SELECT
      invoice_date::date  AS date,
      customer_name,
      customer_phone,
      status,
      gold_delivered,
      gold_returned,
      gold_customer_debt   AS gold_debt,
      total_making_fee     AS making_fee,
      customer_money_debt  AS money_debt,
      customer_paid_money  AS collected
    FROM gold_invoices
    WHERE tenant_id = $1

    UNION ALL

    SELECT
      o.created_at::date                            AS date,
      COALESCE(c.name, 'Khách vãng lai')             AS customer_name,
      c.phone                                        AS customer_phone,
      o.status,
      o.gold_sold_99                                 AS gold_delivered,
      o.gold_bought_99                                AS gold_returned,
      o.gold_debt_99                                  AS gold_debt,
      o.making_fee_total                              AS making_fee,
      GREATEST(o.total - COALESCE(pay.paid, 0), 0)    AS money_debt,
      COALESCE(pay.paid, 0)                            AS collected
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN (
      SELECT order_id, SUM(amount) AS paid FROM payments WHERE status = 'completed' GROUP BY order_id
    ) pay ON pay.order_id = o.id
    WHERE o.tenant_id = $1 AND (o.gold_sold_99 > 0 OR o.gold_bought_99 > 0)
  )
`;

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);

  const url  = new URL(context.request.url);
  const from = url.searchParams.get("from") || toDate(-29);
  const to   = url.searchParams.get("to")   || toDate(0);
  const { tenantId } = auth;
  const sql = getDb(context.env);

  const fromDt = from + "T00:00:00.000Z";
  const toDt   = to   + "T23:59:59.999Z";

  // ── 1. Tổng quan hoá đơn vàng (gold_invoices + đơn sỉ vàng quy-99) ──
  // sql(text, params) — cách gọi "ordinary function" của neon() cho SQL thô với
  // tham số vị trí ($1, $2, ...), khác với cách gọi tagged-template sql`...`.
  const summary = await sql(COMBINED_CTE + `
    SELECT
      COUNT(*)                                         AS total_invoices,
      COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled,
      COALESCE(SUM(gold_delivered)  FILTER (WHERE status='completed'), 0) AS total_gold_delivered,
      COALESCE(SUM(gold_returned)   FILTER (WHERE status='completed'), 0) AS total_gold_returned,
      COALESCE(SUM(gold_debt)       FILTER (WHERE status='completed'), 0) AS total_gold_debt,
      COALESCE(SUM(making_fee)      FILTER (WHERE status='completed'), 0) AS total_making_fee,
      COALESCE(SUM(money_debt)      FILTER (WHERE status='completed'), 0) AS total_money_debt,
      COALESCE(SUM(collected)       FILTER (WHERE status='completed'), 0) AS total_collected
    FROM combined
    WHERE date >= $2 AND date <= $3
  `, [tenantId, from, to]);

  // ── 2. Danh sách khách còn nợ (tổng nợ luỹ kế, không giới hạn theo kỳ) ──
  const goldDebtors = await sql(COMBINED_CTE + `
    SELECT
      customer_name,
      customer_phone,
      SUM(gold_debt)   AS gold_debt,
      SUM(money_debt)  AS money_debt,
      COUNT(*)         AS invoice_count
    FROM combined
    WHERE status = 'completed'
      AND (gold_debt > 0.001 OR money_debt > 0)
    GROUP BY customer_name, customer_phone
    ORDER BY money_debt DESC
    LIMIT 20
  `, [tenantId]);

  // ── 3. Theo ngày ─────────────────────────────────────
  const daily = await sql(COMBINED_CTE + `
    SELECT
      date,
      COUNT(*)              AS invoice_count,
      SUM(gold_delivered)   AS gold_delivered,
      SUM(making_fee)       AS making_fee
    FROM combined
    WHERE status = 'completed'
      AND date >= $2 AND date <= $3
    GROUP BY date
    ORDER BY date ASC
  `, [tenantId, from, to]);

  // ── 4. Giá vàng theo thời gian (SJC hoặc cái đầu tiên) ──
  const goldPrices = await sql`
    SELECT
      DATE(effective_at) AS date,
      sell_price,
      buy_price,
      gt.name AS gold_type
    FROM gold_price_history gph
    JOIN gold_types gt ON gt.id = gph.gold_type_id
    WHERE gt.tenant_id = ${tenantId}
      AND effective_at >= ${fromDt}
      AND effective_at <= ${toDt}
    ORDER BY effective_at ASC
    LIMIT 200
  `;

  return json({
    period: { from, to },
    summary: summary[0],
    goldDebtors,
    daily,
    goldPrices,
  });
}

function toDate(offsetDays, base) {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
