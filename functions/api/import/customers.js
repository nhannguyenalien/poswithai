import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const { rows = [], mode = "upsert" } = body;
  if (!rows.length) return errorJson("Không có dữ liệu", 422);
  if (rows.length > 5000) return errorJson("Tối đa 5000 dòng", 422);

  const sql = getDb(context.env);
  const { tenantId } = auth;
  const now = new Date().toISOString();
  const results = { total: rows.length, success: 0, skipped: 0, errors: [] };

  function normPhone(raw) {
    if (!raw) return null;
    let p = String(raw).replace(/[^\d+]/g,"");
    if (p.startsWith("+84")) p = "0"+p.slice(3);
    if (p.startsWith("84") && p.length>=11) p = "0"+p.slice(2);
    return p || null;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; const rowNum = i + 1;
    try {
      const name  = String(row.name||"").trim();
      const phone = normPhone(row.phone||row.sdt||"");
      const email = String(row.email||"").trim()||null;
      const addr  = String(row.address||"").trim()||null;
      if (!name) { results.errors.push({ row:rowNum, message:"Tên không được trống" }); continue; }

      if (phone) {
        const ex = await sql`SELECT id FROM customers WHERE tenant_id=${tenantId} AND phone=${phone} LIMIT 1`;
        if (ex.length) {
          if (mode==="upsert") {
            await sql`UPDATE customers SET name=${name},email=COALESCE(${email},email),updated_at=${now} WHERE id=${ex[0].id}`;
            results.success++;
          } else results.skipped++;
          continue;
        }
      }

      const id = crypto.randomUUID();
      await sql`INSERT INTO customers (id,tenant_id,name,phone,email,created_at,updated_at) VALUES (${id},${tenantId},${name},${phone},${email},${now},${now})`;
      if (addr) await sql`INSERT INTO customer_addresses (id,customer_id,label,address,created_at) VALUES (${crypto.randomUUID()},${id},'home',${addr},${now})`;
      results.success++;
    } catch(err) { results.errors.push({ row:rowNum, name:row.name, message:err.message }); }
  }
  return json(results);
}
