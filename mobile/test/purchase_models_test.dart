import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/purchases/purchase_models.dart';

void main() {
  test('purchase receipt keeps PostgreSQL bigint values as VND integers', () {
    final receipt = PurchaseReceipt.fromJson({
      'id': 'receipt-1',
      'receipt_no': 'PN-001',
      'total_amount': '12500000',
      'item_count': '3',
      'supplier_name': 'Nhà cung cấp A',
      'received_at': '2026-08-15T08:00:00.000Z',
    });

    expect(receipt.totalAmount, 12500000);
    expect(receipt.itemCount, 3);
    expect(receipt.supplierName, 'Nhà cung cấp A');
  });
}
