import '../../core/api/api_client.dart';
import 'order_models.dart';

class OrderRepository {
  const OrderRepository(this.api);
  final ApiClient api;

  Future<OrderPageData> list({
    int offset = 0,
    int limit = 20,
    String search = '',
  }) async {
    final json = await api.getJson(
      '/orders',
      query: {
        'offset': offset,
        'limit': limit,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    final raw = json['orders'] as List<dynamic>? ?? const [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    return OrderPageData(
      orders: raw
          .map((item) => OrderSummary.fromJson(item as Map<String, dynamic>))
          .toList(),
      hasMore: pagination['has_more'] == true,
    );
  }

  Future<Map<String, dynamic>> detail(String id) => api.getJson('/orders/$id');

  Future<List<ProductChoice>> products({String search = ''}) async {
    final json = await api.getJson(
      '/products',
      query: {
        'limit': 100,
        'offset': 0,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    return (json['products'] as List<dynamic>? ?? const [])
        .map((item) => ProductChoice.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<VariantChoice>> variants(String productId) async {
    final json = await api.getJson('/products/$productId');
    return (json['variants'] as List<dynamic>? ?? const [])
        .map((item) => VariantChoice.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<RecognitionCandidate>> recognizeProduct({
    required String filePath,
    required String filename,
    required String mimeType,
  }) async {
    final json = await api.postMultipart(
      '/products/recognize',
      field: 'image',
      filePath: filePath,
      filename: filename,
      mimeType: mimeType,
    );
    return (json['candidates'] as List<dynamic>? ?? const [])
        .map(
          (item) => RecognitionCandidate.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<CreateOrderResult> create({
    String? customerId,
    required List<OrderCreateItem> items,
    String? notes,
  }) async {
    final json = await api.postJson('/orders', {
      'order_type': 'retail',
      'customer_id': ?customerId,
      'items': items.map((item) => item.toJson()).toList(),
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    }, idempotent: true);
    return CreateOrderResult(
      id: '${json['order_id']}',
      number: '${json['order_number']}',
      total: parseVnd(json['total']),
    );
  }

  Future<void> createPayment({
    required String orderId,
    required String method,
    required int amount,
    String? referenceNo,
  }) async {
    await api.postJson('/payments', {
      'order_id': orderId,
      'method': method,
      'amount': amount,
      if (referenceNo != null && referenceNo.trim().isNotEmpty)
        'reference_no': referenceNo.trim(),
    }, idempotent: true);
  }
}

class OrderCreateItem {
  const OrderCreateItem({
    required this.variantId,
    required this.quantity,
    required this.unitPrice,
  });

  final String variantId;
  final int quantity;
  final int unitPrice;

  Map<String, dynamic> toJson() => {
    'product_variant_id': variantId,
    'quantity': quantity,
    'unit_price': unitPrice,
    'discount': 0,
  };
}

class CreateOrderResult {
  const CreateOrderResult({
    required this.id,
    required this.number,
    required this.total,
  });

  final String id;
  final String number;
  final int total;
}
