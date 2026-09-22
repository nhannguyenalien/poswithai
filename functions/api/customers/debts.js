import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { pageMeta, parsePagination, validateEnum, validationError } from "../../_validation.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "customers.read");
  if (allowed instanceof Response) return allowed;

  const url = new URL(context.request.url);
  const pagination = parsePagination(url, { defaultLimit: 30, maxLimit: 100 });
  const direction = url.searchParams.get("direction") || "all";
  const directionError = validateEnum(direction, ["all", "customer_owes", "shop_owes"], "direction");
  const errors = [...pagination.errors, directionError].filter(Boolean);
  if (errors.length) return validationError(errors);

  const search = normalize(url.searchParams.get("search") || "");
  const sql = getDb(context.env);
  const rows = await sql`
    WITH payment_totals AS (
      SELECT order_id, SUM(amount) AS paid
      FROM payments
      WHERE tenant_id = ${auth.tenantId} AND status = 'completed'
      GROUP BY order_id
    ), order_debts AS (
      SELECT o.customer_id,
             SUM(o.total - COALESCE(p.paid, 0)) AS money_debt,
             SUM(COALESCE(o.gold_debt_99, 0)) AS gold_debt_99
      FROM orders o
      LEFT JOIN payment_totals p ON p.order_id = o.id
      WHERE o.tenant_id = ${auth.tenantId}
        AND o.customer_id IS NOT NULL
        AND o.status NOT IN ('cancelled', 'refunded')
      GROUP BY o.customer_id
    ), adjustments AS (
      SELECT customer_id,
             SUM(money_amount) AS money_debt,
             SUM(gold_amount_99) AS gold_debt_99
      FROM customer_debt_adjustments
      WHERE tenant_id = ${auth.tenantId}
      GROUP BY customer_id
    )
    SELECT c.id, c.name, c.phone,
           COALESCE(o.money_debt, 0) + COALESCE(a.money_debt, 0) AS money_debt,
           COALESCE(o.gold_debt_99, 0) + COALESCE(a.gold_debt_99, 0) AS gold_debt_99
    FROM customers c
    LEFT JOIN order_debts o ON o.customer_id = c.id
    LEFT JOIN adjustments a ON a.customer_id = c.id
    WHERE c.tenant_id = ${auth.tenantId}
    ORDER BY c.name ASC
  `;

  const debtors = rows
    .map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      money_debt: Number.parseInt(row.money_debt, 10) || 0,
      gold_debt_99: normalizeDecimal(row.gold_debt_99),
    }))
    .filter(row => row.money_debt !== 0 || decimalSign(row.gold_debt_99) !== 0)
    .filter(row => !search || normalize(`${row.name} ${row.phone || ""}`).includes(search))
    .filter(row => {
      if (direction === "all") return true;
      const goldSign = decimalSign(row.gold_debt_99);
      return direction === "customer_owes"
        ? row.money_debt > 0 || goldSign > 0
        : row.money_debt < 0 || goldSign < 0;
    });

  const summary = debtors.reduce((result, row) => {
    if (row.money_debt > 0) result.receivable_money += row.money_debt;
    if (row.money_debt < 0) result.payable_money += Math.abs(row.money_debt);
    return result;
  }, { receivable_money: 0, payable_money: 0, customer_count: debtors.length });

  const { limit, offset } = pagination;
  const pageRows = debtors.slice(offset, offset + limit);
  return json({
    customers: pageRows,
    summary,
    pagination: pageMeta({ limit, offset, returned: pageRows.length, total: debtors.length }),
  });
}

function normalize(value) {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function normalizeDecimal(value) {
  const text = String(value ?? "0");
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return "0";
  const [whole, fraction = ""] = text.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function decimalSign(value) {
  if (/^-/.test(value) && !/^-?0(?:\.0*)?$/.test(value)) return -1;
  return /^0(?:\.0*)?$/.test(value) ? 0 : 1;
}
