// POST   /api/gold/invoices/:id/einvoice — phát hành hoá đơn điện tử (VAT)
// DELETE /api/gold/invoices/:id/einvoice — huỷ hoá đơn điện tử đã phát hành
import { getDb, json, errorJson, handleOptions } from "../../../../_db.js";
import { requireAuth } from "../../../../_auth.js";
import { issueForGoldInvoice, cancelGoldInvoiceEInvoice } from "../../../../_einvoice/index.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  if (context.request.method === "POST")   return issue(context, auth, id);
  if (context.request.method === "DELETE") return cancel(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function issue({ env }, { tenantId }, id) {
  const sql = getDb(env);

  const invoices = await sql`
    SELECT * FROM gold_invoices WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
  `;
  if (!invoices.length) return errorJson("Không tìm thấy hoá đơn", 404);
  const invoice = invoices[0];

  if (invoice.einvoice_status === "issued") {
    return errorJson("Hoá đơn này đã được xuất VAT rồi (số " + invoice.einvoice_number + ")", 409);
  }

  const items = await sql`
    SELECT * FROM gold_invoice_items WHERE invoice_id = ${id} ORDER BY sort_order
  `;

  const now = new Date().toISOString();
  try {
    const result = await issueForGoldInvoice(sql, tenantId, invoice, items);

    await sql`
      UPDATE gold_invoices SET
        einvoice_status    = 'issued',
        einvoice_provider  = ${result.provider},
        einvoice_number    = ${result.einvoice_number},
        einvoice_fkey      = ${result.einvoice_fkey},
        einvoice_pdf_url   = ${result.einvoice_pdf_url},
        einvoice_error     = NULL,
        einvoice_issued_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    return json({
      success: true,
      einvoice_number: result.einvoice_number,
      einvoice_pdf_url: result.einvoice_pdf_url,
    });
  } catch (err) {
    await sql`
      UPDATE gold_invoices SET einvoice_status = 'error', einvoice_error = ${err.message}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return errorJson(err.message, err.status || 502);
  }
}

async function cancel({ env }, { tenantId }, id) {
  const sql = getDb(env);
  const invoices = await sql`
    SELECT * FROM gold_invoices WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
  `;
  if (!invoices.length) return errorJson("Không tìm thấy hoá đơn", 404);
  const invoice = invoices[0];

  if (invoice.einvoice_status !== "issued") {
    return errorJson("Hoá đơn chưa được xuất VAT nên không có gì để huỷ", 400);
  }

  try {
    await cancelGoldInvoiceEInvoice(sql, tenantId, invoice);
    await sql`
      UPDATE gold_invoices SET einvoice_status = 'cancelled'
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return json({ success: true });
  } catch (err) {
    return errorJson(err.message, 502);
  }
}
