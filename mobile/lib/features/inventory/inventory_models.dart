int _integer(Object? value) => int.tryParse('$value') ?? 0;

class StockItem {
  const StockItem({
    required this.variantId,
    required this.productName,
    required this.sku,
    required this.barcode,
    required this.quantity,
    required this.price,
    this.lastCost,
  });

  factory StockItem.fromJson(Map<String, dynamic> json) => StockItem(
    variantId: '${json['variant_id']}',
    productName: '${json['product_name']}',
    sku: '${json['sku']}',
    barcode: json['barcode']?.toString() ?? '',
    quantity: _integer(json['qty']),
    price: _integer(json['price']),
    lastCost: json['last_cost'] == null ? null : _integer(json['last_cost']),
  );

  final String variantId;
  final String productName;
  final String sku;
  final String barcode;
  final int quantity;
  final int price;
  final int? lastCost;
}

class InventoryEntry {
  const InventoryEntry({
    required this.id,
    required this.type,
    required this.quantity,
    required this.productName,
    required this.sku,
    required this.createdAt,
    this.unitCost,
    this.note,
    this.createdBy,
  });

  factory InventoryEntry.fromJson(Map<String, dynamic> json) => InventoryEntry(
    id: '${json['id']}',
    type: '${json['type']}',
    quantity: _integer(json['quantity']),
    productName: '${json['product_name']}',
    sku: '${json['sku']}',
    createdAt: DateTime.tryParse('${json['created_at']}'),
    unitCost: json['unit_cost'] == null ? null : _integer(json['unit_cost']),
    note: json['note']?.toString(),
    createdBy: json['created_by_name']?.toString(),
  );

  final String id;
  final String type;
  final int quantity;
  final String productName;
  final String sku;
  final DateTime? createdAt;
  final int? unitCost;
  final String? note;
  final String? createdBy;
}

class InventoryHistoryPage {
  const InventoryHistoryPage({required this.items, required this.hasMore});

  factory InventoryHistoryPage.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    return InventoryHistoryPage(
      items: (json['transactions'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(InventoryEntry.fromJson)
          .toList(),
      hasMore: pagination['has_more'] == true,
    );
  }

  final List<InventoryEntry> items;
  final bool hasMore;
}
