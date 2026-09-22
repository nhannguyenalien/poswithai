import { createToken, sha256Hex } from "./_auth.js";

function randomRefreshToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "posr_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createMobileSession(sql, env, user) {
  const refreshToken = randomRefreshToken();
  const refreshHash = await sha256Hex(refreshToken);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await sql`
    INSERT INTO mobile_refresh_tokens (id, tenant_id, user_id, token_hash, expires_at)
    VALUES (${id}, ${user.tenant_id}, ${user.id}, ${refreshHash}, ${expiresAt})
  `;
  const accessToken = await createToken(
    { userId: user.id, tenantId: user.tenant_id, email: user.email, tokenType: "access" },
    env.JWT_SECRET, 15 / 1440
  );
  return { access_token: accessToken, refresh_token: refreshToken, token_type: "Bearer", expires_in: 900 };
}
