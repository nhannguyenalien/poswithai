import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";
import { ensureCustomerSupportLink, syncCustomerSupportContext } from "../../_support-chat.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  const sql = getDb(context.env);
  const url = new URL(context.request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
  const syncContext = url.searchParams.get("sync_context") === "1";
  const after = url.searchParams.get("after") || "";
  if (syncContext) {
    const linked = await sql`
      SELECT id, support_chat_session FROM customers
      WHERE tenant_id = ${auth.tenantId} AND support_chat_session IS NOT NULL
        AND (${after} = '' OR id > ${after})
      ORDER BY id ASC LIMIT ${limit}
    `;
    let synced = 0;
    const errors = [];
    for (const customer of linked) {
      try {
        await syncCustomerSupportContext(sql, context.env, auth.tenantId, customer.id, customer.support_chat_session);
        synced++;
      } catch (err) {
        errors.push({ customer_id: customer.id, error: err.message });
      }
    }
    return json({
      processed: linked.length,
      synced,
      next_cursor: linked.length === limit ? linked[linked.length - 1].id : null,
      errors,
    });
  }
  const customers = await sql`
    SELECT id, name, support_chat_url FROM customers
    WHERE tenant_id = ${auth.tenantId} AND support_chat_url IS NULL
    ORDER BY created_at ASC LIMIT ${limit}
  `;
  let created = 0;
  const errors = [];
  for (const customer of customers) {
    try {
      await ensureCustomerSupportLink(sql, context.env, auth.tenantId, customer);
      created++;
    } catch (err) {
      errors.push({ customer_id: customer.id, error: err.message });
    }
  }
  const remaining = await sql`
    SELECT COUNT(*)::int AS count FROM customers
    WHERE tenant_id = ${auth.tenantId} AND support_chat_url IS NULL
  `;
  return json({ processed: customers.length, created, remaining: remaining[0].count, errors });
}
