// GET /api/docs — catalog endpoint đọc dữ liệu (công khai, không chứa dữ liệu cửa hàng).
import { json, errorJson, handleOptions } from "../_db.js";
import { TOOLS, inputSchema } from "../_api-catalog.js";

export async function onRequest({ request }) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;
  if (request.method !== "GET") return errorJson("Method not allowed", 405);
  return json({
    auth: "Authorization: Bearer pos_<token> (tạo ở trang API)",
    mcp: { url: new URL("/mcp", request.url).toString(), transport: "streamable-http" },
    openapi: new URL("/openapi.yaml", request.url).toString(),
    tools: TOOLS.map(t => ({ name: t.name, group: t.group, method: "GET", path: t.path, description: t.description, input_schema: inputSchema(t) })),
  }, 200, { "Cache-Control": "public, max-age=300" });
}
