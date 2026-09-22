import { errorJson } from "./_db.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validationError(details) {
  return errorJson("Dữ liệu không hợp lệ", 422, "VALIDATION_ERROR", details);
}

export function validateUuid(value, field = "id", { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  return UUID_RE.test(String(value || "")) ? null : { field, rule: "uuid", message: `${field} phải là UUID hợp lệ` };
}

export function validateEnum(value, allowed, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  return allowed.includes(value) ? null : { field, rule: "enum", allowed, message: `${field} không hợp lệ` };
}

export function validateInteger(value, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  return Number.isSafeInteger(value) && value >= min && value <= max
    ? null
    : { field, rule: "integer", min, max, message: `${field} phải là số nguyên từ ${min} đến ${max}` };
}

export function validateDecimalString(value, field, { min = null, max = null, optional = false, scale = 6 } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  // Chấp nhận cả number thô (JSON.stringify(1.5) → 1.5, không phải "1.5") lẫn string —
  // FE thường gửi kết quả parseFloat() trực tiếp, không tự ép về chuỗi trước khi gửi.
  const asString = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof asString !== "string" || !new RegExp(`^-?\\d+(?:\\.\\d{1,${scale}})?$`).test(asString)) {
    return { field, rule: "decimal_string", scale, message: `${field} phải là decimal string` };
  }
  const number = Number(asString);
  if (!Number.isFinite(number) || (min !== null && number < min) || (max !== null && number > max)) {
    return { field, rule: "range", min, max, message: `${field} vượt ngoài khoảng cho phép` };
  }
  return null;
}

export function parseDateRange(url, { maxDays = 366 } = {}) {
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const errors = [];
  if (from && !DATE_RE.test(from)) errors.push({ field: "from", rule: "date", message: "from phải có dạng YYYY-MM-DD" });
  if (to && !DATE_RE.test(to)) errors.push({ field: "to", rule: "date", message: "to phải có dạng YYYY-MM-DD" });
  if (!errors.length && from && to) {
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    if (start > end) errors.push({ field: "from", rule: "before_to", message: "from phải trước hoặc bằng to" });
    if ((end - start) / 86400000 > maxDays) errors.push({ field: "to", rule: "max_range", max_days: maxDays, message: `Khoảng ngày tối đa ${maxDays} ngày` });
  }
  return { from, to, errors };
}

export function parsePagination(url, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const rawLimit = url.searchParams.get("limit");
  const rawOffset = url.searchParams.get("offset");
  const limit = rawLimit === null ? defaultLimit : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  const errors = [];
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    errors.push({ field: "limit", rule: "range", min: 1, max: maxLimit, message: `limit phải từ 1 đến ${maxLimit}` });
  }
  if (!Number.isInteger(offset) || offset < 0) {
    errors.push({ field: "offset", rule: "range", min: 0, message: "offset phải từ 0 trở lên" });
  }
  return { limit, offset, errors };
}

export function pageMeta({ limit, offset, returned, total }) {
  return { limit, offset, returned, total: Number(total), has_more: offset + returned < Number(total) };
}

export async function fetchWithTimeout(input, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
