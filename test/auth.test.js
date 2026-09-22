import assert from "node:assert/strict";
import test from "node:test";

import { decodeJwtPayload } from "../public/js/auth.js";

function toBase64url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

test("decodeJwtPayload preserves Vietnamese user names", () => {
  const payload = { name: "Đất địa", email: "nhantin41@gmail.com" };
  const token = `${toBase64url(JSON.stringify({ alg: "HS256" }))}.${toBase64url(JSON.stringify(payload))}.signature`;

  assert.deepEqual(decodeJwtPayload(token), payload);
});
