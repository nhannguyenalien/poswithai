// public/js/auth.js
const TOKEN_KEY = "pos_token";
const USER_KEY  = "pos_user";

export function getToken()  { return localStorage.getItem(TOKEN_KEY); }
export function getUser()   {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`,
  };
}
export function logout() {
  clearSession();
  window.location.href = "/login.html";
}

// Điền tên user vào element #user-name nếu có
export function renderUserInfo() {
  const user = getUser();
  const el   = document.getElementById("user-name");
  if (el && user) el.textContent = user.name || user.email || "...";
}

/**
 * Gọi ở đầu mỗi trang cần đăng nhập.
 * - Nếu URL có ?token= (từ Google callback) → lưu vào localStorage rồi xóa khỏi URL
 * - Nếu không có token → redirect về login
 */
export function requireLogin() {
  // Kiểm tra token từ Google OAuth redirect
  const params    = new URLSearchParams(window.location.search);
  const urlToken  = params.get("token");

  if (urlToken) {
    // Parse user info từ JWT payload (chỉ để hiển thị, không cần verify ở client)
    try {
      const base64  = urlToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      setSession(urlToken, {
        name:  payload.name  || payload.email || "User",
        email: payload.email || "",
      });
    } catch {
      setSession(urlToken, { name: "User", email: "" });
    }
    // Xóa token khỏi URL để không hiện trên address bar
    params.delete("token");
    const cleanUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", cleanUrl);
  }

  if (!getToken()) {
    window.location.href = "/login.html";
  }
}
