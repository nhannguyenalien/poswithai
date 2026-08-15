import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import 'purchase_models.dart';
import 'purchase_repository.dart';

String _money(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);

class PurchaseReceiptDetailPage extends StatefulWidget {
  const PurchaseReceiptDetailPage({
    super.key,
    required this.repository,
    required this.receiptId,
  });

  final PurchaseRepository repository;
  final String receiptId;

  @override
  State<PurchaseReceiptDetailPage> createState() =>
      _PurchaseReceiptDetailPageState();
}

class _PurchaseReceiptDetailPageState extends State<PurchaseReceiptDetailPage> {
  PurchaseReceiptDetail? _receipt;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final value = await widget.repository.receipt(widget.receiptId);
      if (mounted) setState(() => _receipt = value);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = _receipt;
    return Scaffold(
      appBar: AppBar(title: Text(receipt?.receiptNo ?? 'Chi tiết phiếu nhập')),
      body: receipt == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!),
                        TextButton(
                          onPressed: _load,
                          child: const Text('Thử lại'),
                        ),
                      ],
                    ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            receipt.receiptNo,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            receipt.supplierName ?? 'Không chọn nhà cung cấp',
                          ),
                          if (receipt.supplierPhone?.isNotEmpty == true)
                            Text(receipt.supplierPhone!),
                          if (receipt.receivedAt != null)
                            Text(
                              'Ngày nhập: ${receipt.receivedAt!.toLocal().toString().substring(0, 16)}',
                            ),
                          if (receipt.note?.isNotEmpty == true)
                            Text('Ghi chú: ${receipt.note}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Sản phẩm',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final item in receipt.items)
                    Card(
                      child: ListTile(
                        title: Text(item.productName),
                        subtitle: Text(
                          '${item.sku} · ${item.quantity} × ${_money(item.unitCost)} đ',
                        ),
                        trailing: Text('${_money(item.lineTotal)} đ'),
                      ),
                    ),
                  const Divider(height: 32),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Tổng cộng',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        '${_money(receipt.totalAmount)} đ',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}
