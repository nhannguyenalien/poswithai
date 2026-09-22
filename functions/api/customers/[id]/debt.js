// GET  /api/customers/:id/debt — tổng công nợ (tiền + vàng quy 99) của 1 khách hàng,
// kèm danh sách đơn + bút toán nhập tay góp phần vào công nợ đó (để tra cứu "vì sao nợ").
// POST /api/customers/:id/debt — thêm 1 bút toán công nợ nhập tay (nợ cũ trước khi dùng
// phần mềm, hoặc chỉnh sửa/xoá bớt nợ thủ công) — không phải hoá đơn thật.
//
// Nợ tiền (từ orders): LUÔN tính trực tiếp total − paid (không dựa vào status). Lý do:
// status có thể bị đổi tay qua nút "Đánh dấu hoàn thành" mà đơn chưa thực sự thu đủ
// tiền — nếu tin vào status thì công nợ thật sẽ bị che mất hoàn toàn (bug đã gặp thật).
// Nợ vàng (chỉ 99): cộng dồn trên mọi đơn chưa huỷ/hoàn — chưa có cơ chế "trả bớt nợ
// vàng" qua nhiều đơn nên ghi nhận lúc tạo đơn không đổi theo trạng thái tiền sau đó.
import { getDb, json, errorJson, handleOptions } from "../../../_db.js";
import { requireAuth, requirePermission } from "../../../_auth.js";
import { validateDecimalString, validateInteger, validateUuid, validationError } from "../../../_validation.js";
import { syncCustomerSupportContext } from "../../../_support-chat.js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;

  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  const idError = validateUuid(id, "id");
  if (idError) return validationError([idError]);
  const permission = context.request.method === "GET" ? "customers.read" : "customers.write";
  const allowed = await requirePermission(context, auth, permission);
  if (allowed instanceof Response) return allowed;
  if (context.request.method === "GET")  return getDebt(context, auth, id);
  if (context.request.method === "POST") return addAdjustment(context, auth, id);
  return errorJson("Method not allowed", 405);
}

async function getDebt({ env }, { tenantId }, id) {
  const sql = getDb(env);

  const rows = await sql`
    SELECT o.id, o.order_number, o.order_type, o.status, o.created_at, o.total, o.gold_debt_99,
           COALESCE(SUM(p.amount), 0) AS paid
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
    WHERE o.customer_id = ${id} AND o.tenant_id = ${tenantId}
      AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY o.id, o.order_number, o.order_type, o.status, o.created_at, o.total, o.gold_debt_99
    ORDER BY o.created_at DESC
  `;

  const adjustmentRows = await sql`
    SELECT id, money_amount, gold_amount_99, note, created_at
    FROM customer_debt_adjustments
    WHERE customer_id = ${id} AND tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `;

  // QUAN TRỌNG: cộng dồn nhiều đơn phải dùng số CÓ DẤU (total - paid, không kẹp về 0) rồi
  // mới cộng — nếu kẹp từng đơn về "độ lớn luôn dương" trước khi cộng (như code cũ) thì 1
  // khách vừa có đơn khách nợ tiệm (total dương) vừa có đơn tiệm nợ khách (total âm, VD
  // hàng cũ thu vào nhiều hơn giá trị mua) sẽ bị CỘNG NHẦM 2 chiều ngược nhau thành 1 số
  // dương duy nhất — có thể đảo ngược hẳn ai nợ ai (bug thật đã gặp, xem lịch sử sửa).
  // Quy ước dấu: DƯƠNG = khách nợ tiệm, ÂM = tiệm nợ khách — áp dụng luôn cho money_debt
  // trả về ở cấp tổng hợp lẫn từng bút toán điều chỉnh tay (vốn đã có dấu sẵn từ trước).
  let moneyNetTotal = 0;
  let goldDebtTotal = 0n;
  const orders = [];

  for (const r of rows) {
    const total = parseInt(r.total) || 0;
    const paid  = parseInt(r.paid) || 0;
    const moneyNet = total - paid; // có dấu, KHÔNG kẹp — dùng để cộng dồn chính xác
    const goldDebt = decimalToScaled(r.gold_debt_99);
    moneyNetTotal += moneyNet;
    goldDebtTotal += goldDebt;

    if (moneyNet !== 0 || goldDebt !== 0n) {
      orders.push({
        id: r.id, order_number: r.order_number, order_type: r.order_type, status: r.status,
        created_at: r.created_at, total, paid,
        // money_debt: độ lớn (luôn ≥0) để hiện trong danh sách "vì sao nợ" từng dòng, kèm
        // hướng riêng — không dùng số này để cộng dồn (đã cộng bằng moneyNet có dấu ở trên).
        money_debt: Math.abs(moneyNet),
        money_debt_direction: moneyNet >= 0 ? "customer_owes" : "shop_owes",
        gold_debt_99: scaledToDecimal(goldDebt),
      });
    }
  }

  const adjustments = adjustmentRows.map(a => ({
    id: a.id,
    money_amount: parseInt(a.money_amount) || 0,
    gold_amount_99: scaledToDecimal(decimalToScaled(a.gold_amount_99)),
    note: a.note,
    created_at: a.created_at,
  }));
  for (const a of adjustments) {
    moneyNetTotal += a.money_amount;
    goldDebtTotal += decimalToScaled(a.gold_amount_99);
  }

  return json({ money_debt: moneyNetTotal, gold_debt_99: scaledToDecimal(goldDebtTotal), orders, adjustments });
}

