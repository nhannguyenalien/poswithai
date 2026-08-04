// functions/_s3.js — AWS Signature V4, đủ dùng để PUT 1 object lên S3 (hoặc dịch vụ
// tương thích S3 như Cloudflare R2/Backblaze B2 qua S3_ENDPOINT) bằng Web Crypto API,
// không cần AWS SDK (SDK không chạy tốt trong môi trường Cloudflare Workers).

async function sha256Hex(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, typeof msg === "string" ? new TextEncoder().encode(msg) : msg);
  return new Uint8Array(sig);
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Upload 1 object lên S3 (PUT), trả về { ok, status, url, error }.
 * @param {object} cfg { bucket, region, accessKeyId, secretAccessKey, endpoint? }
 * @param {string} key       — đường dẫn object trong bucket, VD "backups/tenant-x/2026-07-31.json"
 * @param {string} body      — nội dung file (text)
 * @param {string} contentType
 */
export async function s3PutObject(cfg, key, body, contentType = "application/json") {
  const { bucket, region, accessKeyId, secretAccessKey } = cfg;
  const host = cfg.endpoint
    ? new URL(cfg.endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;
  const url = cfg.endpoint
    ? `${cfg.endpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : `https://${host}/${key}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);
  const canonicalUri = cfg.endpoint ? `/${bucket}/${key}` : `/${key}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate    = await hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion  = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "Authorization": authorization,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, url, error: text.slice(0, 500) || `S3 trả lỗi HTTP ${res.status}` };
  }
  return { ok: true, status: res.status, url };
}

/** true nếu đủ biến môi trường để dùng S3 (S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). */
export function isS3Configured(env) {
  return !!(env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}
