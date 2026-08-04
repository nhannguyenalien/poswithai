import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";
import { saveMetalDetails } from "../../_metal.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  let body;
  try { body = await context.request.json(); }
  catch { return errorJson("Body không hợp lệ", 400); }

  const { product_id, sku, barcode, price, attributes, metal } = body;
  if (!product_id || !sku || price === undefined)
    return errorJson("product_id, sku, price là bắt buộc", 422);

  const sql = getDb(context.env);
  const products = await sql`
    SELECT id, product_type FROM products
    WHERE id = ${product_id} AND tenant_id = ${auth.tenantId} LIMIT 1
  `;
  if (!products.length) return errorJson("Không tìm thấy sản phẩm", 404);

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await sql`
      INSERT INTO product_variants (id, product_id, tenant_id, sku, barcode, price, attributes, created_at)
      VALUES (${id}, ${product_id}, ${auth.tenantId}, ${sku}, ${barcode||null}, ${price},
              ${attributes ? JSON.stringify(attributes) : null}, ${now})
    `;
    await sql`
      INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at)
      VALUES (${id}, ${auth.tenantId}, 0, ${now})
      ON CONFLICT (product_variant_id) DO NOTHING
    `;
    if (metal) await saveMetalDetails(sql, id, products[0].product_type, metal, now);
    return json({ id, sku, barcode, price, stock_qty: 0 }, 201);
  } catch (err) {
    if (err.message.includes("unique")) return errorJson("SKU variant đã tồn tại", 409);
    return errorJson(err.message, 500);
  }
}
