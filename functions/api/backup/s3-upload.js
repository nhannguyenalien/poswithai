// POST /api/backup/s3-upload — xuất dữ liệu rồi đẩy thẳng lên S3 (hoặc dịch vụ tương thích
// S3 như Cloudflare R2) thay vì tải về máy. Cần cấu hình sẵn các secret:
//   wrangler pages secret put S3_BUCKET
//   wrangler pages secret put S3_REGION
//   wrangler pages secret put S3_ACCESS_KEY_ID
//   wrangler pages secret put S3_SECRET_ACCESS_KEY
//   wrangler pages secret put S3_ENDPOINT   (tuỳ chọn — dùng cho R2/dịch vụ khác AWS)
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";
import { buildBackup } from "./export.js";
import { s3PutObject, isS3Configured } from "../../_s3.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "POST") return errorJson("Method not allowed", 405);

  if (!isS3Configured(context.env)) {
    return errorJson(
      "Chưa cấu hình S3 trên server — cần chạy 'wrangler pages secret put S3_BUCKET' (và S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) trước. Dùng nút Tải về trong lúc chờ.",
      409
    );
  }

  const backup = await buildBackup(getDb(context.env), auth.tenantId);
  const body = JSON.stringify(backup);
  const key = `pos-backups/${auth.tenantId}/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  const result = await s3PutObject({
    bucket: context.env.S3_BUCKET,
    region: context.env.S3_REGION,
    accessKeyId: context.env.S3_ACCESS_KEY_ID,
    secretAccessKey: context.env.S3_SECRET_ACCESS_KEY,
    endpoint: context.env.S3_ENDPOINT || null,
  }, key, body);

  if (!result.ok) {
    return errorJson(`Tải lên S3 thất bại: ${result.error}`, 502);
  }

  return json({ uploaded: true, key, counts: backup.counts });
}
