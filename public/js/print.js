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
 */
export function printInvoiceA4(orderId, type = "retail") {
  const url = `/print/invoice-a4.html?order_id=${orderId}&type=${type}`;
  openPrint(url, 900, 700);
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
  window.open(url, "_blank",
    `width=${w},height=${h},left=${left},top=${top},toolbar=0,scrollbars=1`);
}
