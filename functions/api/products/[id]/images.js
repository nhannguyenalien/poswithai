import { getDb, json, errorJson, handleOptions } from "../../../_db.js";
import { requireAuth, requirePermission } from "../../../_auth.js";
import { s3PutObject } from "../../../_s3.js";
import { createImageEmbedding, vectorLiteral } from "../../../_recognition.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function matchesImageSignature(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => bytes[i] === value);
  if (mime === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function imageStorage(env) {
  const cfg = {
    bucket: env.PRODUCT_IMAGES_BUCKET,
    region: env.PRODUCT_IMAGES_REGION || env.S3_REGION,
    accessKeyId: env.PRODUCT_IMAGES_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.PRODUCT_IMAGES_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY,
    endpoint: env.PRODUCT_IMAGES_ENDPOINT || env.S3_ENDPOINT,
  };
  const publicBaseUrl = (env.PRODUCT_IMAGES_PUBLIC_URL || "").replace(/\/$/, "");
  return { cfg, publicBaseUrl, ready: !!(cfg.bucket && cfg.region && cfg.accessKeyId && cfg.secretAccessKey && publicBaseUrl) };
}

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const permission = context.request.method === "GET" ? "products.read" : "products.write";
  const allowed = await requirePermission(context, auth, permission);
  if (allowed instanceof Response) return allowed;
  if (context.request.method === "GET") return listImages(context, auth);
  if (context.request.method === "POST") return uploadImage(context, auth);
  return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
}

async function findProduct(sql, tenantId, productId) {
  const rows = await sql`SELECT id FROM products WHERE id = ${productId} AND tenant_id = ${tenantId} LIMIT 1`;
  return rows[0] || null;
}

async function listImages({ env, params }, { tenantId }) {
  const sql = getDb(env);
  if (!await findProduct(sql, tenantId, params.id)) return errorJson("Không tìm thấy sản phẩm", 404, "PRODUCT_NOT_FOUND");
  const images = await sql`
    SELECT id, product_id, image_url, mime_type, size_bytes, alt_text, sort_order, is_primary, created_at
    FROM product_images
    WHERE tenant_id = ${tenantId} AND product_id = ${params.id}
    ORDER BY is_primary DESC, sort_order ASC, created_at ASC
  `;
  return json({ images });
}

async function uploadImage({ request, env, params }, { tenantId, userId }) {
  const sql = getDb(env);
  if (!await findProduct(sql, tenantId, params.id)) return errorJson("Không tìm thấy sản phẩm", 404, "PRODUCT_NOT_FOUND");
  const storage = imageStorage(env);
  if (!storage.ready) return errorJson(
    "Storage ảnh sản phẩm chưa được cấu hình",
    503,
    "PRODUCT_IMAGE_STORAGE_NOT_CONFIGURED",
    { required: ["PRODUCT_IMAGES_BUCKET", "PRODUCT_IMAGES_PUBLIC_URL", "PRODUCT_IMAGES_REGION", "PRODUCT_IMAGES_ACCESS_KEY_ID", "PRODUCT_IMAGES_SECRET_ACCESS_KEY"] },
  );
  let form;
  try { form = await request.formData(); } catch { return errorJson("Form upload không hợp lệ", 400, "INVALID_MULTIPART_FORM"); }
  const file = form.get("image");
  if (!(file instanceof File)) return errorJson("Thiếu file image", 422, "VALIDATION_ERROR", [{ field: "image", message: "Bắt buộc" }]);
  if (!EXTENSIONS[file.type]) return errorJson("Chỉ hỗ trợ JPEG, PNG hoặc WebP", 415, "UNSUPPORTED_IMAGE_TYPE");
  if (!file.size || file.size > MAX_IMAGE_BYTES) return errorJson("Ảnh phải có dung lượng từ 1 byte đến 8 MB", 413, "IMAGE_TOO_LARGE");
  const fileBytes = await file.arrayBuffer();
  if (!matchesImageSignature(new Uint8Array(fileBytes), file.type)) {
    return errorJson("Nội dung file không khớp định dạng ảnh", 415, "INVALID_IMAGE_CONTENT");
  }

  const id = crypto.randomUUID();
  const objectKey = `products/${tenantId}/${params.id}/${id}.${EXTENSIONS[file.type]}`;
  const result = await s3PutObject(storage.cfg, objectKey, fileBytes, file.type);
  if (!result.ok) return errorJson("Không thể tải ảnh lên storage", 502, "IMAGE_UPLOAD_FAILED", { storage_status: result.status });
  const imageUrl = `${storage.publicBaseUrl}/${objectKey}`;
  const requestedPrimary = String(form.get("is_primary") || "") === "true";
  const existing = await sql`SELECT COUNT(*) AS total FROM product_images WHERE tenant_id = ${tenantId} AND product_id = ${params.id}`;
  const isPrimary = requestedPrimary || Number(existing[0].total) === 0;
  const now = new Date().toISOString();
  if (isPrimary) await sql`UPDATE product_images SET is_primary = false WHERE tenant_id = ${tenantId} AND product_id = ${params.id}`;
  const rows = await sql`
    INSERT INTO product_images (id, tenant_id, product_id, object_key, image_url, mime_type, size_bytes, alt_text, sort_order, is_primary, created_by, created_at)
    VALUES (${id}, ${tenantId}, ${params.id}, ${objectKey}, ${imageUrl}, ${file.type}, ${file.size}, ${String(form.get("alt_text") || "").trim() || null}, 0, ${isPrimary}, ${userId || null}, ${now})
    RETURNING id, product_id, image_url, mime_type, size_bytes, alt_text, sort_order, is_primary, created_at
  `;
  let embeddingStatus = "pending";
  try {
    const generated = await createImageEmbedding(env, fileBytes, file.name, file.type);
    const value = vectorLiteral(generated.embedding);
    await sql`
      UPDATE product_images
      SET embedding = ${value}::vector,
          embedding_model = ${generated.model},
          embedding_status = 'ready',
          embedding_updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    embeddingStatus = "ready";
  } catch (error) {
    console.error(JSON.stringify({ event: "product_image_embedding_failed", image_id: id, message: error?.message || String(error) }));
    await sql`
      UPDATE product_images SET embedding_status = 'failed', embedding_updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    embeddingStatus = "failed";
  }
  return json({ ...rows[0], embedding_status: embeddingStatus }, 201);
}
