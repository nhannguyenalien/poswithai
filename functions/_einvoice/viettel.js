// Adapter cho Viettel S-Invoice — CHƯA TRIỂN KHAI.
// Tài liệu tích hợp: https://www.s-invoice.vn (mục nhà phát triển) — field khác hoàn toàn
// Mắt Bão, cần map riêng khi triển khai. Đăng ký provider này trong functions/_einvoice/index.js
// sau khi viết xong issue()/cancel().

export async function issue() {
  throw new Error("Nhà cung cấp Viettel S-Invoice chưa được cấu hình tích hợp. Liên hệ để triển khai thêm.");
}

export async function cancel() {
  throw new Error("Nhà cung cấp Viettel S-Invoice chưa được cấu hình tích hợp.");
}
