// functions/api/auth/google.js
// GET /api/auth/google — Redirect người dùng đến trang đăng nhập Google
import { handleOptions } from "../../_db.js";

export async function onRequest({ request, env }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  if (!env.GOOGLE_CLIENT_ID) {
    return new Response("GOOGLE_CLIENT_ID chưa được set", { status: 500 });
  }

  // Tạo state để chống CSRF
  const state = crypto.randomUUID();

  const origin      = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id",     env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri",  redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope",         "openid email profile");
  googleUrl.searchParams.set("state",         state);
  googleUrl.searchParams.set("access_type",   "online");
  googleUrl.searchParams.set("prompt",        "select_account");

  // Lưu state vào cookie HttpOnly để verify ở callback
  return new Response(null, {
    status: 302,
    headers: {
      "Location":   googleUrl.toString(),
      "Set-Cookie": `oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`,
    },
  });
}
