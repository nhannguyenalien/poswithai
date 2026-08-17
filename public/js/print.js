/**
 * print.js — Tiện ích mở trang in
 * Import trong trang cần in: import { printReceipt, printInvoiceA4, printLabels } from "/js/print.js";
 */

/**
 * In bill cuộn (thermal 80mm) sau khi tạo đơn.
 * @param {string} orderId
 */
export function printReceipt(orderId) {
  const url = `/print/receipt.html?order_id=${orderId}`;
  openPrint(url, 400, 700);
}

/**
 * In hoá đơn A4 cho đơn bán lẻ hoặc bán sỉ.
 * @param {string} orderId
 * @param {"retail"|"wholesale"} type
 * @param {Window} [win] - cửa sổ đã mở sẵn (xem openPendingPrintWindow) để điều hướng vào,
 *   thay vì mở mới — tránh bị trình duyệt chặn popup khi gọi sau các lệnh await.
 */
export function printInvoiceA4(orderId, type = "retail", win) {
  const url = `/print/invoice-a4.html?order_id=${orderId}&type=${type}`;
  if (win) win.location.href = url;
  else openPrint(url, 900, 700);
}

/**
 * Mở sẵn 1 cửa sổ trống NGAY lúc người dùng click (trước khi có lệnh await nào) — trình
 * duyệt chỉ cho window.open() không bị chặn popup khi gọi trực tiếp trong lúc xử lý sự
 * kiện người dùng; gọi sau khi đã await API thường bị chặn âm thầm, không báo lỗi gì cả.
 * Điều hướng cửa sổ này vào URL thật sau khi có kết quả bằng printInvoiceA4(...,...,win)
 * hoặc printReceipt(...,win).
 */
export function openPendingPrintWindow(w = 900, h = 700) {
  return openPrint("about:blank", w, h);
}

/**
 * In tem sản phẩm (multiple variants).
 * @param {string[]} variantIds — mảng variant ID
 * @param {number} copies — số bản in mỗi variant (mặc định 1)
 */
export function printLabels(variantIds, copies = 1) {
  const ids = Array.isArray(variantIds) ? variantIds.join(",") : variantIds;
  const url = `/print/label.html?variant_ids=${ids}&copies=${copies}`;
  openPrint(url, 900, 700);
}

/**
 * In tem 1 variant nhanh.
 * @param {string} variantId
 * @param {number} copies
 */
export function printSingleLabel(variantId, copies = 1) {
  printLabels([variantId], copies);
}

function openPrint(url, w = 800, h = 700) {
  const left = Math.round((screen.width  - w) / 2);
  const top  = Math.round((screen.height - h) / 2);
  return window.open(url, "_blank",
    `width=${w},height=${h},left=${left},top=${top},toolbar=0,scrollbars=1`);
}
