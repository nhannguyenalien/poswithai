import test from "node:test";
import assert from "node:assert/strict";
import { vectorLiteral } from "../functions/_recognition.js";

test("vectorLiteral produces a pgvector-compatible normalized literal", () => {
  assert.equal(vectorLiteral([0, 0.125, -0.5]), "[0.00000000,0.12500000,-0.50000000]");
});

test("vectorLiteral rejects non-finite values", () => {
  assert.throws(() => vectorLiteral([Number.NaN]), /finite numbers/);
});
