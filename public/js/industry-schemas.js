/**
 * industry-schemas.js
 * ─────────────────────────────────────────────────────────────
 * Định nghĩa fields cho từng ngành.
 * Thêm ngành mới = thêm 1 entry vào INDUSTRY_SCHEMAS.
 * Không cần sửa DB, không cần sửa API.
 *
 * Mỗi field có:
 *   key        — tên key trong JSON attributes
 *   label      — nhãn hiển thị
 *   type       — text | number | select | textarea
 *   unit       — đơn vị (tuỳ chọn)
 *   options    — mảng {value, label} nếu type = select
 *   required   — bắt buộc không
 *   step       — bước tăng nếu type = number
 *   placeholder
 */

export const INDUSTRY_SCHEMAS = {

  // ── VÀNG ── (dùng bảng gold_product_details, không dùng attributes)
  gold: {
    label: "Vàng 🥇",
    useNativeTable: true,  // flag: dùng gold_product_details thay vì attributes
    fields: [],
  },

  // ── BẠC ── (dùng bảng silver_product_details)
  silver: {
    label: "Bạc 🥈",
    useNativeTable: true,
    fields: [],
  },

  // ── THỜI TRANG ──────────────────────────────────────────────
  fashion: {
    label: "Thời trang 👗",
    fields: [
      { key: "size",     label: "Size",     type: "select",
        options: ["XS","S","M","L","XL","XXL","XXXL"].map(v => ({ value: v, label: v })) },
      { key: "color",    label: "Màu sắc",  type: "text", placeholder: "VD: Đỏ, Xanh navy..." },
      { key: "material", label: "Chất liệu",type: "text", placeholder: "VD: Cotton 100%, Linen..." },
      { key: "gender",   label: "Giới tính",type: "select",
        options: [
          { value: "unisex", label: "Unisex" },
          { value: "male",   label: "Nam" },
          { value: "female", label: "Nữ" },
          { value: "kids",   label: "Trẻ em" },
        ]},
      { key: "season",   label: "Mùa",      type: "select",
        options: [
          { value: "all",    label: "Quanh năm" },
          { value: "summer", label: "Hè" },
          { value: "winter", label: "Đông" },
        ]},
    ],
  },

  // ── ĐIỆN THOẠI / ĐIỆN TỬ ────────────────────────────────────
  phone: {
    label: "Điện thoại 📱",
    fields: [
      { key: "imei",          label: "IMEI",            type: "text" },
      { key: "storage",       label: "Dung lượng",      type: "select",
        options: ["32GB","64GB","128GB","256GB","512GB","1TB"].map(v => ({value:v,label:v})) },
      { key: "color",         label: "Màu",             type: "text" },
      { key: "condition",     label: "Tình trạng",      type: "select",
        options: [
          { value: "new",     label: "Mới 100%" },
          { value: "like_new",label: "Like New 99%" },
          { value: "used",    label: "Đã qua sử dụng" },
          { value: "refurb",  label: "Tân trang" },
        ]},
      { key: "warranty_months", label: "Bảo hành (tháng)", type: "number", step: 1 },
    ],
  },

  // ── MỸ PHẨM ─────────────────────────────────────────────────
  cosmetic: {
    label: "Mỹ phẩm 💄",
    fields: [
      { key: "volume",     label: "Dung tích",  type: "text", placeholder: "VD: 50ml, 100g..." },
      { key: "shade",      label: "Màu/Tone",   type: "text", placeholder: "VD: #01 Nude Pink" },
      { key: "skin_type",  label: "Loại da",    type: "select",
        options: [
          { value: "all",   label: "Mọi loại da" },
          { value: "dry",   label: "Da khô" },
          { value: "oily",  label: "Da dầu" },
          { value: "combo", label: "Da hỗn hợp" },
        ]},
      { key: "expiry_months", label: "HSD (tháng)", type: "number", step: 1 },
      { key: "origin",     label: "Xuất xứ",    type: "text", placeholder: "VD: Hàn Quốc" },
    ],
  },

  // ── THỰC PHẨM / F&B ─────────────────────────────────────────
  food: {
    label: "Thực phẩm 🍜",
    fields: [
      { key: "weight_gram",    label: "Trọng lượng (gram)", type: "number", step: 1 },
      { key: "expiry_days",    label: "HSD (ngày)",         type: "number", step: 1 },
      { key: "storage_temp",   label: "Nhiệt độ bảo quản",  type: "select",
        options: [
          { value: "room",    label: "Nhiệt độ thường" },
          { value: "cool",    label: "Mát 4-10°C" },
          { value: "frozen",  label: "Đông lạnh -18°C" },
        ]},
      { key: "allergens",      label: "Dị ứng",             type: "text", placeholder: "VD: Gluten, Đậu nành..." },
      { key: "origin",         label: "Xuất xứ",            type: "text" },
    ],
  },

  // ── KHÁCH SẠN / DỊCH VỤ LƯU TRÚ ────────────────────────────
  hotel: {
    label: "Khách sạn 🏨",
    fields: [
      { key: "room_type",  label: "Loại phòng",   type: "select",
        options: [
          { value: "standard",  label: "Standard" },
          { value: "superior",  label: "Superior" },
          { value: "deluxe",    label: "Deluxe" },
          { value: "suite",     label: "Suite" },
          { value: "villa",     label: "Villa" },
        ]},
      { key: "bed_type",   label: "Loại giường",  type: "select",
        options: [
          { value: "single",  label: "Single" },
          { value: "double",  label: "Double" },
          { value: "twin",    label: "Twin" },
          { value: "king",    label: "King" },
        ]},
      { key: "max_guests", label: "Số khách tối đa", type: "number", step: 1 },
      { key: "floor",      label: "Tầng",         type: "number", step: 1 },
      { key: "view",       label: "Hướng view",   type: "text", placeholder: "VD: Hướng biển, Hướng núi..." },
      { key: "amenities",  label: "Tiện nghi",    type: "textarea", placeholder: "VD: WiFi, TV, Minibar, Bồn tắm..." },
    ],
  },

  // ── SỬA CHỮA / DỊCH VỤ ──────────────────────────────────────
  service: {
    label: "Dịch vụ / Sửa chữa 🔧",
    fields: [
      { key: "duration_hours", label: "Thời gian (giờ)", type: "number", step: 0.5 },
      { key: "warranty_days",  label: "Bảo hành (ngày)", type: "number", step: 1 },
      { key: "skill_level",    label: "Cấp độ",          type: "select",
        options: [
          { value: "basic",    label: "Cơ bản" },
          { value: "standard", label: "Tiêu chuẩn" },
          { value: "premium",  label: "Cao cấp" },
        ]},
    ],
  },

};

