import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest } from "../functions/mcp.js";
import { TOOLS, buildPath } from "../functions/_api-catalog.js";

const rpc = (body, headers = {}) => onRequest({
  request: new Request("https://pos.test/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }),
}).then(async r => ({ status: r.status, body: r.status === 202 ? null : await r.json() }));

test("initialize + tools/list", async () => {
  const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(init.body.result.serverInfo.name, "pos-app");
  const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(list.body.result.tools.length, TOOLS.length);
  assert.ok(list.body.result.tools.every(t => t.annotations.readOnlyHint));
});

test("notification returns 202", async () => {
  assert.equal((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);
});

test("tools/call without token is an error result", async () => {
  const r = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_products", arguments: {} } });
  assert.equal(r.body.result.isError, true);
});

test("buildPath substitutes path params and drops unknown args", () => {
  const t = TOOLS.find(x => x.name === "get_order");
  assert.equal(buildPath(t, { id: "a/b" }), "/api/orders/a%2Fb");
  assert.equal(buildPath(t, {}), null);
  assert.equal(buildPath(TOOLS.find(x => x.name === "list_orders"), { status: "pending", evil: "1" }), "/api/orders?status=pending");
});

test("public/openapi.yaml matches openapi.yaml", () => {
  assert.equal(readFileSync("public/openapi.yaml", "utf8"), readFileSync("openapi.yaml", "utf8"));
});
