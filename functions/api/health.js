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

    return json({
      status: "ok",
      db: "neon/postgresql",
      server_time: rows[0].server_time,
      db_name: rows[0].db_name,
      tables_found: parseInt(tableCount[0].count),
      // Nếu tables_found = 0 → schema chưa chạy
      // Nếu tables_found = 20 → schema đầy đủ
      schema_ready: parseInt(tableCount[0].count) >= 20,
    });
  } catch (err) {
    // Trả lỗi rõ ràng để debug dễ hơn
    return errorJson(
      `Kết nối DB thất bại: ${err.message}`,
      500
    );
  }
}
