// GET /api/tax-lookup/:code — tra cứu tên/địa chỉ doanh nghiệp theo mã số thuế,
// dùng khi thêm khách hàng là doanh nghiệp (chỉ cần nhập MST, tự điền tên + địa chỉ).
// Proxy qua backend (thay vì gọi thẳng từ trình duyệt) để tránh lộ endpoint bên thứ 3
// trực tiếp ra client và xử lý lỗi/timeout gọn một chỗ.
// Nguồn: VietQR — https://www.vietqr.io/en/danh-sach-api/tax-id-lookup/
import { json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth } from "../../_auth.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  if (context.request.method !== "GET") return errorJson("Method not allowed", 405);

  const taxCode = (context.params.code || "").trim();
  if (!/^\d{10}(-\d{3})?$/.test(taxCode)) {
    return errorJson("Mã số thuế không hợp lệ (cần 10 số, có thể kèm -XXX chi nhánh)", 422);
  }

  let res;
  try {
    res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(taxCode)}`);
  } catch (err) {
    return errorJson("Không thể kết nối dịch vụ tra cứu MST, vui lòng thử lại", 502);
  }

  let payload;
  try { payload = await res.json(); } catch { return errorJson("Phản hồi tra cứu MST không hợp lệ", 502); }

  if (payload.code !== "00" || !payload.data) {
    return errorJson(payload.desc || "Không tìm thấy doanh nghiệp với mã số thuế này", 404);
  }

  return json({
    tax_code:   payload.data.id,
    name:       payload.data.name,
    short_name: payload.data.shortName || null,
    address:    payload.data.address || null,
    status:     payload.data.status || null,
  });
}
