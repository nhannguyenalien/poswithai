// functions/api/categories/index.js
// GET  /api/categories       — danh sách danh mục
// POST /api/categories       — tạo danh mục mới
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  if (context.request.method === "GET")  return getCategories(context, auth);
  if (context.request.method === "POST") return createCategory(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getCategories({ env }, { tenantId }) {
  const sql = getDb(env);
  const rows = await sql`
    SELECT c.id, c.name, c.parent_id,
           p.name AS parent_name,
           COUNT(pr.id) AS product_count
    FROM categories c
    LEFT JOIN categories p  ON p.id = c.parent_id
    LEFT JOIN products   pr ON pr.category_id = c.id AND pr.status = 'active'
    WHERE c.tenant_id = ${tenantId}
    GROUP BY c.id, c.name, c.parent_id, p.name
    ORDER BY c.name
  `;
  return json({ categories: rows });
}

async function createCategory({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const { name, parent_id } = body;
  if (!name) return errorJson("Tên danh mục là bắt buộc", 422);

  const sql = getDb(env);
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  const rows = await sql`
    INSERT INTO categories (id, tenant_id, parent_id, name, created_at)
    VALUES (${id}, ${tenantId}, ${parent_id || null}, ${name}, ${now})
    RETURNING id, name, parent_id
  `;
  return json(rows[0], 201);
}
