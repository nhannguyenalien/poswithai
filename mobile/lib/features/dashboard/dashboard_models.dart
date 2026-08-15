import '../orders/order_models.dart';

class DashboardSummary {
  const DashboardSummary({
    required this.revenue,
    required this.totalOrders,
    required this.completedOrders,
    required this.pendingOrders,
    required this.receivable,
    required this.lowStockCount,
    required this.outOfStockCount,
  });

  final int revenue;
  final int totalOrders;
  final int completedOrders;
  final int pendingOrders;
  final int receivable;
  final int lowStockCount;
  final int outOfStockCount;

  factory DashboardSummary.fromResponses({
    required Map<String, dynamic> revenueResponse,
    required Map<String, dynamic> stockResponse,
  }) {
    final revenue =
        revenueResponse['summary'] as Map<String, dynamic>? ?? const {};
    final stock = stockResponse['summary'] as Map<String, dynamic>? ?? const {};
    return DashboardSummary(
      revenue: parseVnd(revenue['total_revenue']),
      totalOrders: _parseCount(revenue['total_orders']),
      completedOrders: _parseCount(revenue['completed_orders']),
      pendingOrders: _parseCount(revenue['pending_orders']),
      receivable: parseVnd(revenue['pending_revenue']),
      lowStockCount: _parseCount(stock['lowCount']),
      outOfStockCount: _parseCount(stock['zeroCount']),
    );
  }
}

int _parseCount(dynamic value) => int.tryParse('$value') ?? 0;