async function addAdjustment({ request, env }, { tenantId, userId }, customerId) {
  let body;
  try { body = await request.json(); } catch { return errorJson("Body không hợp lệ", 400); }

  const moneyAmount = body.money_amount ?? 0;
  const goldAmount = body.gold_amount_99 ?? "0";
  const errors = [
    validateInteger(moneyAmount, "money_amount"),
    validateDecimalString(goldAmount, "gold_amount_99", { scale: 6 }),
  ].filter(Boolean);
  if (errors.length) return validationError(errors);
  const money_amount = moneyAmount;
  const gold_amount_99 = goldAmount;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  // Cho phép lưu 1 dòng CHỈ có ghi chú (không đổi nợ tiền/vàng) — dùng để ghi log/nhắc nhở
  // (VD "đã gọi nhắc nợ"), miễn là có ghi chú thì không bắt buộc phải kèm số tiền/vàng nữa.
  if (money_amount === 0 && decimalToScaled(gold_amount_99) === 0n && !note) {
    return errorJson("Cần nhập ít nhất 1 trong 3: nợ tiền, nợ vàng, hoặc ghi chú", 422);
  }

  const sql = getDb(env);
  const customers = await sql`SELECT id FROM customers WHERE id = ${customerId} AND tenant_id = ${tenantId} LIMIT 1`;
  if (!customers.length) return errorJson("Không tìm thấy khách hàng", 404);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO customer_debt_adjustments (id, tenant_id, customer_id, money_amount, gold_amount_99, note, created_by, created_at)
    VALUES (${id}, ${tenantId}, ${customerId}, ${money_amount}, ${gold_amount_99}, ${note}, ${userId}, ${now})
  `;

  try { await syncCustomerSupportContext(sql, env, tenantId, customerId); }
  catch (err) { console.error("Không đồng bộ được dữ liệu khách sau khi chỉnh nợ:", err.message); }

  return json({ id, money_amount, gold_amount_99, note, created_at: now }, 201);
}

const GOLD_SCALE = 6;
const GOLD_FACTOR = 10n ** BigInt(GOLD_SCALE);

// PostgreSQL numeric đi qua API dưới dạng chuỗi; cộng bằng BigInt theo scale cố định
// để không phát sinh sai số IEEE-754 khi tổng hợp nhiều bút toán vàng.
function decimalToScaled(value) {
  const text = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return 0n;
  const fraction = (match[3] || "").slice(0, GOLD_SCALE).padEnd(GOLD_SCALE, "0");
  const scaled = BigInt(match[2]) * GOLD_FACTOR + BigInt(fraction || "0");
  return match[1] ? -scaled : scaled;
}

function scaledToDecimal(value) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / GOLD_FACTOR;
  const fraction = (absolute % GOLD_FACTOR).toString().padStart(GOLD_SCALE, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}
