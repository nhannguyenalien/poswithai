export function roundGold99(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 1e6) / 1e6;
}

export function normalizeGoldConversion99(sold, bought, conversion) {
  const sold99 = roundGold99(sold);
  const bought99 = roundGold99(bought);
  const remaining99 = roundGold99(sold99 - bought99);
  const conversion99 = roundGold99(conversion);

  // Giao diện hiển thị/cho nhập 3 số lẻ. Nếu nhân viên nhập đúng số đang thấy để tất
  // toán vàng, khớp phần sai số dưới nửa đơn vị hiển thị về số còn lại chính xác.
  return Math.abs(remaining99 - conversion99) < 0.0005 ? remaining99 : conversion99;
}
