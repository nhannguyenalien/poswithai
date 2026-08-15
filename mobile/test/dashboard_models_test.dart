import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/dashboard/dashboard_models.dart';

void main() {
  test('dashboard parses PostgreSQL numeric strings and stock counts', () {
    final summary = DashboardSummary.fromResponses(
      revenueResponse: {
        'summary': {
          'total_revenue': '1250000',
          'total_orders': '4',
          'completed_orders': '3',
          'pending_orders': '1',
          'pending_revenue': '350000',
        },
      },
      stockResponse: {
        'summary': {'lowCount': 2, 'zeroCount': 1},
      },
    );

    expect(summary.revenue, 1250000);
    expect(summary.totalOrders, 4);
    expect(summary.completedOrders, 3);
    expect(summary.pendingOrders, 1);
    expect(summary.receivable, 350000);
    expect(summary.lowStockCount, 2);
    expect(summary.outOfStockCount, 1);
  });
}
