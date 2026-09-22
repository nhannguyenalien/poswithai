import test from "node:test";
import assert from "node:assert/strict";
import { roundGold99, normalizeGoldConversion99 } from "../public/js/wholesale-math.js";
import { validateDecimalString } from "../functions/_validation.js";
import { isOrderSettled } from "../functions/api/orders/index.js";

test("wholesale gold conversion is rounded to the API decimal contract", () => {
  const sold = roundGold99(1 * (68 / 99));

  assert.equal(sold, 0.686869);
  assert.equal(validateDecimalString(sold, "gold_sold_99", { min: 0, scale: 6 }), null);
});

test("three-decimal displayed gold can settle the exact remaining balance", () => {
  const sold = roundGold99(68 / 99);

  assert.equal(normalizeGoldConversion99(sold, 0, 0.687), sold);
  assert.equal(roundGold99(sold - normalizeGoldConversion99(sold, 0, 0.687)), 0);
});

test("intentional partial gold conversion is not snapped", () => {
  assert.equal(normalizeGoldConversion99(1.234567, 0.2, 0.5), 0.5);
});

test("zero money and zero gold closes a new wholesale order without a zero payment", () => {
  assert.equal(isOrderSettled(0, 0, 0), true);
  assert.equal(isOrderSettled(1_000_000, 1_000_000, 0), true);
  assert.equal(isOrderSettled(0, 0, 0.001), false);
});
