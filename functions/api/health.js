import { getDb, json, errorJson, handleOptions } from "../_db.js";

export async function onRequest({ request, env }) {
  // Xử lý CORS preflight
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  if (request.method !== "GET") {
    return errorJson("Method not allowed", 405);
  }

  try {
    const sql = getDb(env);

    // Chạy query đơn giản để xác nhận kết nối DB thật sự hoạt động
    const rows = await sql`SELECT NOW() AS server_time, current_database() AS db_name`;

    // Kiểm tra thêm: đếm số bảng đã tạo (để xác nhận schema đã chạy)
    const tableCount = await sql`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    const payload = { status: "ok", schema_ready: parseInt(tableCount[0].count) >= 20 };
    if (env.HEALTH_DETAILS === "true") payload.diagnostics = {
      server_time: rows[0].server_time, tables_found: parseInt(tableCount[0].count),
    };
    return json(payload);
  } catch (err) {
    // Trả lỗi rõ ràng để debug dễ hơn
    console.error("Health check database failure", err);
    return errorJson("Dịch vụ cơ sở dữ liệu chưa sẵn sàng", 503, "DATABASE_UNAVAILABLE");
  }
}
