// Adapter cho MISA meInvoice — CHƯA TRIỂN KHAI.
// Tài liệu Open API chính thức: https://www.misa.vn/154989/tai-lieu-open-api-tich-hop-hoa-don-dien-tu-misa-meinvoice-dau-ra/
// và https://doc.meinvoice.vn/api/Document/InvoicePublishing.html
// Khi cần dùng, viết issue()/cancel() theo đúng field của tài liệu trên (khác hoàn toàn
// field của Mắt Bão — không dùng chung payload) rồi đăng ký provider này trong
// functions/_einvoice/index.js.

export async function issue() {
  throw new Error("Nhà cung cấp MISA meInvoice chưa được cấu hình tích hợp. Liên hệ để triển khai thêm.");
}

export async function cancel() {
  throw new Error("Nhà cung cấp MISA meInvoice chưa được cấu hình tích hợp.");
}
