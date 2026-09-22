import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { neon } from "@neondatabase/serverless";
import { createToken } from "../functions/_auth.js";
import { onRequest as ordersHandler } from "../functions/api/orders/index.js";
import { onRequest as paymentsHandler } from "../functions/api/payments/index.js";

async function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const vars = await readFile(new URL("../.dev.vars", import.meta.url), "utf8");
  return vars.match(/^DATABASE_URL=(.+)$/m)?.[1];
}

function id() {
  return crypto.randomUUID();
}

async function invoke(handler, env, token, body, key) {
  return handler({
    env,
    request: new Request("https://integration.test/api", {
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

test("order/payment transactions are atomic and idempotent", async (t) => {
  const url = await databaseUrl();
  assert.ok(url, "DATABASE_URL is required");
  const sql = neon(url);
  const now = new Date().toISOString();
  const tenantId = id();
  const roleId = id();
  const userId = id();
  const productId = id();
  const variantId = id();
  const secret = `integration-${id()}`;
  const env = { DATABASE_URL: url, JWT_SECRET: secret };
  const token = await createToken({ userId, tenantId, email: "atomic@test.local" }, secret);

  await sql.transaction([
    sql`INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
        VALUES (${tenantId}, 'Atomic test', ${`atomic-${tenantId}`}, 'active', ${now}, ${now})`,
    sql`INSERT INTO roles (id, tenant_id, name, permissions, created_at)
        VALUES (${roleId}, ${tenantId}, 'Tester', '["*"]', ${now})`,
    sql`INSERT INTO users (id, tenant_id, role_id, name, email, status, created_at, updated_at)
        VALUES (${userId}, ${tenantId}, ${roleId}, 'Tester', ${`atomic-${userId}@test.local`}, 'active', ${now}, ${now})`,
    sql`INSERT INTO products (id, tenant_id, sku, name, base_price, status, created_at, updated_at)
        VALUES (${productId}, ${tenantId}, ${`P-${productId}`}, 'Atomic product', 100, 'active', ${now}, ${now})`,
    sql`INSERT INTO product_variants (id, product_id, tenant_id, sku, attributes, price, created_at)
        VALUES (${variantId}, ${productId}, ${tenantId}, ${`V-${variantId}`}, '{}', 100, ${now})`,
    sql`INSERT INTO stock_snapshots (product_variant_id, tenant_id, qty, updated_at)
        VALUES (${variantId}, ${tenantId}, 9, ${now})`,
  ]);

  t.after(async () => {
    await sql`DELETE FROM api_idempotency_keys WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM payments WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM inventory_transactions WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = ${tenantId})`;
    await sql`DELETE FROM orders WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM stock_snapshots WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM product_variants WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM products WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM users WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM roles WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM tenants WHERE id = ${tenantId}`;
  });

  const orderBody = {
    items: [{ product_variant_id: variantId, quantity: 4, unit_price: 100 }],
  };
  const sameKey = `order-${id()}`;
  const first = await invoke(ordersHandler, env, token, orderBody, sameKey);
  const replay = await invoke(ordersHandler, env, token, orderBody, sameKey);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  const firstBody = await first.json();
  assert.deepEqual(await replay.json(), firstBody);

  const [raceA, raceB] = await Promise.all([
    invoke(ordersHandler, env, token, orderBody, `order-${id()}`),
    invoke(ordersHandler, env, token, orderBody, `order-${id()}`),
  ]);
  assert.deepEqual([raceA.status, raceB.status].sort(), [201, 409]);
  const successfulRace = raceA.status === 201 ? await raceA.json() : await raceB.json();
  const stock = await sql`SELECT qty FROM stock_snapshots WHERE product_variant_id = ${variantId}`;
  assert.equal(stock[0].qty, 1);
  const orderCount = await sql`SELECT COUNT(*)::int AS count FROM orders WHERE tenant_id = ${tenantId}`;
  assert.equal(orderCount[0].count, 2);

  const paymentBody = { order_id: successfulRace.order_id, method: "cash", amount: 300 };
  const paymentKeyA = `payment-${id()}`;
  const paymentKeyB = `payment-${id()}`;
  const [payA, payB] = await Promise.all([
    invoke(paymentsHandler, env, token, paymentBody, paymentKeyA),
    invoke(paymentsHandler, env, token, paymentBody, paymentKeyB),
  ]);
  assert.deepEqual([payA.status, payB.status].sort(), [201, 409]);
  const successfulKey = payA.status === 201 ? paymentKeyA : paymentKeyB;
  const successfulPayment = payA.status === 201 ? await payA.json() : await payB.json();
  assert.equal(successfulPayment.paid_total, 300);
  assert.equal(successfulPayment.remaining, 100);
  assert.equal(successfulPayment.order_completed, false);
  const paymentReplay = await invoke(paymentsHandler, env, token, paymentBody, successfulKey);
  assert.equal(paymentReplay.status, 201);
  assert.equal(paymentReplay.headers.get("Idempotency-Replayed"), "true");
  assert.deepEqual(await paymentReplay.json(), successfulPayment);

  const paid = await sql`SELECT COUNT(*)::int AS count, SUM(amount)::int AS amount
                         FROM payments WHERE order_id = ${successfulRace.order_id}`;
  assert.deepEqual(paid[0], { count: 1, amount: 300 });
  const remaining = await invoke(
    paymentsHandler,
    env,
    token,
    { ...paymentBody, amount: 100 },
    `payment-${id()}`,
  );
  assert.equal(remaining.status, 201);
  const remainingBody = await remaining.json();
  assert.equal(remainingBody.paid_total, 400);
  assert.equal(remainingBody.remaining, 0);
  assert.equal(remainingBody.order_completed, true);
  const overpayment = await invoke(
    paymentsHandler,
    env,
    token,
    { ...paymentBody, amount: 250 },
    `payment-${id()}`,
  );
  assert.equal(overpayment.status, 201);
  assert.equal((await overpayment.json()).remaining, -250);
  const completed = await sql`SELECT status FROM orders WHERE id = ${successfulRace.order_id}`;
  assert.equal(completed[0].status, "completed");
});
