import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET") return getCustomers(context, auth);
  if (context.request.method === "POST") return createCustomer(context, auth);
  return errorJson("Method not allowed", 405);
}

// Bỏ dấu tiếng Việt để so khớp không phân biệt dấu — ILIKE của Postgres chỉ bỏ qua
// hoa/thường, không bỏ qua dấu, nên gõ "nguyen" (không dấu) sẽ không khớp "Nguyễn" nếu
// chỉ dùng ILIKE suông. "đ" không tách dấu qua NFD (là 1 ký tự riêng) nên phải thay tay.
function stripDiacritics(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

async function getCustomers({ request, env }, { tenantId }) {
  const search = new URL(request.url).searchParams.get("search") || "";
  const sql = getDb(env);

  const rows = await sql`
    SELECT c.id, c.name, c.phone, c.email, c.id_card, c.address, c.is_business, c.tax_code, c.created_at,
           COUNT(o.id) AS total_orders,
           COALESCE(SUM(o.total), 0) AS total_spent
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
    WHERE c.tenant_id = ${tenantId}
    GROUP BY c.id, c.name, c.phone, c.email, c.id_card, c.address, c.is_business, c.tax_code, c.created_at
    ORDER BY c.created_at DESC
  `;

  if (!search) return json({ customers: rows.slice(0, 50) });

  const term = stripDiacritics(search);
  const filtered = rows
    .filter(c => stripDiacritics(c.name).includes(term) || (c.phone || "").includes(search))
    .slice(0, 50);

  return json({ customers: filtered });
}

async function createCustomer({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { name, phone, email, id_card, address, is_business = false, tax_code } = body;
  if (!name) return errorJson("Tên là bắt buộc", 422);

  const sql = getDb(env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const rows = await sql`
    INSERT INTO customers (id, tenant_id, name, phone, email, id_card, address, is_business, tax_code, created_at, updated_at)
    VALUES (${id}, ${tenantId}, ${name}, ${phone || null}, ${email || null},
            ${id_card || null}, ${address || null}, ${is_business}, ${tax_code || null}, ${now}, ${now})
    RETURNING id, name, phone, email, id_card, address, is_business, tax_code
  `;

  return json(rows[0], 201);
}
