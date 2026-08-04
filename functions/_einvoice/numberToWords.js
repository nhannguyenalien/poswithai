// Đổi số tiền VNĐ sang chữ tiếng Việt — bắt buộc trong field AmountInWords của hoá đơn điện tử.
const CHU_SO = ["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"];

function docBaSo(n, hasParent) {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  let s = "";

  if (tram > 0 || hasParent) s += CHU_SO[tram] + " trăm ";
  else if (n < 100 && n >= 10) s = "";

  if (chuc === 0) {
    if (tram > 0 || hasParent) { if (donvi > 0) s += "lẻ "; }
  } else if (chuc === 1) {
    s += "mười ";
  } else {
    s += CHU_SO[chuc] + " mươi ";
  }

  if (donvi === 1 && chuc >= 2) s += "mốt";
  else if (donvi === 5 && chuc >= 1) s += "lăm";
  else if (donvi > 0) s += CHU_SO[donvi];

  return s.trim();
}

export function soTienBangChu(sotien) {
  let n = Math.round(Math.abs(sotien || 0));
  if (n === 0) return "Không đồng";

  const donVi = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const groups = [];
  while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }

  let parts = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g === 0) continue;
    const isFirst = i === 0;
    parts.push(docBaSo(g, !isFirst) + (donVi[groups.length - 1 - i] ? " " + donVi[groups.length - 1 - i] : ""));
  }

  let result = parts.join(" ").replace(/\s+/g, " ").trim();
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result + " đồng";
}
