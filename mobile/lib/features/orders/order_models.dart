int parseVnd(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

String formatVnd(int value) {
  final negative = value < 0;
  final digits = value.abs().toString();
  final result = StringBuffer();
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) result.write('.');
    result.write(digits[index]);
  }
  return '${negative ? '-' : ''}$result ₫';
}

class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.number,
    required this.status,
    required this.total,
    required this.paidAmount,
    required this.createdAt,
    this.customerName,
  });

  factory OrderSummary.fromJson(Map<String, dynamic> json) => OrderSummary(
    id: '${json['id']}',
    number: '${json['order_number']}',
    status: '${json['status']}',
    total: parseVnd(json['total']),
    paidAmount: parseVnd(json['paid_amount']),
    createdAt: DateTime.tryParse('${json['created_at']}'),
    customerName: json['customer_name'] as String?,
  );

  final String id;
  final String number;
  final String status;
  final int total;
  final int paidAmount;
  final DateTime? createdAt;
  final String? customerName;
}

class OrderPageData {
  const OrderPageData({required this.orders, required this.hasMore});
  final List<OrderSummary> orders;
  final bool hasMore;
}

class ProductChoice {
  const ProductChoice({
    required this.id,
    required this.sku,
    required this.name,
    required this.price,
    this.primaryImageUrl,
  });
  factory ProductChoice.fromJson(Map<String, dynamic> json) => ProductChoice(
    id: '${json['id']}',
    sku: '${json['sku']}',
    name: '${json['name']}',
    price: parseVnd(json['base_price']),
    primaryImageUrl: json['primary_image_url'] as String?,
  );
  final String id;
  final String sku;
  final String name;
  final int price;
  final String? primaryImageUrl;
}

class RecognitionCandidate {
  const RecognitionCandidate({required this.product, required this.score});

  factory RecognitionCandidate.fromJson(Map<String, dynamic> json) =>
      RecognitionCandidate(
        product: ProductChoice.fromJson(json),
        score: (json['score'] as num?)?.toDouble() ?? 0,
      );

  final ProductChoice product;
  final double score;
}

class VariantChoice {
  const VariantChoice({
    required this.id,
    required this.sku,
    this.barcode,
    required this.price,
    required this.stock,
  });
  factory VariantChoice.fromJson(Map<String, dynamic> json) => VariantChoice(
    id: '${json['id']}',
    sku: '${json['sku']}',
    barcode: json['barcode'] as String?,
    price: parseVnd(json['price']),
    stock: parseVnd(json['stock_qty']),
  );
  final String id;
  final String sku;
  final String? barcode;
  final int price;
  final int stock;
}
