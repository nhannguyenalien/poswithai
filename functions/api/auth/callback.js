// functions/api/auth/callback.js
// GET /api/auth/callback — Google OAuth callback
import { getDb } from "../../_db.js";
import { createToken } from "../../_auth.js";

function parseCookies(header) {
  return Object.fromEntries(
    (header || "").split(";").map(c => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
}

export async function onRequest({ request, env }) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get("code");
  const state  = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  // Người dùng bấm Cancel trên Google
  if (errParam) {
    return redirect(`/login.html?error=${errParam}`, true);
  }

  // Verify CSRF state
  const cookies    = parseCookies(request.headers.get("Cookie"));
  const savedState = cookies.oauth_state;
  if (!state || state !== savedState) {
    return redirect("/login.html?error=invalid_state", true);
  }

  if (!code) return redirect("/login.html?error=no_code", true);

  // 1. Đổi code lấy access_token từ Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  `${url.origin}/api/auth/callback`,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) return redirect("/login.html?error=token_failed", true);
  const { access_token } = await tokenRes.json();

  // 2. Lấy thông tin user từ Google
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileRes.ok) return redirect("/login.html?error=profile_failed", true);

  const gUser = await profileRes.json();
  // gUser: { id, email, name, picture, verified_email }

  const sql = getDb(env);

  // 3. Tìm user trong DB theo google_id
  const users = await sql`
    SELECT u.id, u.tenant_id, u.email, u.name, u.status
    FROM users u
    WHERE u.google_id = ${gUser.id}
    LIMIT 1
  `;

  if (users.length) {
    // User đã có → kiểm tra status
    const user = users[0];
    if (user.status !== "active") {
      return redirect("/login.html?error=account_suspended", true);
    }

    // Cập nhật avatar nếu thay đổi
    await sql`
      UPDATE users SET avatar_url = ${gUser.picture || null}, updated_at = ${new Date().toISOString()}
      WHERE id = ${user.id}
    `;

    const token = await createToken(
      { userId: user.id, tenantId: user.tenant_id, email: user.email },
      env.JWT_SECRET
    );

    // Redirect về dashboard, token đính kèm để JS lưu vào localStorage
    return redirect(`/dashboard.html?token=${token}`, true);
  }

  // 4. User mới → tạo temp token chứa Google info, redirect về setup
  const tempToken = await createToken(
    {
      googleId:     gUser.id,
      email:        gUser.email,
      name:         gUser.name,
      avatar:       gUser.picture,
      setupPending: true,        // flag: chưa có tenant
    },
    env.JWT_SECRET,
    0.0417  // 1 tiếng để hoàn thành setup
  );

  return redirect(`/setup.html?token=${tempToken}`, true);
}

function redirect(location, clearStateCookie = false) {
  const headers = new Headers({ Location: location });
  if (clearStateCookie) {
    headers.set("Set-Cookie", "oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/");
  }
  return new Response(null, { status: 302, headers });
}
