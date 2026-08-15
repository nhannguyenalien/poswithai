import '../orders/order_models.dart';

int _count(Object? value) => int.tryParse('$value') ?? 0;

class RevenueReport {
  const RevenueReport({
    required this.revenue,
    required this.averageOrderValue,
    required this.receivable,
    required this.completedOrders,
    required this.previousRevenue,
    required this.daily,
    required this.topProducts,
  });

  factory RevenueReport.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>? ?? const {};
    final previous = json['prevPeriod'] as Map<String, dynamic>? ?? const {};
    return RevenueReport(
      revenue: parseVnd(summary['total_revenue']),
      averageOrderValue: parseVnd(summary['avg_order_value']),
      receivable: parseVnd(summary['pending_revenue']),
      completedOrders: _count(summary['completed_orders']),
      previousRevenue: parseVnd(previous['revenue']),
      daily: (json['daily'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DailyRevenue.fromJson)
          .toList(),
      topProducts: (json['topProducts'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TopProduct.fromJson)
          .toList(),
    );
  }

  final int revenue;
  final int averageOrderValue;
  final int receivable;
  final int completedOrders;
  final int previousRevenue;
  final List<DailyRevenue> daily;
  final List<TopProduct> topProducts;

  double? get revenueChange {
    if (previousRevenue == 0) return null;
    return (revenue - previousRevenue) / previousRevenue * 100;
  }
}

class DailyRevenue {
  const DailyRevenue({
    required this.date,
    required this.orders,
    required this.revenue,
  });

  factory DailyRevenue.fromJson(Map<String, dynamic> json) => DailyRevenue(
    date: DateTime.tryParse('${json['date']}'),
    orders: _count(json['order_count']),
    revenue: parseVnd(json['revenue']),
  );

  final DateTime? date;
  final int orders;
  final int revenue;
}

class TopProduct {
  const TopProduct({
    required this.name,
    required this.sku,
    required this.quantity,
    required this.revenue,
  });

  factory TopProduct.fromJson(Map<String, dynamic> json) => TopProduct(
    name: '${json['product_name']}',
    sku: '${json['sku']}',
    quantity: _count(json['qty_sold']),
    revenue: parseVnd(json['revenue']),
  );

  final String name;
  final String sku;
  final int quantity;
  final int revenue;
}

class StockReport {
  const StockReport({
    required this.totalSkus,
    required this.totalUnits,
    required this.totalValue,
    required this.lowCount,
    required this.zeroCount,
    required this.items,
  });

  factory StockReport.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>? ?? const {};
    return StockReport(
      totalSkus: _count(summary['totalSKUs']),
      totalUnits: _count(summary['totalUnits']),
      totalValue: parseVnd(summary['totalValue']),
      lowCount: _count(summary['lowCount']),
      zeroCount: _count(summary['zeroCount']),
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(StockWarning.fromJson)
          .toList(),
    );
  }

  final int totalSkus;
  final int totalUnits;
  final int totalValue;
  final int lowCount;
  final int zeroCount;
  final List<StockWarning> items;
}

class StockWarning {
  const StockWarning({
    required this.name,
    required this.sku,
    required this.quantity,
    required this.isZero,
  });

  factory StockWarning.fromJson(Map<String, dynamic> json) => StockWarning(
    name: '${json['product_name']}',
    sku: '${json['sku']}',
    quantity: _count(json['qty']),
    isZero: json['is_zero'] == true,
  );

  final String name;
  final String sku;
  final int quantity;
  final bool isZero;
}
