import { errorJson } from "./_db.js";

export async function onRequest(context) {
  const requestId = context.request.headers.get("X-Request-ID") || crypto.randomUUID();
  try {
    const response = await context.next();
    const next = new Response(response.body, response);
    next.headers.set("X-Request-ID", requestId);
    next.headers.set("X-Content-Type-Options", "nosniff");
    return next;
  } catch (error) {
    console.error(JSON.stringify({ request_id: requestId, error: error?.message || String(error) }));
    const response = errorJson(
      "Hệ thống đang bận, vui lòng thử lại",
      500,
      "INTERNAL_ERROR",
      null,
    );
    response.headers.set("X-Request-ID", requestId);
    return response;
  }
}
