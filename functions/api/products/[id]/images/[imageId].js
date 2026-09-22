import { getDb, json, errorJson, handleOptions } from "../../../../_db.js";
import { requireAuth, requirePermission } from "../../../../_auth.js";
import { s3DeleteObject } from "../../../../_s3.js";

function imageStorage(env) {
  return {
    bucket: env.PRODUCT_IMAGES_BUCKET,
    region: env.PRODUCT_IMAGES_REGION || env.S3_REGION,
    accessKeyId: env.PRODUCT_IMAGES_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.PRODUCT_IMAGES_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY,
    endpoint: env.PRODUCT_IMAGES_ENDPOINT || env.S3_ENDPOINT,
  };
}

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "products.write");
  if (allowed instanceof Response) return allowed;
  if (context.request.method !== "DELETE") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  const sql = getDb(context.env);
  const rows = await sql`
    SELECT id, object_key, is_primary FROM product_images
    WHERE id = ${context.params.imageId} AND product_id = ${context.params.id} AND tenant_id = ${auth.tenantId}
    LIMIT 1
  `;
  if (!rows.length) return errorJson("Không tìm thấy ảnh", 404, "PRODUCT_IMAGE_NOT_FOUND");
  const storageResult = await s3DeleteObject(imageStorage(context.env), rows[0].object_key);
  if (!storageResult.ok) return errorJson("Không thể xóa ảnh khỏi storage", 502, "IMAGE_DELETE_FAILED", { storage_status: storageResult.status });
  await sql`DELETE FROM product_images WHERE id = ${rows[0].id} AND tenant_id = ${auth.tenantId}`;
  if (rows[0].is_primary) {
    await sql`
      UPDATE product_images SET is_primary = true
      WHERE id = (SELECT id FROM product_images WHERE tenant_id = ${auth.tenantId} AND product_id = ${context.params.id} ORDER BY sort_order, created_at LIMIT 1)
    `;
  }
  return json({ success: true });
}
