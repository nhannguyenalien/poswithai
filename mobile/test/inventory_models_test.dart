import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/inventory/inventory_models.dart';

void main() {
  test('stock and history parse PostgreSQL numeric strings', () {
    final stock = StockItem.fromJson({
      'variant_id': 'v1',
      'product_name': 'Nhẫn',
      'sku': 'N01',
      'barcode': '893',
      'qty': '12',
      'price': '1500000',
      'last_cost': '900000',
    });
    final page = InventoryHistoryPage.fromJson({
      'transactions': [
        {
          'id': 't1',
          'type': 'IN',
          'quantity': '2',
          'unit_cost': '900000',
          'product_name': 'Nhẫn',
          'sku': 'N01',
          'created_at': '2026-08-14T01:00:00Z',
        },
      ],
      'pagination': {'has_more': true},
    });
    expect(stock.quantity, 12);
    expect(stock.price, 1500000);
    expect(page.items.single.quantity, 2);
    expect(page.hasMore, isTrue);
  });
}
