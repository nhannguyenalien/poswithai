import test from "node:test";
import assert from "node:assert/strict";
import { validateUuid, validateInteger, validateDecimalString, parsePagination, parseDateRange } from "../functions/_validation.js";

test("central validators enforce safe numeric contracts", () => {
  assert.ok(validateInteger(10.5, "price", { min: 0 }));
  assert.equal(validateDecimalString(1.25, "weight", { min: 0 }), null);
  assert.equal(validateDecimalString("1.250", "weight", { min: 0 }), null);
  assert.ok(validateDecimalString("1.2500000", "weight", { scale: 6 }));
  assert.ok(validateUuid("not-a-uuid"));
});

test("pagination and date range are bounded", () => {
  assert.equal(parsePagination(new URL("https://x/?limit=201")).errors.length, 1);
  assert.equal(parseDateRange(new URL("https://x/?from=2026-02-01&to=2026-01-01")).errors.length, 1);
});
