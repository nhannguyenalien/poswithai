// Adapter cho Mắt Bão Invoice (matbao.in)
// Dựa theo "TÀI LIỆU KỸ THUẬT TÍCH HỢP API MATBAO-INVOICE" v1.2.6.1
// Base URL, username/password, mẫu số (ApiInvPattern) và ký hiệu (ApiInvSerial) là
// thông tin riêng do Mắt Bão cấp cho từng tenant khi đăng ký dịch vụ — lấy từ settings.

async function callApi(baseUrl, path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(`Không kết nối được tới Mắt Bão API (${baseUrl}): ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try { data = await res.json(); }
  catch { throw new Error(`Mắt Bão API trả về không phải JSON (HTTP ${res.status})`); }

  if (data.status !== "OK") {
    throw new Error(data.messages || `Lỗi không xác định từ Mắt Bão (${JSON.stringify(data)})`);
  }
  return data;
}

async function getFkey(config) {
  const data = await callApi(config.base_url, "/api/v2/invoice/GetFkey", {
    ApiUserName: config.username,
    ApiPassword: config.password,
    ApiInvPattern: config.pattern,
    ApiInvSerial: config.serial,
  });
  return data.fkey;
}

// payload chuẩn hoá xem functions/_einvoice/index.js#buildInvoicePayload
export async function issue(config, payload) {
  const fkey = await getFkey(config);

  const data = await callApi(config.base_url, "/api/v2/invoice/importAndPublishInv", {
    ApiUserName: config.username,
    ApiPassword: config.password,
    ApiInvPattern: config.pattern,
    ApiInvSerial: config.serial,
    fkey,
    Buyer: payload.buyerCompany || "",
    CusName: payload.buyerName,
    CusAddress: payload.buyerAddress || "",
    CusPhone: payload.buyerPhone || "",
    CusTaxCode: payload.buyerTaxCode || "",
    PaymentMethod: config.paymentMethod || "Tiền mặt/Chuyển khoản",
    ArisingDate: payload.arisingDate, // dd/MM/yyyy
    Total: payload.total,
    DiscountAmount: payload.discountAmount || 0,
    VATAmount: payload.vatAmount,
    Amount: payload.amount,
    AmountInWords: payload.amountInWords,
    Note: payload.note || "",
    SO: payload.orderRef || "",
    Products: payload.products.map(p => ({
      code: p.code || "",
      ProdName: p.name,
      ProdUnit: p.unit || "",
      ProdQuantity: p.quantity,
      Discount: 0,
      DiscountAmount: 0,
      ProdPrice: p.price,
      VATRate: p.vatRate,
      VATAmount: p.vatAmount,
      Total: p.total,
      Amount: p.amount,
      Remark: "",
      ProdAttr: 1, // 1 = Hàng hóa/dịch vụ
    })),
  });

  const result = data.data?.[0] || {};
  const pdf = await downloadPdf(config, fkey).catch(() => null);

  return {
    fkey,
    einvoice_number: result.InvNo != null ? String(result.InvNo) : null,
    pdf_url: pdf,
  };
}

export async function downloadPdf(config, fkey, signatureType = 1) {
  const data = await callApi(config.base_url, "/api/v2/invoice/DownloadPdf", {
    ApiUserName: config.username,
    ApiPassword: config.password,
    inv_template: config.pattern,
    inv_serial: config.serial,
    signture_type: signatureType,
    fkey,
  });
  return data.link_file || null;
}

export async function cancel(config, fkey) {
  await callApi(config.base_url, "/api/v2/invoice/CancelInvoice", {
    ApiUserName: config.username,
    ApiPassword: config.password,
    ApiInvPattern: config.pattern,
    ApiInvSerial: config.serial,
    fkey,
  });
  return true;
}
