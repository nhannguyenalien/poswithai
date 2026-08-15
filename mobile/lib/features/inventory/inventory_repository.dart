import '../../core/api/api_client.dart';
import 'inventory_models.dart';

class InventoryRepository {
  const InventoryRepository(this.api);
  final ApiClient api;

  Future<List<StockItem>> stock() async {
    final json = await api.getJson('/inventory/stock');
    return (json['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(StockItem.fromJson)
        .toList();
  }

  Future<InventoryHistoryPage> history({
    int offset = 0,
    int limit = 30,
    String? type,
  }) async {
    final json = await api.getJson(
      '/inventory',
      query: {'offset': offset, 'limit': limit, 'type': ?type},
    );
    return InventoryHistoryPage.fromJson(json);
  }

  Future<int> create({
    required StockItem item,
    required String type,
    required int quantity,
    int? unitCost,
    String? note,
    String? reason,
  }) async {
    final json = await api.postJson('/inventory', {
      'product_variant_id': item.variantId,
      'type': type,
      'quantity': quantity,
      'unit_cost': ?unitCost,
      if (note?.trim().isNotEmpty == true) 'note': note!.trim(),
      if (reason?.trim().isNotEmpty == true) 'reason': reason!.trim(),
    }, idempotent: true);
    return int.tryParse('${json['new_qty']}') ?? quantity;
  }
}