/**
 * Lấy schema của 1 ngành.
 * Trả về null nếu không có hoặc dùng native table.
 */
export function getSchema(productType) {
  const schema = INDUSTRY_SCHEMAS[productType];
  if (!schema || schema.useNativeTable) return null;
  return schema;
}

/**
 * Render fields từ schema ra HTML form.
 * @param {Array} fields  — mảng field definitions
 * @param {Object} values — giá trị hiện tại (khi edit)
 * @returns {string} HTML string
 */
export function renderFields(fields, values = {}) {
  return fields.map(f => {
    const val = values[f.key] ?? "";
    let input = "";

    if (f.type === "select") {
      const opts = f.options.map(o =>
        `<option value="${o.value}" ${val === o.value ? "selected" : ""}>${o.label}</option>`
      ).join("");
      input = `<select class="form-select form-select-sm industry-field" data-key="${f.key}">${opts}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea class="form-control form-control-sm industry-field" data-key="${f.key}"
                 rows="2" placeholder="${f.placeholder||""}">${val}</textarea>`;
    } else {
      input = `<input type="${f.type}" class="form-control form-control-sm industry-field"
                 data-key="${f.key}"
                 value="${val}"
                 ${f.step ? `step="${f.step}"` : ""}
                 ${f.required ? "required" : ""}
                 placeholder="${f.placeholder||""}"/>`;
    }

    const unit = f.unit ? `<span class="input-group-text">${f.unit}</span>` : "";
    return `
      <div class="col-md-${f.type === "textarea" ? "12" : "4"}">
        <label class="form-label form-label-sm">${f.label}${f.required ? " *" : ""}</label>
        ${unit ? `<div class="input-group input-group-sm">${input}${unit}</div>` : input}
      </div>`;
  }).join("");
}

/**
 * Đọc giá trị từ các input industry-field trong một container.
 * Trả về object { key: value, ... }
 */
export function readFields(container) {
  const result = {};
  container.querySelectorAll(".industry-field").forEach(el => {
    const key = el.dataset.key;
    const val = el.value.trim();
    if (val) result[key] = el.type === "number" ? parseFloat(val) : val;
  });
  return result;
}

/**
 * Danh sách options cho dropdown product_type.
 */
export function getTypeOptions() {
  return Object.entries(INDUSTRY_SCHEMAS).map(([value, schema]) =>
    `<option value="${value}">${schema.label}</option>`
  ).join("");
}
