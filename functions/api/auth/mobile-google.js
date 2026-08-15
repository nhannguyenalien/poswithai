import { createRemoteJWKSet, jwtVerify } from "jose";

import { createToken } from "../../_auth.js";
import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { createMobileSession } from "../../_mobile-session.js";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const windowsGoogleClientId =
  "982593294309-s06qd1nq2gubgfmerugau3mft4knfqpp.apps.googleusercontent.com";

async function verifyGoogleToken(idToken, audience) {
  const { payload } = await jwtVerify(idToken, googleKeys, {
    audience,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("Google account is missing a verified email");
  }
  return payload;
}

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "POST") {
    return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }
  if (!env.GOOGLE_CLIENT_ID) {
    return errorJson("Google Sign-In chưa được cấu hình", 503, "GOOGLE_AUTH_NOT_CONFIGURED");
  }

  let body;
  try { body = await request.json(); }
  catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  if (!body.id_token || typeof body.id_token !== "string") {
    return errorJson("Thiếu Google ID token", 422, "VALIDATION_ERROR");
  }

  let profile;
  try {
    const audiences = [env.GOOGLE_CLIENT_ID, env.GOOGLE_DESKTOP_CLIENT_ID, windowsGoogleClientId]
      .filter(Boolean);
    profile = await verifyGoogleToken(body.id_token, audiences);
  } catch {
    return errorJson("Google ID token không hợp lệ hoặc đã hết hạn", 401, "GOOGLE_TOKEN_INVALID");
  }

  const sql = getDb(env);
  const email = profile.email.toLowerCase();
  const users = await sql`
    SELECT id, tenant_id, name, email, google_id, status
    FROM users
    WHERE google_id = ${profile.sub} OR LOWER(email) = ${email}
    ORDER BY CASE WHEN google_id = ${profile.sub} THEN 0 ELSE 1 END
    LIMIT 1
  `;

  if (users.length) {
    const user = users[0];
    if (user.status !== "active") {
      return errorJson("Tài khoản đã bị khóa", 403, "ACCOUNT_DISABLED");
    }
    if (user.google_id && user.google_id !== profile.sub) {
      return errorJson("Email này đã liên kết với tài khoản Google khác", 409, "GOOGLE_ACCOUNT_CONFLICT");
    }
    if (!user.google_id) {
      await sql`
        UPDATE users
        SET google_id = ${profile.sub}, avatar_url = COALESCE(avatar_url, ${profile.picture || null}),
            updated_at = ${new Date().toISOString()}
        WHERE id = ${user.id}
      `;
    }
    return json({
      ...(await createMobileSession(sql, env, user)),
      user: { id: user.id, name: user.name, email: user.email },
    });
  }

  const setupToken = await createToken({
    googleId: profile.sub,
    email,
    name: profile.name || email,
    avatar: profile.picture || null,
    setupPending: true,
    mobile: true,
  }, env.JWT_SECRET, 1 / 24);

  return json({
    setup_required: true,
    setup_token: setupToken,
    profile: { name: profile.name || email, email, avatar: profile.picture || null },
  });
}
