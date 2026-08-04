import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  const method  = context.request.method;

  if (method === "GET")    return getProduct(context, auth, id);
  if (method === "PUT")    return updateProduct(context, auth, id);
  if (method === "DELETE") return deleteProduct(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function getProduct({ env }, { tenantId }, id) {
  const sql = getDb(env);

  const products = await sql`
    SELECT p.*, c.name AS category_name,
           b.name AS brand_name, b.symbol AS brand_symbol,
           b.standard AS brand_standard, b.address AS brand_address
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b     ON b.id = p.brand_id
    WHERE p.id = ${id} AND p.tenant_id = ${tenantId}
    LIMIT 1
  `;
  if (!products.length) return errorJson("Không tìm thấy sản phẩm", 404);

  const variants = await sql`
    SELECT
      pv.id, pv.sku, pv.barcode, pv.price, pv.attributes,
      COALESCE(ss.qty, 0) AS stock_qty,
      gpd.gold_type_id,
      gt.name    AS gold_type_name,
      gt.purity  AS gold_type_purity,
      gpd.gross_weight AS gold_gross,
      gpd.stone_weight AS gold_stone,
      gpd.net_weight   AS gold_net,
      gpd.making_fee   AS gold_making_fee,
      spd.purity       AS silver_purity,
      spd.gross_weight AS silver_gross,
      spd.stone_weight AS silver_stone,
      spd.net_weight   AS silver_net,
      spd.making_fee   AS silver_making_fee
    FROM product_variants pv
    LEFT JOIN stock_snapshots        ss  ON ss.product_variant_id  = pv.id
    LEFT JOIN gold_product_details   gpd ON gpd.product_variant_id = pv.id
    LEFT JOIN gold_types             gt  ON gt.id = gpd.gold_type_id
    LEFT JOIN silver_product_details spd ON spd.product_variant_id = pv.id
    WHERE pv.product_id = ${id}
    ORDER BY pv.created_at ASC
  `;

  return json({ product: products[0], variants });
}

async function updateProduct({ request, env }, { tenantId }, id) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const { name, base_price, status, category_id, product_type, brand_id } = body;
  const sql = getDb(env);
  const now = new Date().toISOString();

  const rows = await sql`
    UPDATE products
    SET name         = COALESCE(${name         || null}, name),
        base_price   = COALESCE(${base_price   ?? null}, base_price),
        status       = COALESCE(${status       || null}, status),
        category_id  = COALESCE(${category_id  || null}, category_id),
        product_type = COALESCE(${product_type || null}, product_type),
        brand_id     = COALESCE(${brand_id     || null}, brand_id),
        updated_at   = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id, sku, name, product_type, base_price, status, brand_id
  `;

  if (!rows.length) return errorJson("Không tìm thấy sản phẩm", 404);
  return json(rows[0]);
}

async function deleteProduct({ env }, { tenantId }, id) {
  const sql = getDb(env);
  const now = new Date().toISOString();
  const rows = await sql`
    UPDATE products SET status = 'inactive', updated_at = ${now}
    WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING id
  `;
  if (!rows.length) return errorJson("Không tìm thấy sản phẩm", 404);
  return json({ success: true });
}