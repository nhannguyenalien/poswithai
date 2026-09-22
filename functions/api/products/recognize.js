import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { createImageEmbedding, vectorLiteral } from "../../_recognition.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_MIN_SCORE = 0.55;
const HIGH_CONFIDENCE_SCORE = 0.82;
const HIGH_CONFIDENCE_GAP = 0.08;

function matchesImageSignature(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => bytes[i] === value);
  return mime === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "products.read");
  if (allowed instanceof Response) return allowed;
  return recognizeProduct(context, auth);
}

async function recognizeProduct({ request, env }, { tenantId }) {
  let form;
  try { form = await request.formData(); } catch { return errorJson("Form upload không hợp lệ", 400, "INVALID_MULTIPART_FORM"); }
  const file = form.get("image");
  if (!(file instanceof File)) return errorJson("Thiếu file image", 422, "VALIDATION_ERROR", [{ field: "image", message: "Bắt buộc" }]);
  if (!IMAGE_TYPES.has(file.type)) return errorJson("Chỉ hỗ trợ JPEG, PNG hoặc WebP", 415, "UNSUPPORTED_IMAGE_TYPE");
  if (!file.size || file.size > MAX_IMAGE_BYTES) return errorJson("Ảnh phải có dung lượng từ 1 byte đến 8 MB", 413, "IMAGE_TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, file.type)) return errorJson("Nội dung file không khớp định dạng ảnh", 415, "INVALID_IMAGE_CONTENT");

  let generated;
  try {
    generated = await createImageEmbedding(env, bytes, file.name, file.type);
  } catch (error) {
    console.error(JSON.stringify({ event: "recognition_embedding_failed", message: error?.message || String(error) }));
    return errorJson("Dịch vụ nhận dạng tạm thời không khả dụng", 503, "PRODUCT_RECOGNITION_UNAVAILABLE");
  }

  const sql = getDb(env);
  const value = vectorLiteral(generated.embedding);
  const configuredMin = Number(env.PRODUCT_RECOGNITION_MIN_SCORE);
  const minScore = Number.isFinite(configuredMin) ? configuredMin : DEFAULT_MIN_SCORE;
  const candidates = await sql`
    WITH image_matches AS (
      SELECT pi.product_id, pi.image_url,
             1 - (pi.embedding <=> ${value}::vector) AS score,
             ROW_NUMBER() OVER (
               PARTITION BY pi.product_id
               ORDER BY pi.embedding <=> ${value}::vector
             ) AS product_rank
      FROM product_images pi
      WHERE pi.tenant_id = ${tenantId}
        AND pi.embedding_status = 'ready'
        AND pi.embedding IS NOT NULL
        AND pi.embedding_model = ${generated.model}
    )
    SELECT p.id, p.sku, p.name, p.product_type, p.base_price,
           im.image_url AS primary_image_url, im.score
    FROM image_matches im
    JOIN products p ON p.id = im.product_id AND p.tenant_id = ${tenantId}
    WHERE im.product_rank = 1 AND im.score >= ${minScore} AND p.status = 'active'
    ORDER BY im.score DESC
    LIMIT 3
  `;
  const normalized = candidates.map((candidate) => ({ ...candidate, score: Number(Number(candidate.score).toFixed(6)) }));
  const first = normalized[0]?.score || 0;
  const second = normalized[1]?.score || 0;
  const confidence = first >= HIGH_CONFIDENCE_SCORE && first - second >= HIGH_CONFIDENCE_GAP ? "high" : "review";
  return json({ candidates: normalized, confidence, requires_confirmation: true, model: generated.model });
}
