import { getDb, json, errorJson, handleOptions } from "../../_db.js";
import { requireAuth, requirePermission } from "../../_auth.js";
import { parsePagination, pageMeta } from "../../_validation.js";
import { ensureCustomerSupportLink } from "../../_support-chat.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, context.request.method === "GET" ? "customers.read" : "customers.write");
  if (allowed instanceof Response) return allowed;

  if (context.request.method === "GET") return getCustomers(context, auth);
  if (context.request.method === "POST") return createCustomer(context, auth);
  return errorJson("Method not allowed", 405);
}

// Bỏ dấu tiếng Việt để so khớp không phân biệt dấu — ILIKE của Postgres chỉ bỏ qua
// hoa/thường, không bỏ qua dấu, nên gõ "nguyen" (không dấu) sẽ không khớp "Nguyễn" nếu
// chỉ dùng ILIKE suông. "đ" không tách dấu qua NFD (là 1 ký tự riêng) nên phải thay tay.
function stripDiacritics(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

// Xếp hạng độ khớp — search chỉ theo substring (không xếp hạng) làm khách tên có từ
// trùng NGAY ĐẦU 1 từ (VD "Hạnh" khi gõ "hanh") bị chìm sau các khách tên chứa cùng
// chuỗi con NHƯNG ở giữa từ (VD "Thanh" cũng chứa "hanh") nếu người đó mới tạo gần đây
// hơn — vì kết quả vốn chỉ sắp theo created_at DESC. 0 = khớp nguyên tên, 1 = khớp đầu
// 1 từ trong tên (đúng ý định gõ tắt tên riêng), 2 = chỉ khớp chuỗi con giữa từ.
function matchRank(strippedName, term) {
  if (!term) return 2;
  if (strippedName === term) return 0;
  if (strippedName.split(/\s+/).some(w => w.startsWith(term))) return 1;
  return 2;
}

async function getCustomers({ request, env }, { tenantId }) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const pagination = parsePagination(url);
  if (pagination.errors.length) return errorJson("Phân trang không hợp lệ", 422, "VALIDATION_ERROR", pagination.errors);
  const { limit, offset } = pagination;
  const sql = getDb(env);

  const rows = await sql`
    SELECT c.id, c.name, c.phone, c.email, c.id_card, c.address, c.is_business, c.tax_code,
           c.dob, c.id_issue_date, c.bank_name, c.bank_account,
           c.support_chat_url, c.support_chat_session, c.created_at,
           COUNT(o.id) AS total_orders
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
    WHERE c.tenant_id = ${tenantId}
    GROUP BY c.id, c.name, c.phone, c.email, c.id_card, c.address, c.is_business, c.tax_code,
             c.dob, c.id_issue_date, c.bank_name, c.bank_account, c.created_at
    ORDER BY c.created_at DESC
  `;

  const term = stripDiacritics(search);
  // Phone khớp chuỗi con (số điện thoại tìm kiếm cố ý, không cần xếp hạng thêm) luôn ưu
  // tiên cao nhất (rank -1) — người dùng gõ SĐT thường muốn đúng khách đó, không phải
  // đoán theo tên.
  const filtered = search
    ? rows
        .filter(c => stripDiacritics(c.name).includes(term) || (c.phone || "").includes(search))
        .sort((a, b) => {
          const rankA = (a.phone || "").includes(search) ? -1 : matchRank(stripDiacritics(a.name), term);
          const rankB = (b.phone || "").includes(search) ? -1 : matchRank(stripDiacritics(b.name), term);
          return rankA - rankB;
        })
    : rows;
  const pageRows = filtered.slice(offset, offset + limit);
  return json({ customers: pageRows, pagination: pageMeta({ limit, offset, returned: pageRows.length, total: filtered.length }) });
}

async function createCustomer({ request, env }, { tenantId }) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const {
    name, phone, email, id_card, address, is_business = false, tax_code,
    dob, id_issue_date, bank_name, bank_account,
  } = body;
  if (!name) return errorJson("Tên là bắt buộc", 422);

  const sql = getDb(env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const rows = await sql`
    INSERT INTO customers (
      id, tenant_id, name, phone, email, id_card, address, is_business, tax_code,
      dob, id_issue_date, bank_name, bank_account,
      created_at, updated_at
    )
    VALUES (
      ${id}, ${tenantId}, ${name}, ${phone || null}, ${email || null},
      ${id_card || null}, ${address || null}, ${is_business}, ${tax_code || null},
      ${dob || null}, ${id_issue_date || null}, ${bank_name || null}, ${bank_account || null},
      ${now}, ${now}
    )
    RETURNING id, name, phone, email, id_card, address, is_business, tax_code,
              dob, id_issue_date, bank_name, bank_account
  `;

  let customer = rows[0];
  try {
    customer = await ensureCustomerSupportLink(sql, env, tenantId, customer);
  } catch (err) {
    console.error("Không tạo được link hỗ trợ cho khách mới:", err.message);
  }
  return json(customer, 201);
}
