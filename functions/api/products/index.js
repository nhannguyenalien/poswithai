import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method === "GET")  return getProducts(context, auth);
  if (context.request.method === "POST") return createProduct(context, auth);
  return errorJson("Method not allowed", 405);
}

async function getProducts({ request, env }, { tenantId }) {
  const url    = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const type   = url.searchParams.get("type")   || "";
  // "" nghĩa là "Tất cả" (chủ động chọn), chỉ mặc định "active" khi FE không truyền gì
  const statusParam = url.searchParams.get("status");
  const status = statusParam === null ? "active" : statusParam;
  const sql    = getDb(env);

  const rows = await sql`
    SELECT p.id, p.sku, p.name, p.product_type, p.base_price, p.status,
           p.brand_id,
           b.name     AS brand_name,
           b.symbol   AS brand_symbol,
           b.standard AS brand_standard,
           b.address  AS brand_address,
           c.name AS category_name,
           COALESCE(SUM(ss.qty), 0) AS total_stock
    FROM products p
    LEFT JOIN categories c       ON c.id  = p.category_id
    LEFT JOIN brands b           ON b.id  = p.brand_id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN stock_snapshots ss  ON ss.product_variant_id = pv.id
    WHERE p.tenant_id = ${tenantId}
      AND (${status} = '' OR p.status = ${status})
      AND (${type}   = '' OR p.product_type = ${type})
      AND (${search} = '' OR p.name ILIKE ${'%'+search+'%'} OR p.sku ILIKE ${'%'+search+'%'})
    GROUP BY p.id, p.sku, p.name, p.product_type, p.base_price, p.status,
             p.brand_id, b.name, b.symbol, b.standard, b.address, c.name
    ORDER BY p.created_at DESC
    LIMIT 200
  `;
  return json({ products: rows });
}

async function createProduct({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  let { sku, name, product_type = "general", base_price = 0, category_id, brand_id } = body;

  if (!name) return errorJson("Tên sản phẩm là bắt buộc", 422);

  // Tự sinh SKU nếu không có
  if (!sku) {
    const prefix = {
      gold:"VANG", silver:"BAC", fashion:"TT", phone:"DT",
      food:"TP", hotel:"KS", service:"DV"
    }[product_type] || "SP";
    sku = prefix + "-" + Date.now().toString().slice(-6);
  }

  const sql = getDb(env);
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const rows = await sql`
      INSERT INTO products
        (id, tenant_id, category_id, sku, name, product_type, base_price,
         status, brand_id, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, ${category_id||null}, ${sku}, ${name}, ${product_type},
         ${base_price}, 'active', ${brand_id||null}, ${now}, ${now})
      RETURNING id, sku, name, product_type, base_price, status
    `;

    // Tạo variant mặc định
    const vid = crypto.randomUUID();
    await sql`
      INSERT INTO product_variants (id, product_id, tenant_id, sku, price, created_at)
      VALUES (${vid}, ${id}, ${tenantId}, ${sku}, ${base_price}, ${now})
    `;
    await sql`
      INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at)
      VALUES (${vid}, ${tenantId}, 0, ${now})
      ON CONFLICT (product_variant_id) DO NOTHING
    `;

    return json({ ...rows[0], variant_id: vid }, 201);
  } catch (err) {
    if (err.message.includes("unique")) return errorJson("SKU đã tồn tại", 409);
    return errorJson(err.message, 500);
  }
}