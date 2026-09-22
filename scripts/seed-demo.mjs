import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../functions/_auth.js";

function loadDevVars() {
  if (!fs.existsSync(".dev.vars")) return;
  for (const raw of fs.readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator > 0 && !process.env[line.slice(0, separator)]) {
      process.env[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
}

loadDevVars();
if (!process.env.DATABASE_URL) throw new Error("Thiếu DATABASE_URL");

const sql = neon(process.env.DATABASE_URL);
const slug = "pos-demo";
const email = process.env.DEMO_ADMIN_EMAIL || "admin@pos-demo.local";
const password = process.env.DEMO_ADMIN_PASSWORD || "demo123456";
const now = new Date().toISOString();

const existing = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1`;
if (existing.length) {
  console.log(JSON.stringify({ seeded: false, reason: "already_exists", slug, email }));
  process.exit(0);
}

const tenantId = crypto.randomUUID();
const roleId = crypto.randomUUID();
const userId = crypto.randomUUID();
const channelId = crypto.randomUUID();
const passwordHash = await hashPassword(password);
const categoryRows = ["Trang sức", "Thời trang", "Điện tử", "Thực phẩm"].map(name => ({ id: crypto.randomUUID(), name }));
const products = [
  { category: "Trang sức", sku: "RING-001", barcode: "8938501000012", name: "Nhẫn bạc 925", type: "silver", price: 450000, qty: 12 },
  { category: "Thời trang", sku: "TSHIRT-001", barcode: "8938501000029", name: "Áo thun basic", type: "fashion", price: 189000, qty: 30 },
  { category: "Điện tử", sku: "CABLE-001", barcode: "8938501000036", name: "Cáp sạc USB-C 1m", type: "electronics", price: 99000, qty: 24 },
  { category: "Thực phẩm", sku: "COFFEE-001", barcode: "8938501000043", name: "Cà phê rang xay 500g", type: "food", price: 165000, qty: 18 },
];

const statements = [
  sql`INSERT INTO tenants (id,name,slug,status,created_at,updated_at) VALUES (${tenantId},${"Cửa hàng Demo Đa Ngành"},${slug},${"active"},${now},${now})`,
  sql`INSERT INTO roles (id,tenant_id,name,permissions,created_at) VALUES (${roleId},${tenantId},${"owner"},${"[\"*\"]"},${now})`,
  sql`INSERT INTO users (id,tenant_id,role_id,name,email,password_hash,status,created_at,updated_at) VALUES (${userId},${tenantId},${roleId},${"Chủ cửa hàng Demo"},${email},${passwordHash},${"active"},${now},${now})`,
  ...categoryRows.map(category => sql`INSERT INTO categories (id,tenant_id,name,created_at) VALUES (${category.id},${tenantId},${category.name},${now})`),
  sql`INSERT INTO channels (id,tenant_id,name,type,status,created_at) VALUES (${channelId},${tenantId},${"Cửa hàng"},${"pos"},${"active"},${now})`,
  sql`INSERT INTO settings (id,tenant_id,key,value,updated_at) VALUES (${crypto.randomUUID()},${tenantId},${"shop_name"},${"Cửa hàng Demo Đa Ngành"},${now})`,
  sql`INSERT INTO settings (id,tenant_id,key,value,updated_at) VALUES (${crypto.randomUUID()},${tenantId},${"currency"},${"VND"},${now})`,
];

for (const product of products) {
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const categoryId = categoryRows.find(category => category.name === product.category).id;
  statements.push(
    sql`INSERT INTO products (id,tenant_id,category_id,sku,name,product_type,base_price,status,created_at,updated_at) VALUES (${productId},${tenantId},${categoryId},${product.sku},${product.name},${product.type},${product.price},${"active"},${now},${now})`,
    sql`INSERT INTO product_variants (id,product_id,tenant_id,sku,barcode,attributes,price,created_at) VALUES (${variantId},${productId},${tenantId},${product.sku},${product.barcode},${"{}"},${product.price},${now})`,
    sql`INSERT INTO stock_snapshots (product_variant_id,tenant_id,qty,updated_at) VALUES (${variantId},${tenantId},${product.qty},${now})`,
  );
}

await sql.transaction(statements);
console.log(JSON.stringify({ seeded: true, slug, email, password, products: products.length }));
