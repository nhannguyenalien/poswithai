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
  if (rows.length > 2000) return errorJson("Tối đa 2000 dòng", 422);

  const sql = getDb(context.env);
  const { tenantId } = auth;
  const now = new Date().toISOString();
  const results = { total: rows.length, success: 0, skipped: 0, errors: [] };

  // Cache categories
  const catCache = {};
  async function getOrCreateCat(name) {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    if (catCache[key]) return catCache[key];
    const ex = await sql`SELECT id FROM categories WHERE tenant_id=${tenantId} AND LOWER(name)=${key} LIMIT 1`;
    if (ex.length) { catCache[key] = ex[0].id; return ex[0].id; }
    const id = crypto.randomUUID();
    await sql`INSERT INTO categories (id,tenant_id,name,created_at) VALUES (${id},${tenantId},${name.trim()},${now})`;
    catCache[key] = id;
    return id;
  }

  const TYPE_MAP = {
    vàng:"gold",gold:"gold",bạc:"silver",silver:"silver",
    "thời trang":"fashion",fashion:"fashion","điện thoại":"phone",phone:"phone",
    "mỹ phẩm":"cosmetic",cosmetic:"cosmetic","thực phẩm":"food",food:"food",
    "khách sạn":"hotel",hotel:"hotel","dịch vụ":"service",service:"service",
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; const rowNum = i + 1;
    try {
      const sku  = String(row.sku  || "").trim();
      const name = String(row.name || "").trim();
      if (!sku)  { results.errors.push({ row:rowNum, sku, message:"SKU không được trống" }); continue; }
      if (!name) { results.errors.push({ row:rowNum, sku, message:"Tên không được trống" }); continue; }

      const price   = parseInt(String(row.base_price||row.price||"0").replace(/[^\d]/g,""))||0;
      const type    = TYPE_MAP[String(row.product_type||"").toLowerCase().trim()] || "general";
      const barcode = String(row.barcode||"").trim()||null;
      const catId   = await getOrCreateCat(row.category||"");

      const existing = await sql`SELECT id FROM products WHERE tenant_id=${tenantId} AND sku=${sku} LIMIT 1`;
      let pid;
      if (existing.length) {
        if (mode==="upsert") {
          await sql`UPDATE products SET name=${name},base_price=${price},product_type=${type},category_id=COALESCE(${catId},category_id),updated_at=${now} WHERE id=${existing[0].id}`;
          pid = existing[0].id;
        } else { results.skipped++; continue; }
      } else {
        pid = crypto.randomUUID();
        await sql`INSERT INTO products (id,tenant_id,category_id,sku,name,product_type,base_price,status,created_at,updated_at) VALUES (${pid},${tenantId},${catId},${sku},${name},${type},${price},'active',${now},${now})`;
      }

      // Default variant
      const vsku = String(row.variant_sku||sku).trim();
      const vex  = await sql`SELECT id FROM product_variants WHERE product_id=${pid} AND sku=${vsku} LIMIT 1`;
      if (!vex.length) {
        const vid = crypto.randomUUID();
        await sql`INSERT INTO product_variants (id,product_id,tenant_id,sku,barcode,price,created_at) VALUES (${vid},${pid},${tenantId},${vsku},${barcode},${price},${now})`;
        await sql`INSERT INTO stock_snapshots (product_variant_id,tenant_id,qty,updated_at) VALUES (${vid},${tenantId},0,${now}) ON CONFLICT (product_variant_id) DO NOTHING`;
      }
      results.success++;
    } catch(err) { results.errors.push({ row:rowNum, sku:row.sku, message:err.message }); }
  }
  return json(results);
}
