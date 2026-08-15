import '../../core/api/api_client.dart';
import '../inventory/inventory_models.dart';
import '../inventory/inventory_repository.dart';
import 'purchase_models.dart';

class PurchaseRepository {
  const PurchaseRepository(this.api);
  final ApiClient api;

  Future<List<Supplier>> suppliers({String search = ''}) async {
    final json = await api.getJson(
      '/suppliers',
      query: {
        'limit': 100,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    return (json['suppliers'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Supplier.fromJson)
        .toList();
  }

  Future<Supplier> updateSupplier(Supplier supplier) async {
    final json = await api.putJson('/suppliers/${supplier.id}', {
      'name': supplier.name,
      'phone': supplier.phone,
      'email': supplier.email,
      'tax_code': supplier.taxCode,
      'address': supplier.address,
      'note': supplier.note,
      'status': supplier.status,
    });
    return Supplier.fromJson(json['supplier'] as Map<String, dynamic>);
  }

  Future<void> archiveSupplier(String id) async {
    await api.deleteJson('/suppliers/$id');
  }

  Future<Supplier> createSupplier({
    required String name,
    String? phone,
    String? email,
    String? taxCode,
    String? address,
    String? note,
  }) async {
    final json = await api.postJson('/suppliers', {
      'name': name.trim(),
      if (phone?.trim().isNotEmpty == true) 'phone': phone!.trim(),
      if (email?.trim().isNotEmpty == true) 'email': email!.trim(),
      if (taxCode?.trim().isNotEmpty == true) 'tax_code': taxCode!.trim(),
      if (address?.trim().isNotEmpty == true) 'address': address!.trim(),
      if (note?.trim().isNotEmpty == true) 'note': note!.trim(),
    });
    return Supplier.fromJson(json['supplier'] as Map<String, dynamic>);
  }

  Future<List<StockItem>> stock() => InventoryRepository(api).stock();

  Future<PurchaseReceiptPageData> receipts({int offset = 0}) async {
    final json = await api.getJson(
      '/purchase-receipts',
      query: {'limit': 30, 'offset': offset},
    );
    return PurchaseReceiptPageData.fromJson(json);
  }

  Future<PurchaseReceiptDetail> receipt(String id) async {
    final json = await api.getJson('/purchase-receipts/$id');
    return PurchaseReceiptDetail.fromJson(
      json['receipt'] as Map<String, dynamic>,
    );
  }

  Future<Map<String, dynamic>> createReceipt({
    String? supplierId,
    String? receiptNo,
    String? note,
    required List<({String variantId, int quantity, int unitCost})> items,
  }) => api.postJson('/purchase-receipts', {
    'supplier_id': ?supplierId,
    if (receiptNo?.trim().isNotEmpty == true) 'receipt_no': receiptNo!.trim(),
    if (note?.trim().isNotEmpty == true) 'note': note!.trim(),
    'items': items
        .map(
          (item) => {
            'product_variant_id': item.variantId,
            'quantity': item.quantity,
            'unit_cost': item.unitCost,
          },
        )
        .toList(),
  }, idempotent: true);
}
