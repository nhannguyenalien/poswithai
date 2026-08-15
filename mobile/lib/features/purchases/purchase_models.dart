int _int(Object? value) => int.tryParse('$value') ?? 0;

class Supplier {
  const Supplier({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.taxCode,
    this.address,
    this.note,
    this.status = 'active',
  });

  factory Supplier.fromJson(Map<String, dynamic> json) => Supplier(
    id: '${json['id']}',
    name: '${json['name']}',
    phone: json['phone']?.toString(),
    email: json['email']?.toString(),
    taxCode: json['tax_code']?.toString(),
    address: json['address']?.toString(),
    note: json['note']?.toString(),
    status: json['status']?.toString() ?? 'active',
  );

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? taxCode;
  final String? address;
  final String? note;
  final String status;
}

class PurchaseReceiptLine {
  const PurchaseReceiptLine({
    required this.id,
    required this.variantId,
    required this.productName,
    required this.sku,
    required this.quantity,
    required this.unitCost,
    required this.lineTotal,
  });

  factory PurchaseReceiptLine.fromJson(Map<String, dynamic> json) =>
      PurchaseReceiptLine(
        id: '${json['id']}',
        variantId: '${json['product_variant_id']}',
        productName: '${json['product_name']}',
        sku: '${json['sku']}',
        quantity: _int(json['quantity']),
        unitCost: _int(json['unit_cost']),
        lineTotal: _int(json['line_total']),
      );

  final String id;
  final String variantId;
  final String productName;
  final String sku;
  final int quantity;
  final int unitCost;
  final int lineTotal;
}

class PurchaseReceiptDetail {
  const PurchaseReceiptDetail({
    required this.id,
    required this.receiptNo,
    required this.status,
    required this.totalAmount,
    required this.receivedAt,
    required this.items,
    this.supplierName,
    this.supplierPhone,
    this.note,
  });

  factory PurchaseReceiptDetail.fromJson(Map<String, dynamic> json) =>
      PurchaseReceiptDetail(
        id: '${json['id']}',
        receiptNo: '${json['receipt_no']}',
        status: '${json['status']}',
        totalAmount: _int(json['total_amount']),
        receivedAt: DateTime.tryParse('${json['received_at']}'),
        supplierName: json['supplier_name']?.toString(),
        supplierPhone: json['supplier_phone']?.toString(),
        note: json['note']?.toString(),
        items: (json['items'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(PurchaseReceiptLine.fromJson)
            .toList(),
      );

  final String id;
  final String receiptNo;
  final String status;
  final int totalAmount;
  final DateTime? receivedAt;
  final String? supplierName;
  final String? supplierPhone;
  final String? note;
  final List<PurchaseReceiptLine> items;
}

class PurchaseReceipt {
  const PurchaseReceipt({
    required this.id,
    required this.receiptNo,
    required this.totalAmount,
    required this.itemCount,
    required this.receivedAt,
    this.supplierName,
  });

  factory PurchaseReceipt.fromJson(Map<String, dynamic> json) =>
      PurchaseReceipt(
        id: '${json['id']}',
        receiptNo: '${json['receipt_no']}',
        totalAmount: _int(json['total_amount']),
        itemCount: _int(json['item_count']),
        receivedAt: DateTime.tryParse('${json['received_at']}'),
        supplierName: json['supplier_name']?.toString(),
      );

  final String id;
  final String receiptNo;
  final int totalAmount;
  final int itemCount;
  final DateTime? receivedAt;
  final String? supplierName;
}

class PurchaseReceiptPageData {
  const PurchaseReceiptPageData({required this.items, required this.hasMore});

  factory PurchaseReceiptPageData.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    return PurchaseReceiptPageData(
      items: (json['receipts'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PurchaseReceipt.fromJson)
          .toList(),
      hasMore: pagination['has_more'] == true,
    );
  }

  final List<PurchaseReceipt> items;
  final bool hasMore;
}
