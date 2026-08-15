import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/products/product_models.dart';

void main() {
  test('gold weights remain decimal strings', () {
    final variant = ProductVariant.fromJson({
      'id': 'variant-id',
      'sku': 'VANG-01',
      'price': '12000000',
      'stock_qty': '2',
      'gold_gross': '1.2345',
      'gold_net': '1.1000',
    });

    expect(variant.price, 12000000);
    expect(variant.goldGross, '1.2345');
    expect(variant.goldNet, '1.1000');
  });
}
