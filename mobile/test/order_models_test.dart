import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/orders/order_models.dart';

void main() {
  test('VND values accept PostgreSQL integer strings without double', () {
    expect(parseVnd('1250000'), 1250000);
    expect(formatVnd(1250000), '1.250.000 ₫');
  });

  test('order summary parses paginated API row', () {
    final order = OrderSummary.fromJson({
      'id': 'order-id',
      'order_number': 'DH-001',
      'status': 'completed',
      'total': '900000',
      'paid_amount': '500000',
      'created_at': '2026-08-14T08:00:00.000Z',
    });

    expect(order.total, 900000);
    expect(order.paidAmount, 500000);
    expect(order.createdAt, isNotNull);
  });
}
