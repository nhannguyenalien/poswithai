import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_error.dart';
import 'order_models.dart';
import 'order_repository.dart';

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({
    super.key,
    required this.repository,
    required this.orderId,
    this.openPaymentOnLoad = false,
  });

  final OrderRepository repository;
  final String orderId;
  final bool openPaymentOnLoad;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;
  bool _didOpenInitialPayment = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.repository.detail(widget.orderId);
      if (mounted) {
        setState(() => _data = data);
        final remaining = parseVnd(data['remaining']);
        if (widget.openPaymentOnLoad &&
            !_didOpenInitialPayment &&
            remaining > 0) {
          _didOpenInitialPayment = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _pay(remaining);
          });
        }
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay(int remaining) async {
    final paid = await showDialog<bool>(
      context: context,
      builder: (_) => _PaymentDialog(
        repository: widget.repository,
        orderId: widget.orderId,
        remaining: remaining,
      ),
    );
    if (paid == true) {
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đã ghi nhận thanh toán')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final order = data?['order'] as Map<String, dynamic>?;
    final items = data?['items'] as List<dynamic>? ?? const [];
    final payments = data?['payments'] as List<dynamic>? ?? const [];
    final remaining = parseVnd(data?['remaining']);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          order == null ? 'Chi tiết đơn' : '${order['order_number']}',
        ),
      ),
      body: _error != null && data == null
          ? Center(child: Text(_error!))
          : data == null || _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _amount('Tổng tiền', parseVnd(order?['total'])),
                  _amount('Đã thanh toán', parseVnd(data['paid_amount'])),
                  _amount('Còn lại', remaining, strong: true),
                  if (remaining > 0 &&
                      '${order?['status']}' != 'cancelled') ...[
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: () => _pay(remaining),
                      icon: const Icon(Icons.payments_outlined),
                      label: const Text('Ghi nhận thanh toán'),
                    ),
                  ],
                  const Divider(height: 32),
                  Text(
                    'Sản phẩm',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  ...items.map((raw) {
                    final item = raw as Map<String, dynamic>;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${item['product_name'] ?? item['sku'] ?? 'Sản phẩm'}',
                      ),
                      subtitle: Text(
                        '${item['quantity']} × ${formatVnd(parseVnd(item['unit_price']))}',
                      ),
                      trailing: Text(formatVnd(parseVnd(item['total']))),
                    );
                  }),
                  if (payments.isNotEmpty) ...[
                    const Divider(height: 32),
                    Text(
                      'Thanh toán',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    ...payments.map((raw) {
                      final payment = raw as Map<String, dynamic>;
                      final reference = '${payment['reference_no'] ?? ''}';
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.check_circle_outline),
                        title: Text(_paymentMethod('${payment['method']}')),
                        subtitle: reference.isEmpty
                            ? null
                            : Text('Mã tham chiếu: $reference'),
                        trailing: Text(formatVnd(parseVnd(payment['amount']))),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _amount(String label, int amount, {bool strong = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label),
        Text(
          formatVnd(amount),
          style: TextStyle(
            fontWeight: strong ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    ),
  );

  String _paymentMethod(String value) =>
      const {
        'cash': 'Tiền mặt',
        'card': 'Thẻ ngân hàng',
        'transfer': 'Chuyển khoản',
        'installment': 'Trả góp',
      }[value] ??
      value;
}

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({
    required this.repository,
    required this.orderId,
    required this.remaining,
  });

  final OrderRepository repository;
  final String orderId;
  final int remaining;

  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amount = TextEditingController(
    text: '${widget.remaining}',
  );
  final _reference = TextEditingController();
  String _method = 'cash';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.createPayment(
        orderId: widget.orderId,
        method: _method,
        amount: int.parse(_amount.text),
        referenceNo: _reference.text,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ghi nhận thanh toán'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: _method,
                decoration: const InputDecoration(labelText: 'Phương thức'),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Tiền mặt')),
                  DropdownMenuItem(
                    value: 'transfer',
                    child: Text('Chuyển khoản'),
                  ),
                  DropdownMenuItem(value: 'card', child: Text('Thẻ ngân hàng')),
                  DropdownMenuItem(
                    value: 'installment',
                    child: Text('Trả góp'),
                  ),
                ],
                onChanged: (value) => setState(() => _method = value ?? 'cash'),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _amount,
                decoration: InputDecoration(
                  labelText: 'Số tiền (VND)',
                  helperText: 'Còn lại: ${formatVnd(widget.remaining)}',
                ),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (value) {
                  final amount = int.tryParse(value ?? '') ?? 0;
                  if (amount <= 0) return 'Số tiền phải lớn hơn 0';
                  if (amount > widget.remaining) {
                    return 'Số tiền vượt quá còn lại';
                  }
                  return null;
                },
              ),
              if (_method != 'cash') ...[
                const SizedBox(height: 14),
                TextFormField(
                  controller: _reference,
                  decoration: const InputDecoration(labelText: 'Mã tham chiếu'),
                ),
              ],
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Xác nhận'),
        ),
      ],
    );
  }
}
