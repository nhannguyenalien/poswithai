// functions/_auth.js — JWT HS256 via Web Crypto API

// ── BASE64URL ────────────────────────────────────────────────────────────────

// Encode TEXT (JSON payload) → base64url. Xử lý đúng UTF-8/tiếng Việt.
function textToBase64url(str) {
  const bytes = new TextEncoder().encode(str); // UTF-8 bytes
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Encode BINARY (HMAC bytes) → base64url. KHÔNG dùng TextEncoder (sẽ corrupt).
function bytesToBase64url(buf) {
  let bin = "";
  new Uint8Array(buf).forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Decode base64url → Uint8Array (dùng để verify signature)
function base64urlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

// Decode base64url payload → string (xử lý UTF-8 tiếng Việt đúng cách)
function base64urlToText(str) {
  const bytes = base64urlToBytes(str);
  return new TextDecoder().decode(bytes);
}

// ── HMAC KEY ─────────────────────────────────────────────────────────────────

async function getKey(secret, usage) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Tạo JWT HS256.
 * @param {object} payload  — data cần encode
 * @param {string} secret   — env.JWT_SECRET
 * @param {number} expDays  — thời hạn (ngày), mặc định 7
 */
export async function createToken(payload, secret, expDays = 7) {
  const header = textToBase64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = textToBase64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + Math.round(expDays * 86400),
  }));

  const key    = await getKey(secret, "sign");
  const sigBuf = await crypto.subtle.sign(
    "HMAC", key,
    new TextEncoder().encode(`${header}.${body}`)
  );
  const sig = bytesToBase64url(sigBuf); // binary → base64url (không qua TextEncoder)

  return `${header}.${body}.${sig}`;
}

/**
 * Verify JWT. Trả payload nếu hợp lệ, null nếu sai/hết hạn.
 */
export async function verifyToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;

    // Verify HMAC signature
    const key   = await getKey(secret, "verify");
    const valid = await crypto.subtle.verify(
      "HMAC", key,
      base64urlToBytes(sig),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;

    // Decode payload (UTF-8 tiếng Việt)
    const payload = JSON.parse(base64urlToText(body));

    // Kiểm tra hết hạn
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware: kiểm tra Authorization header, trả { userId, tenantId, email, isApiToken }
 * hoặc Response 401/403. Chấp nhận CẢ 2 loại token dùng chung 1 header
 * "Authorization: Bearer <token>":
 *   - JWT phiên đăng nhập trên web (ngắn hạn, tự động hết hạn theo session)
 *   - API token dài hạn cho tích hợp bên ngoài (tiền tố "pos_", xem functions/api/api-tokens/)
 * Nhờ mọi endpoint đều gọi chung hàm này nên bật API token không cần sửa từng route.
 */
export async function requireAuth({ request, env }) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Chưa đăng nhập" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const token = header.slice(7);

  if (token.startsWith("pos_")) return verifyApiToken(token, env);

  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Token không hợp lệ hoặc hết hạn" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  if (payload.setupPending) {
    return new Response(JSON.stringify({ error: "Cần hoàn thành setup", setupPending: true }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }
  if (!payload.tenantId) {
    return new Response(JSON.stringify({ error: "Token thiếu tenantId" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  return { userId: payload.userId, tenantId: payload.tenantId, email: payload.email, isApiToken: false };
}

// ── API TOKEN (tích hợp bên ngoài) ────────────────────────────────────────────

/**
 * Băm token bằng SHA-256 để lưu/so khớp trong DB — token thật (entropy cao, sinh ngẫu
 * nhiên) không cần salt/hash chậm như mật khẩu, khác với hashPassword bên dưới.
 */
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sinh 1 API token mới dạng "pos_<48 ký tự hex ngẫu nhiên>" (192 bit entropy).
 * Trả về { token, hash, prefix } — chỉ "token" (bản thật) được trả về 1 LẦN DUY NHẤT lúc
 * tạo; từ đó về sau DB chỉ giữ "hash" để so khớp, không ai (kể cả admin) xem lại được nữa.
 */
export async function generateApiToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const token = `pos_${hex}`;
  const hash = await sha256Hex(token);
  const prefix = token.slice(0, 12) + "…";
  return { token, hash, prefix };
}

async function verifyApiToken(token, env) {
  const { getDb } = await import("./_db.js");
  const sql = getDb(env);
  const hash = await sha256Hex(token);

  const rows = await sql`
    SELECT id, tenant_id, created_by, revoked_at, rate_limit_per_minute
    FROM api_tokens WHERE token_hash = ${hash} LIMIT 1
  `;
  if (!rows.length || rows[0].revoked_at) {
    return new Response(JSON.stringify({ error: "API token không hợp lệ hoặc đã bị thu hồi" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const tokenRow = rows[0];

  const rateLimitRes = await checkRateLimit(sql, tokenRow.id, tokenRow.rate_limit_per_minute);
  if (rateLimitRes) return rateLimitRes;

  const now = new Date().toISOString();
  await sql`UPDATE api_tokens SET last_used_at = ${now} WHERE id = ${tokenRow.id}`;

  return { userId: tokenRow.created_by, tenantId: tokenRow.tenant_id, email: null, isApiToken: true };
}

/**
 * Đếm request theo từng phút (fixed window) cho 1 token — vượt giới hạn thì trả Response
 * 429 kèm header Retry-After, không thì trả null (cho qua). Đếm bằng UPSERT nguyên tử nên
 * an toàn kể cả nhiều request cùng token bắn song song (không bị đếm thiếu do race).
 */
async function checkRateLimit(sql, tokenId, limitPerMinute) {
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();

  const rows = await sql`
    INSERT INTO api_rate_limits (token_id, window_start, request_count)
    VALUES (${tokenId}, ${windowStart}, 1)
    ON CONFLICT (token_id, window_start)
    DO UPDATE SET request_count = api_rate_limits.request_count + 1
    RETURNING request_count
  `;
  const count = rows[0].request_count;

  // Dọn rác cơ hội — ~1/50 request thì xoá bớt window cũ (>10 phút), khỏi cần cron riêng
  // mà bảng vẫn không phình to vô hạn theo thời gian.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 10 * 60000).toISOString();
    sql`DELETE FROM api_rate_limits WHERE window_start < ${cutoff}`.catch(() => {});
  }

  if (count > limitPerMinute) {
    return new Response(JSON.stringify({
      error: `Vượt giới hạn ${limitPerMinute} request/phút cho token này. Thử lại sau.`,
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
        "X-RateLimit-Limit": String(limitPerMinute),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  return null;
}

// ── PASSWORD (PBKDF2) ─────────────────────────────────────────────────────────

/**
 * Hash mật khẩu → "saltHex:hashHex" lưu vào DB.
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key  = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  const toHex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("");
  return `${toHex(salt.buffer)}:${toHex(hash)}`;
}

/**
 * Xác minh mật khẩu với hash đã lưu.
 */
export async function verifyPassword(password, stored) {
  if (!stored?.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key  = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  const newHex = Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2,"0")).join("");
  return newHex === hashHex;
}