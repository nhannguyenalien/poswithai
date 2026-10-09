// POST /mcp — MCP server (Streamable HTTP, stateless, JSON response) cho AI agent.
// Xác thực bằng chính API token: "Authorization: Bearer pos_xxx". Mỗi tool gọi lại REST API
// tương ứng với đúng header đó nên tenant, quyền (permission) và rate limit được áp dụng y như
// khi gọi REST. Chỉ có tool ĐỌC — xem _api-catalog.js.
import { TOOLS, inputSchema, buildPath } from "./_api-catalog.js";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_RESULT_CHARS = 60000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
const rpcError = (id, code, message) => reply({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { ...CORS, Allow: "POST" } });

  let msg;
  try { msg = await request.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  if (Array.isArray(msg)) return rpcError(null, -32600, "Batch không được hỗ trợ");
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg?.id, -32600, "Invalid Request");

  // Notification (không có id) → 202 không body.
  if (msg.id === undefined) return new Response(null, { status: 202, headers: CORS });

  switch (msg.method) {
    case "initialize": {
      const wanted = msg.params?.protocolVersion;
      return reply({ jsonrpc: "2.0", id: msg.id, result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(wanted) ? wanted : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "pos-app", version: "1.0.0" },
        instructions: "Tra cứu dữ liệu POS (sản phẩm, khách, đơn, kho, vàng, báo cáo). Chỉ đọc. Tiền là số nguyên VND; cân/tuổi vàng là chuỗi thập phân.",
      } });
    }
    case "ping": return reply({ jsonrpc: "2.0", id: msg.id, result: {} });
    case "tools/list":
      return reply({ jsonrpc: "2.0", id: msg.id, result: {
        tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: inputSchema(t), annotations: { readOnlyHint: true } })),
      } });
    case "tools/call": return callTool(request, msg);
    default: return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

async function callTool(request, msg) {
  const tool = TOOLS.find(t => t.name === msg.params?.name);
  if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${msg.params?.name}`);

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return reply({ jsonrpc: "2.0", id: msg.id, result: { isError: true, content: [{ type: "text", text: "Thiếu header Authorization: Bearer pos_<token>" }] } });
  }
  const path = buildPath(tool, msg.params?.arguments || {});
  if (!path) return rpcError(msg.id, -32602, "Thiếu tham số bắt buộc: " + (tool.required || []).join(", "));

  const res = await fetch(new URL(path, request.url), { headers: { Authorization: authorization, Accept: "application/json" } });
  let text = await res.text();
  if (text.length > MAX_RESULT_CHARS) text = text.slice(0, MAX_RESULT_CHARS) + "\n…(đã cắt bớt, hãy dùng limit/offset hoặc lọc hẹp hơn)";
  return reply({ jsonrpc: "2.0", id: msg.id, result: { isError: !res.ok, content: [{ type: "text", text }] } });
}
