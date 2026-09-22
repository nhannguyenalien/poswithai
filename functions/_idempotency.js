import { errorJson, json } from "./_db.js";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export async function requestHash(operation, body) {
  const bytes = new TextEncoder().encode(`${operation}:${JSON.stringify(stable(body))}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function parseIdempotency(request, operation, body) {
  const key = (request.headers.get("Idempotency-Key") || "").trim();
  if (key.length < 8 || key.length > 128) {
    return {
      response: errorJson(
        "Idempotency-Key phải dài từ 8 đến 128 ký tự",
        422,
        "IDEMPOTENCY_KEY_REQUIRED",
      ),
    };
  }
  return { key, hash: await requestHash(operation, body) };
}

export async function findIdempotency(sql, tenantId, operation, key, hash) {
  const rows = await sql`
    SELECT request_hash, response_status, response_body
    FROM api_idempotency_keys
    WHERE tenant_id = ${tenantId} AND operation = ${operation} AND idempotency_key = ${key}
    LIMIT 1
  `;
  if (!rows.length) return null;
  if (rows[0].request_hash !== hash) {
    return errorJson(
      "Idempotency-Key đã được dùng với nội dung request khác",
      409,
      "IDEMPOTENCY_CONFLICT",
    );
  }
  if (!rows[0].response_body) {
    return errorJson("Request cùng key đang được xử lý", 409, "IDEMPOTENCY_IN_PROGRESS");
  }
  return json(rows[0].response_body, rows[0].response_status || 200, {
    "Idempotency-Replayed": "true",
  });
}

export function isIdempotencyUniqueViolation(error) {
  return error?.code === "23505" && (
    error?.constraint === "api_idempotency_keys_tenant_id_operation_idempotency_key_key" ||
    error?.message?.includes("api_idempotency_keys")
  );
}
