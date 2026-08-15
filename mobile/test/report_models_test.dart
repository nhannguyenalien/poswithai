import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/reports/report_models.dart';

void main() {
  test('report models parse integer and PostgreSQL numeric strings', () {
    final revenue = RevenueReport.fromJson({
      'summary': {
        'total_revenue': '1500000',
        'avg_order_value': 500000,
        'pending_revenue': '250000',
        'completed_orders': '3',
      },
      'prevPeriod': {'revenue': '1000000'},
      'daily': [
        {'date': '2026-08-14', 'order_count': '3', 'revenue': '1500000'},
      ],
      'topProducts': [
        {
          'product_name': 'Nhẫn mèo',
          'sku': 'NM01',
          'qty_sold': '2',
          'revenue': '900000',
        },
      ],
    });
    final stock = StockReport.fromJson({
      'summary': {
        'totalSKUs': 4,
        'totalUnits': '9',
        'totalValue': '3000000',
        'lowCount': 1,
        'zeroCount': '1',
      },
      'items': [
        {
          'product_name': 'Nhẫn mèo',
          'sku': 'NM01',
          'qty': '0',
          'is_zero': true,
        },
      ],
    });

    expect(revenue.revenue, 1500000);
    expect(revenue.revenueChange, 50);
    expect(revenue.daily.single.orders, 3);
    expect(revenue.topProducts.single.quantity, 2);
    expect(stock.totalValue, 3000000);
    expect(stock.items.single.isZero, isTrue);
  });
}
