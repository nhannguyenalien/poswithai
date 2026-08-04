// functions/_metal.js — shared metal detail logic, dùng được ở mọi route
export async function saveMetalDetails(sql, variantId, productType, metal, now) {
  if (!metal) return;
  const gross = metal.gross_weight || 0;
  const stone = metal.stone_weight || 0;
  const net   = Math.max(0, gross - stone);

  if (productType === "gold" || metal.type === "gold") {
    await sql`
      INSERT INTO gold_product_details
        (id, product_variant_id, gold_type_id, gross_weight, stone_weight, net_weight, making_fee, created_at)
      VALUES
        (${crypto.randomUUID()}, ${variantId}, ${metal.gold_type_id||null},
         ${gross}, ${stone}, ${net}, ${metal.making_fee||0}, ${now})
      ON CONFLICT (product_variant_id) DO UPDATE SET
        gold_type_id = EXCLUDED.gold_type_id,
        gross_weight = EXCLUDED.gross_weight,
        stone_weight = EXCLUDED.stone_weight,
        net_weight   = EXCLUDED.net_weight,
        making_fee   = EXCLUDED.making_fee
    `;
  }
  if (productType === "silver" || metal.type === "silver") {
    await sql`
      INSERT INTO silver_product_details
        (id, product_variant_id, purity, gross_weight, stone_weight, net_weight, making_fee, created_at)
      VALUES
        (${crypto.randomUUID()}, ${variantId}, ${metal.purity||"925"},
         ${gross}, ${stone}, ${net}, ${metal.making_fee||0}, ${now})
      ON CONFLICT (product_variant_id) DO UPDATE SET
        purity       = EXCLUDED.purity,
        gross_weight = EXCLUDED.gross_weight,
        stone_weight = EXCLUDED.stone_weight,
        net_weight   = EXCLUDED.net_weight,
        making_fee   = EXCLUDED.making_fee
    `;
  }
}
