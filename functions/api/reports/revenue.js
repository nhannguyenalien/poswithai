// GET /api/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&channel_id=
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { parseDateRange, validationError } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);
  const allowed = await requirePermission(context, auth, "orders.read");
  if (allowed instanceof Response) return allowed;

  const url        = new URL(context.request.url);
  const dateRange  = parseDateRange(url);
  if (dateRange.errors.length) return validationError(dateRange.errors);
  const from       = dateRange.from || toDate(-29); // default 30 ngày
  const to         = dateRange.to   || toDate(0);
  const channelId  = url.searchParams.get("channel_id") || "";
  const includeDrafts = url.searchParams.get("include_drafts") === "1";
  const { tenantId } = auth;
  const sql = getDb(context.env);

  const fromDt = from + "T00:00:00.000Z";
  const toDt   = to   + "T23:59:59.999Z";

  // ── 1. Tổng quan (summary cards) ──────────────────────
  const summary = await sql`
    SELECT
      COUNT(*)                                          AS total_orders,
      COUNT(*) FILTER (WHERE status = 'completed')     AS completed_orders,
      COUNT(*) FILTER (WHERE status = 'pending')       AS pending_orders,
      COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled_orders,
      COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
      COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0) AS avg_order_value
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${fromDt}
      AND created_at <= ${toDt}
      AND (${channelId} = '' OR channel_id = ${channelId})
      AND (${includeDrafts} OR NOT COALESCE(is_quick, false))
  `;

  // Nợ phải thu hiện tại: cộng số có dấu theo từng khách trước, rồi chỉ lấy các
  // khách có số dư dương. Không đồng nhất "đơn pending" với "chưa thanh toán".
  const debtSummary = await sql`
    WITH payment_totals AS (
      SELECT p.order_id, SUM(p.amount) AS paid
      FROM payments p
      WHERE p.status = 'completed'
      GROUP BY p.order_id
    ), balances AS (
      SELECT
        c.id,
        COALESCE(SUM(o.total - COALESCE(pt.paid, 0)), 0)
          + COALESCE(a.money_amount, 0) AS money_debt
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
        AND o.tenant_id = ${tenantId}
        AND o.status NOT IN ('cancelled', 'refunded')
        AND (${includeDrafts} OR NOT COALESCE(o.is_quick, false))
      LEFT JOIN payment_totals pt ON pt.order_id = o.id
      LEFT JOIN (
        SELECT customer_id, SUM(money_amount) AS money_amount
        FROM customer_debt_adjustments
        WHERE tenant_id = ${tenantId}
        GROUP BY customer_id
      ) a ON a.customer_id = c.id
      WHERE c.tenant_id = ${tenantId}
      GROUP BY c.id, a.money_amount
    )
    SELECT COALESCE(SUM(money_debt) FILTER (WHERE money_debt > 0), 0) AS receivable
    FROM balances
  `;
  summary[0].pending_revenue = debtSummary[0]?.receivable || 0;

  // ── 2. Doanh thu theo ngày ────────────────────────────
  const daily = await sql`
    SELECT
      DATE(created_at AT TIME ZONE 'UTC') AS date,
      COUNT(*)                             AS order_count,
      COALESCE(SUM(total), 0)             AS revenue
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND status = 'completed'
      AND created_at >= ${fromDt}
      AND created_at <= ${toDt}
      AND (${channelId} = '' OR channel_id = ${channelId})
      AND (${includeDrafts} OR NOT COALESCE(is_quick, false))
    GROUP BY DATE(created_at AT TIME ZONE 'UTC')
    ORDER BY date ASC
  `;

  // ── 3. Top 10 sản phẩm ───────────────────────────────
  const topProducts = await sql`
    SELECT
      p.name    AS product_name,
      p.product_type,
      pv.sku,
      SUM(oi.quantity)                AS qty_sold,
      COALESCE(SUM(oi.total), 0)      AS revenue
    FROM order_items oi
    JOIN orders          o   ON o.id  = oi.order_id
    JOIN product_variants pv ON pv.id = oi.product_variant_id
    JOIN products         p  ON p.id  = pv.product_id
    WHERE o.tenant_id = ${tenantId}
      AND o.status    = 'completed'
      AND o.created_at >= ${fromDt}
      AND o.created_at <= ${toDt}
      AND (${channelId} = '' OR o.channel_id = ${channelId})
      AND (${includeDrafts} OR NOT COALESCE(o.is_quick, false))
    GROUP BY p.name, p.product_type, pv.sku
    ORDER BY revenue DESC
    LIMIT 10
  `;

  // ── 4. Theo kênh ──────────────────────────────────────
  const byChannel = await sql`
    SELECT
      COALESCE(c.name, 'Trực tiếp') AS channel_name,
      c.type                         AS channel_type,
      COUNT(o.id)                    AS order_count,
      COALESCE(SUM(o.total), 0)      AS revenue
    FROM orders o
    LEFT JOIN channels c ON c.id = o.channel_id
    WHERE o.tenant_id = ${tenantId}
      AND o.status    = 'completed'
      AND o.created_at >= ${fromDt}
      AND o.created_at <= ${toDt}
      AND (${includeDrafts} OR NOT COALESCE(o.is_quick, false))
    GROUP BY c.name, c.type
    ORDER BY revenue DESC
  `;

  // ── 5. Theo phương thức thanh toán ───────────────────
  const byPayment = await sql`
    SELECT
      p.method,
      COUNT(*)               AS txn_count,
      COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.tenant_id = ${tenantId}
      AND o.status    = 'completed'
      AND p.created_at >= ${fromDt}
      AND p.created_at <= ${toDt}
      AND (${includeDrafts} OR NOT COALESCE(o.is_quick, false))
    GROUP BY p.method
    ORDER BY total DESC
  `;

  // ── 6. So sánh kỳ trước ──────────────────────────────
  const days       = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const prevFrom   = toDate(-days * 2 + 1, from);
  const prevTo     = toDate(-days, from);
  const prevFromDt = prevFrom + "T00:00:00.000Z";
  const prevToDt   = prevTo   + "T23:59:59.999Z";

  const prev = await sql`
    SELECT COALESCE(SUM(total), 0) AS prev_revenue, COUNT(*) AS prev_orders
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND status    = 'completed'
      AND created_at >= ${prevFromDt}
      AND created_at <= ${prevToDt}
      AND (${includeDrafts} OR NOT COALESCE(is_quick, false))
  `;

  return json({
    period: { from, to, days },
    summary: normalizeSummary(summary[0]),
    daily: daily.map(row => ({ ...row, order_count: asInt(row.order_count), revenue: asInt(row.revenue) })),
    topProducts: topProducts.map(row => ({ ...row, qty_sold: asInt(row.qty_sold), revenue: asInt(row.revenue) })),
    byChannel: byChannel.map(row => ({ ...row, order_count: asInt(row.order_count), revenue: asInt(row.revenue) })),
    byPayment: byPayment.map(row => ({ ...row, txn_count: asInt(row.txn_count), total: asInt(row.total) })),
    prevPeriod: {
      from: prevFrom, to: prevTo,
      revenue: asInt(prev[0]?.prev_revenue),
      orders:  asInt(prev[0]?.prev_orders),
    },
  });
}

function asInt(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function normalizeSummary(row = {}) {
  return {
    total_orders: asInt(row.total_orders),
    completed_orders: asInt(row.completed_orders),
    pending_orders: asInt(row.pending_orders),
    cancelled_orders: asInt(row.cancelled_orders),
    total_revenue: asInt(row.total_revenue),
    avg_order_value: asInt(row.avg_order_value),
    pending_revenue: asInt(row.pending_revenue),
  };
}

// Helper: YYYY-MM-DD offset từ 1 ngày gốc
function toDate(offsetDays, base) {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
