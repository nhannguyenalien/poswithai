import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("schema baseline checksum and table count match manifest", async () => {
  const [schema, manifestText] = await Promise.all([
    readFile(new URL("../scripts/schema_v2.sql", import.meta.url), "utf8"),
    readFile(new URL("../scripts/migrations.json", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const checksum = createHash("sha256").update(schema).digest("hex");
  const tableCount = (schema.match(/^CREATE TABLE "public"/gm) || []).length;
  assert.equal(checksum, manifest.baseline.sha256);
  assert.equal(tableCount, manifest.baseline.tables);
});

test("migration files match the ordered manifest checksums", async () => {
  const manifest = JSON.parse(await readFile(new URL("../scripts/migrations.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(manifest.migration_checksums), manifest.migrations);
  for (const filename of manifest.migrations) {
    const sql = await readFile(new URL(`../scripts/${filename}`, import.meta.url));
    assert.equal(createHash("sha256").update(sql).digest("hex"), manifest.migration_checksums[filename], filename);
  }
});
