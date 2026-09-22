import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { neon } from "@neondatabase/serverless";
import { createToken } from "../functions/_auth.js";
import { onRequest as purchaseHandler } from "../functions/api/purchase-receipts/index.js";
import { onRequest as purchaseDetailHandler } from "../functions/api/purchase-receipts/[id].js";
import { onRequest as supplierDetailHandler } from "../functions/api/suppliers/[id].js";

async function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const vars = await readFile(new URL("../.dev.vars", import.meta.url), "utf8");
  return vars.match(/^DATABASE_URL=(.+)$/m)?.[1];
}

const id = () => crypto.randomUUID();

async function createReceipt(env, token, body, key) {
  return purchaseHandler({
    env,
    request: new Request("https://integration.test/api/purchase-receipts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify(body),
    }),
  });
}

test("purchase receipt is atomic, tenant-safe and idempotent", async t => {
  const url = await databaseUrl();
  assert.ok(url, "DATABASE_URL is required");
  const sql = neon(url);
  const now = new Date().toISOString();
  const tenantId = id();
  const roleId = id();
  const userId = id();
  const productId = id();
  const variantId = id();
  const supplierId = id();
  const secret = `purchase-${id()}`;
  const env = { DATABASE_URL: url, JWT_SECRET: secret };
  const token = await createToken({ userId, tenantId, email: "purchase@test.local" }, secret);

  await sql.transaction([
    sql`INSERT INTO tenants (id, name, slug, status, created_at, updated_at) VALUES (${tenantId}, 'Purchase test', ${`purchase-${tenantId}`}, 'active', ${now}, ${now})`,
    sql`INSERT INTO roles (id, tenant_id, name, permissions, created_at) VALUES (${roleId}, ${tenantId}, 'Tester', '["*"]', ${now})`,
    sql`INSERT INTO users (id, tenant_id, role_id, name, email, status, created_at, updated_at) VALUES (${userId}, ${tenantId}, ${roleId}, 'Tester', ${`purchase-${userId}@test.local`}, 'active', ${now}, ${now})`,
    sql`INSERT INTO products (id, tenant_id, sku, name, base_price, status, created_at, updated_at) VALUES (${productId}, ${tenantId}, ${`P-${productId}`}, 'Purchase product', 100, 'active', ${now}, ${now})`,
    sql`INSERT INTO product_variants (id, product_id, tenant_id, sku, attributes, price, created_at) VALUES (${variantId}, ${productId}, ${tenantId}, ${`V-${variantId}`}, '{}', 100, ${now})`,
    sql`INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at) VALUES (${variantId}, ${tenantId}, 2, ${now})`,
    sql`INSERT INTO suppliers (id, tenant_id, name, status, created_at, updated_at) VALUES (${supplierId}, ${tenantId}, 'Test supplier', 'active', ${now}, ${now})`,
  ]);

  t.after(async () => {
    await sql`DELETE FROM api_idempotency_keys WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM purchase_receipt_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM inventory_transactions WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM purchase_receipts WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM suppliers WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM stock_snapshots WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM product_variants WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM products WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM users WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM roles WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM tenants WHERE id = ${tenantId}`;
  });

  const body = {
    supplier_id: supplierId,
    receipt_no: `PN-${id()}`,
    items: [{ product_variant_id: variantId, quantity: 3, unit_cost: 120000 }],
  };
  const key = `purchase-${id()}`;
  const first = await createReceipt(env, token, body, key);
  const replay = await createReceipt(env, token, body, key);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  const firstPayload = await first.json();
  assert.deepEqual(await replay.json(), firstPayload);

  const detail = await purchaseDetailHandler({
    env,
    params: { id: firstPayload.receipt_id },
    request: new Request(`https://integration.test/api/purchase-receipts/${firstPayload.receipt_id}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  });
  assert.equal(detail.status, 200);
  const detailPayload = await detail.json();
  assert.equal(detailPayload.receipt.supplier_id, supplierId);
  assert.equal(detailPayload.receipt.items.length, 1);
  assert.equal(detailPayload.receipt.items[0].line_total, 360000);

  const updateSupplier = await supplierDetailHandler({
    env,
    params: { id: supplierId },
    request: new Request(`https://integration.test/api/suppliers/${supplierId}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated supplier", phone: "0900000000", status: "active" }),
    }),
  });
  assert.equal(updateSupplier.status, 200);
  assert.equal((await updateSupplier.json()).supplier.name, "Updated supplier");

  const stock = await sql`SELECT qty FROM stock_snapshots WHERE product_variant_id = ${variantId}`;
  assert.equal(stock[0].qty, 5);
  const counts = await sql`SELECT
    (SELECT COUNT(*)::int FROM purchase_receipts WHERE tenant_id = ${tenantId}) receipts,
    (SELECT COUNT(*)::int FROM purchase_receipt_items WHERE tenant_id = ${tenantId}) items,
    (SELECT COUNT(*)::int FROM inventory_transactions WHERE tenant_id = ${tenantId}) transactions`;
  assert.deepEqual(counts[0], { receipts: 1, items: 1, transactions: 1 });

  const duplicate = await createReceipt(env, token, body, `purchase-${id()}`);
  assert.equal(duplicate.status, 409);
  const stockAfterRollback = await sql`SELECT qty FROM stock_snapshots WHERE product_variant_id = ${variantId}`;
  assert.equal(stockAfterRollback[0].qty, 5);

  const archiveSupplier = await supplierDetailHandler({
    env,
    params: { id: supplierId },
    request: new Request(`https://integration.test/api/suppliers/${supplierId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  });
  assert.equal(archiveSupplier.status, 200);
  const archived = await sql`SELECT status FROM suppliers WHERE id = ${supplierId}`;
  assert.equal(archived[0].status, "inactive");
});
