// Dispatcher xuất hoá đơn điện tử (VAT) cho hoá đơn vàng — chọn provider theo settings
// của tenant rồi gọi adapter tương ứng. Mỗi adapter export issue(config, payload) và
// cancel(config, fkey) với cùng 1 "payload chuẩn hoá" (buildInvoicePayload bên dưới),
// nhưng tự map sang field riêng của provider đó bên trong adapter.
import * as matbao from "./matbao.js";
import * as misa   from "./misa.js";
import * as viettel from "./viettel.js";
import { soTienBangChu } from "./numberToWords.js";

const PROVIDERS = { matbao, misa, viettel };

async function loadSettings(sql, tenantId) {
  const rows = await sql`SELECT key, value FROM settings WHERE tenant_id = ${tenantId}`;
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function toArisingDate(isoDate) {
  const [y, m, d] = (isoDate || "").split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function buildInvoicePayload(invoice, items, settings) {
  const vatCong = parseFloat(settings.einvoice_vat_rate_cong ?? "10");
  const vatVang = parseFloat(settings.einvoice_vat_rate_vang ?? "0");

  const products = [];

  for (const item of items) {
    const fee = parseFloat(item.total_making_fee) || 0;
    if (fee <= 0) continue;
    const vatAmount = Math.round(fee * vatCong / 100);
    products.push({
      code: item.id?.slice(0, 8) || "",
      name: `Công chế tác — ${item.product_name}`,
      unit: "món",
      quantity: item.quantity || 1,
      price: item.quantity ? fee / item.quantity : fee,
      vatRate: vatCong,
      total: fee,
      vatAmount,
      amount: fee + vatAmount,
    });
  }

  const goldMoneyValue = parseFloat(invoice.gold_money_value) || 0;
  if (goldMoneyValue > 0) {
    const vatAmount = Math.round(goldMoneyValue * vatVang / 100);
    products.push({
      code: "VANG",
      name: `Tiền vàng — HĐ ${invoice.invoice_number}`,
      unit: "chỉ",
      quantity: parseFloat(invoice.gold_to_money) || 1,
      price: (parseFloat(invoice.gold_to_money) || 1) > 0
        ? goldMoneyValue / (parseFloat(invoice.gold_to_money) || 1) : goldMoneyValue,
      vatRate: vatVang,
      total: goldMoneyValue,
      vatAmount,
      amount: goldMoneyValue + vatAmount,
    });
  }

  if (!products.length) {
    throw Object.assign(new Error("Hoá đơn không có dòng tiền công hoặc tiền vàng nào > 0 để xuất VAT"), { status: 422 });
  }

  const total = products.reduce((s, p) => s + p.total, 0);
  const vatAmount = products.reduce((s, p) => s + p.vatAmount, 0);
  const amount = total + vatAmount;

  return {
    buyerName: invoice.customer_name || "Khách lẻ",
    buyerCompany: invoice.customer_company || "",
    buyerAddress: invoice.customer_address || "",
    buyerPhone: invoice.customer_phone || "",
    buyerTaxCode: invoice.customer_tax_code || "",
    arisingDate: toArisingDate(invoice.invoice_date),
    orderRef: invoice.invoice_number,
    note: `Hoá đơn vàng ${invoice.invoice_number}`,
    total,
    discountAmount: 0,
    vatAmount,
    amount,
    amountInWords: soTienBangChu(amount),
    products,
  };
}

// Trả về { einvoice_number, einvoice_fkey, einvoice_pdf_url } khi thành công.
// Ném lỗi (Error) khi thất bại — caller chịu trách nhiệm lưu einvoice_status='error'.
export async function issueForGoldInvoice(sql, tenantId, invoice, items) {
  const settings = await loadSettings(sql, tenantId);
  const providerName = settings.einvoice_provider;
  if (!providerName) {
    throw Object.assign(new Error("Chưa chọn nhà cung cấp hoá đơn điện tử. Vào Cài đặt để cấu hình."), { status: 422 });
  }
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw Object.assign(new Error(`Nhà cung cấp "${providerName}" không được hỗ trợ.`), { status: 422 });
  }

  const config = {
    base_url: settings.einvoice_base_url,
    username: settings.einvoice_username,
    password: settings.einvoice_password,
    pattern:  settings.einvoice_pattern,
    serial:   settings.einvoice_serial,
    paymentMethod: settings.einvoice_payment_method,
  };
  if (!config.base_url || !config.username || !config.password || !config.pattern || !config.serial) {
    throw Object.assign(new Error(
      "Chưa cấu hình đủ thông tin API hoá đơn điện tử (base URL / tài khoản / mẫu số / ký hiệu). Vào Cài đặt để điền."
    ), { status: 422 });
  }

  const payload = buildInvoicePayload(invoice, items, settings);
  const result = await provider.issue(config, payload);

  return {
    provider: providerName,
    einvoice_number: result.einvoice_number,
    einvoice_fkey: result.fkey,
    einvoice_pdf_url: result.pdf_url,
  };
}

export async function cancelGoldInvoiceEInvoice(sql, tenantId, invoice) {
  const settings = await loadSettings(sql, tenantId);
  const providerName = invoice.einvoice_provider || settings.einvoice_provider;
  const provider = PROVIDERS[providerName];
  if (!provider || !invoice.einvoice_fkey) return false;

  const config = {
    base_url: settings.einvoice_base_url,
    username: settings.einvoice_username,
    password: settings.einvoice_password,
    pattern:  settings.einvoice_pattern,
    serial:   settings.einvoice_serial,
  };
  await provider.cancel(config, invoice.einvoice_fkey);
  return true;
}
