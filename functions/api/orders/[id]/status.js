import { errorJson, handleOptions } from "../../../_db.js";
import { requireAuth, requirePermission } from "../../../_auth.js";
import { validateUuid } from "../../../_validation.js";
import { changeOrderStatus } from "../[id].js";

export async function onRequest(context) {
  const preflight = handleOptions(context.request);
  if (preflight) return preflight;
  if (context.request.method !== "PATCH") return errorJson("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const allowed = await requirePermission(context, auth, "orders.status");
  if (allowed instanceof Response) return allowed;
  const idError = validateUuid(context.params.id);
  if (idError) return errorJson("ID đơn hàng không hợp lệ", 422, "VALIDATION_ERROR", [idError]);
  let body;
  try { body = await context.request.json(); } catch { return errorJson("Body không hợp lệ", 400, "INVALID_JSON"); }
  return changeOrderStatus(context, auth, context.params.id, body);
}
