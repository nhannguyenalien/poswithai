# Checklist chạy thử — POS App

## Bước 1: Chuẩn bị Neon DB
Vào Neon SQL Editor, chạy theo thứ tự:

```
1. schema_v2.sql                    ← 20 bảng core
2. scripts/migrate_google_auth.sql  ← cột google_id, avatar_url cho users
3. scripts/migrate_gold_invoices.sql← 3 bảng hoá đơn vàng
4. scripts/migrate_metal_details.sql← gold_product_details + silver_product_details
```

## Bước 2: Google Cloud Console
1. https://console.cloud.google.com → tạo project
2. APIs & Services → Credentials → Create OAuth 2.0 Client (Web application)
3. Authorized redirect URIs:
   - `http://localhost:8788/api/auth/callback`   ← dev
   - `https://your-app.pages.dev/api/auth/callback` ← production
4. Copy Client ID và Client Secret

## Bước 3: Tạo .dev.vars
```
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
JWT_SECRET=chuoi-ngau-nhien-dai-it-nhat-32-ky-tu
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```

## Bước 4: Chạy local
```bash
npm install
npm run dev
# → http://localhost:8788
```

## Bước 5: Lần đầu đăng nhập
1. Vào http://localhost:8788/login.html
2. Bấm "Đăng nhập bằng Google"
3. Chọn tài khoản Google
4. Điền tên tiệm → "Bắt đầu sử dụng"
5. Vào dashboard ✅

## Bước 6: Cài đặt cửa hàng (quan trọng cho in ấn)
Vào Settings → điền:
- Tên cửa hàng
- Địa chỉ
- SĐT
→ Lưu → Thông tin này hiện trên tất cả hoá đơn và bill

## Test Flow đầy đủ:

### Flow 1: POS Bán lẻ
```
Sản phẩm → Thêm variant → Nhập kho → Bán hàng → Thanh toán → In bill
```

### Flow 2: Bán sỉ
```
Bán sỉ → Chọn khách → Thêm sản phẩm → Tạo đơn → In A4
```

### Flow 3: Ngành vàng
```
Giá Vàng → Thêm loại vàng → Cập nhật giá
→ HĐ Vàng → Lập hoá đơn → Lưu & In
```

### Flow 4: In tem
```
Sản phẩm → nút 🏷️ Tem → Chọn variant → In
```

## Deploy Cloudflare Pages
```bash
wrangler pages secret put DATABASE_URL
wrangler pages secret put JWT_SECRET
wrangler pages secret put GOOGLE_CLIENT_ID
wrangler pages secret put GOOGLE_CLIENT_SECRET
npm run deploy
```
