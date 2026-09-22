import { getDb, json, errorJson, handleOptions } from "../../../../../_db.js";
import { requireAuth, requirePermission } from "../../../../../_auth.js";
import { createImageEmbedding, vectorLiteral } from "../../../../../_recognition.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "products.write");
  if (allowed instanceof Response) return allowed;

  const sql = getDb(context.env);
  const rows = await sql`
    SELECT id, image_url, mime_type
    FROM product_images
    WHERE id = ${context.params.imageId}
      AND product_id = ${context.params.id}
      AND tenant_id = ${auth.tenantId}
    LIMIT 1
  `;
  if (!rows.length) return errorJson("Không tìm thấy ảnh sản phẩm", 404, "PRODUCT_IMAGE_NOT_FOUND");

  try {
    const response = await fetch(rows[0].image_url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!response.ok) throw new Error(`IMAGE_HTTP_${response.status}`);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("INVALID_IMAGE_SIZE");
    const generated = await createImageEmbedding(context.env, bytes, "product-image", rows[0].mime_type);
    const value = vectorLiteral(generated.embedding);
    await sql`
      UPDATE product_images
      SET embedding = ${value}::vector, embedding_model = ${generated.model},
          embedding_status = 'ready', embedding_updated_at = NOW()
      WHERE id = ${rows[0].id} AND tenant_id = ${auth.tenantId}
    `;
    return json({ id: rows[0].id, embedding_status: "ready", embedding_model: generated.model });
  } catch (error) {
    console.error(JSON.stringify({ event: "product_image_reindex_failed", image_id: rows[0].id, message: error?.message || String(error) }));
    await sql`UPDATE product_images SET embedding_status = 'failed', embedding_updated_at = NOW() WHERE id = ${rows[0].id} AND tenant_id = ${auth.tenantId}`;
    return errorJson("Không thể tạo embedding cho ảnh", 502, "PRODUCT_IMAGE_REINDEX_FAILED");
  }
}
