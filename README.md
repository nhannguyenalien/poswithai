# POS App — Tabler + Cloudflare Pages + Neon + Google OAuth

## Stack
- **UI**: Tabler HTML (vanilla JS, no build step)
- **API**: Cloudflare Pages Functions (edge runtime)
- **DB**: Neon (PostgreSQL serverless)
- **Auth**: Google OAuth 2.0

---

## Setup lần đầu

### 1. Google Cloud Console
1. Vào https://console.cloud.google.com → tạo project
2. APIs & Services → Credentials → Create OAuth 2.0 Client
3. Application type: **Web application**
4. Authorized redirect URIs:
   - `http://localhost:8788/api/auth/callback` (local)
   - `https://your-project.pages.dev/api/auth/callback` (production)
5. Copy **Client ID** và **Client Secret**

### 2. Neon Database
1. Tạo project tại neon.tech
2. Chạy `schema_v2.sql` trong SQL Editor
3. Chạy migration: `scripts/migrate_google_auth.sql`
4. Copy **Connection string**

### 3. Local development
```bash
cp .dev.vars.example .dev.vars
# Điền DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

npm install
npm run dev
# → http://localhost:8788
```

### 4. Lần đầu đăng nhập
1. Vào `http://localhost:8788/login.html`
2. Click "Đăng nhập bằng Google"
3. Chọn tài khoản Google
4. Điền tên tiệm → bấm "Bắt đầu sử dụng"
5. Vào dashboard

### 5. Deploy production
```bash
wrangler pages secret put DATABASE_URL
wrangler pages secret put JWT_SECRET
wrangler pages secret put GOOGLE_CLIENT_ID
wrangler pages secret put GOOGLE_CLIENT_SECRET

npm run deploy
```

---

## Cấu trúc
```
functions/
  _db.js              ← Neon client + helpers
  _auth.js            ← JWT create/verify
  api/
    auth/
      google.js       ← Bắt đầu Google OAuth
      callback.js     ← Xử lý Google callback
      me.js           ← GET thông tin user
    setup/index.js    ← Tạo tenant sau lần login đầu
    health.js
    products/         ← CRUD sản phẩm + variants
    inventory/        ← Nhập/xuất/điều chỉnh kho
    orders/           ← Tạo đơn, hủy đơn
    payments/         ← Thu tiền
    customers/        ← Quản lý khách
    categories/       ← Danh mục

public/
  login.html          ← Google OAuth button
  setup.html          ← Điền thông tin tiệm (lần đầu)
  index.html          ← Dashboard
  products.html
  inventory.html
  orders.html
  customers.html
  categories.html
  js/
    auth.js           ← Token management, requireLogin()
    api.js            ← Fetch wrapper
  css/app.css

scripts/
  migrate_google_auth.sql   ← Chạy 1 lần trên Neon
```

---

## Flow đăng nhập
```
Login → /api/auth/google → Google → /api/auth/callback
  ↓ User mới          ↓ User cũ
/setup.html         /index.html?token=xxx
  → POST /api/setup
  → /index.html
```
