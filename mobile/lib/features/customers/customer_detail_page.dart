import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../orders/order_detail_page.dart';
import '../orders/order_models.dart';
import '../orders/order_repository.dart';
import 'customer_models.dart';
import 'customer_repository.dart';

Future<bool> showDebtAdjustmentDialog({
  required BuildContext context,
  required CustomerRepository repository,
  required String customerId,
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (_) =>
          _DebtAdjustmentDialog(repository: repository, customerId: customerId),
    ) ??
    false;

class CustomerDetailPage extends StatefulWidget {
  const CustomerDetailPage({
    super.key,
    required this.repository,
    required this.customerId,
  });

  final CustomerRepository repository;
  final String customerId;

  @override
  State<CustomerDetailPage> createState() => _CustomerDetailPageState();
}

class _CustomerDetailPageState extends State<CustomerDetailPage> {
  CustomerDetailData? _detail;
  CustomerDebtData? _debt;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait([
        widget.repository.detail(widget.customerId),
        widget.repository.debt(widget.customerId),
      ]);
      if (mounted) {
        setState(() {
          _detail = values[0] as CustomerDetailData;
          _debt = values[1] as CustomerDebtData;
          _error = null;
        });
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _edit() async {
    final customer = _detail?.customer;
    if (customer == null) return;
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => _CustomerEditDialog(
        repository: widget.repository,
        customer: customer,
      ),
    );
    if (changed == true) await _load();
  }

  Future<void> _adjustDebt() async {
    final changed = await showDebtAdjustmentDialog(
      context: context,
      repository: widget.repository,
      customerId: widget.customerId,
    );
    if (changed) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    final debt = _debt;
    return Scaffold(
      appBar: AppBar(
        title: Text(detail?.customer.name ?? 'Chi tiết khách hàng'),
        actions: [
          IconButton(
            onPressed: detail == null ? null : _edit,
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      floatingActionButton: detail == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _adjustDebt,
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: const Text('Điều chỉnh nợ'),
            ),
      body: _error != null && detail == null
          ? Center(child: Text(_error!))
          : detail == null || debt == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _ContactCard(customer: detail.customer),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _MetricCard(
                          label: _moneyDirection(debt.moneyDebt),
                          value: formatVnd(debt.moneyDebt.abs()),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _MetricCard(
                          label: 'Nợ vàng 99',
                          value: '${debt.goldDebt99} chỉ',
                        ),
                      ),
                    ],
                  ),
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
                  const SizedBox(height: 20),
                  Text(
                    'Đơn hàng gần đây',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (detail.orders.isEmpty)
                    const ListTile(title: Text('Chưa có đơn hàng')),
                  ...detail.orders.map(
                    (order) => Card(
                      child: ListTile(
                        title: Text(order.number),
                        subtitle: Text(order.status),
                        trailing: Text(formatVnd(order.total)),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => OrderDetailPage(
                              repository: OrderRepository(
                                widget.repository.api,
                              ),
                              orderId: order.id,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Chi tiết công nợ',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  ...debt.orders.map(
                    (item) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(item.number),
                      subtitle: Text(
                        item.direction == 'shop_owes'
                            ? 'Tiệm nợ khách'
                            : 'Khách nợ tiệm',
                      ),
                      trailing: Text(formatVnd(item.moneyDebt)),
                    ),
                  ),
                  ...debt.adjustments.map(
                    (item) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.tune),
                      title: Text(
                        item.note?.isNotEmpty == true
                            ? item.note!
                            : 'Điều chỉnh thủ công',
                      ),
                      subtitle: Text('Vàng 99: ${item.goldAmount99} chỉ'),
                      trailing: Text(formatVnd(item.moneyAmount)),
                    ),
                  ),
                  const SizedBox(height: 80),
                ],
              ),
            ),
    );
  }

  String _moneyDirection(int value) =>
      value < 0 ? 'Tiệm nợ khách' : 'Khách nợ tiệm';
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.customer});
  final CustomerSummary customer;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(customer.name, style: Theme.of(context).textTheme.titleLarge),
          if (customer.phone?.isNotEmpty == true) Text(customer.phone!),
          if (customer.email?.isNotEmpty == true) Text(customer.email!),
          if (customer.address?.isNotEmpty == true) Text(customer.address!),
          if (customer.isBusiness)
            Text('Doanh nghiệp · MST: ${customer.taxCode ?? ''}'),
        ],
      ),
    ),
  );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label),
          const SizedBox(height: 5),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    ),
  );
}

class _CustomerEditDialog extends StatefulWidget {
  const _CustomerEditDialog({required this.repository, required this.customer});
  final CustomerRepository repository;
  final CustomerSummary customer;

  @override
  State<_CustomerEditDialog> createState() => _CustomerEditDialogState();
}

class _CustomerEditDialogState extends State<_CustomerEditDialog> {
  late final _name = TextEditingController(text: widget.customer.name);
  late final _phone = TextEditingController(text: widget.customer.phone);
  late final _email = TextEditingController(text: widget.customer.email);
  late final _address = TextEditingController(text: widget.customer.address);
  late final _idCard = TextEditingController(text: widget.customer.idCard);
  late final _taxCode = TextEditingController(text: widget.customer.taxCode);
  late bool _business = widget.customer.isBusiness;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _address.dispose();
    _idCard.dispose();
    _taxCode.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Tên là bắt buộc');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.update(
        id: widget.customer.id,
        name: _name.text,
        phone: _phone.text,
        email: _email.text,
        address: _address.text,
        idCard: _idCard.text,
        isBusiness: _business,
        taxCode: _taxCode.text,
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiError catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = error.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Sửa khách hàng'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Tên *'),
          ),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Điện thoại'),
          ),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          TextField(
            controller: _address,
            decoration: const InputDecoration(labelText: 'Địa chỉ'),
          ),
          TextField(
            controller: _idCard,
            decoration: const InputDecoration(labelText: 'CCCD/CMND'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Khách doanh nghiệp'),
            value: _business,
            onChanged: (value) => setState(() => _business = value),
          ),
          if (_business)
            TextField(
              controller: _taxCode,
              decoration: const InputDecoration(labelText: 'Mã số thuế'),
            ),
          if (_error != null)
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: _saving ? null : () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(onPressed: _saving ? null : _save, child: const Text('Lưu')),
    ],
  );
}

class _DebtAdjustmentDialog extends StatefulWidget {
  const _DebtAdjustmentDialog({
    required this.repository,
    required this.customerId,
  });
  final CustomerRepository repository;
  final String customerId;

  @override
  State<_DebtAdjustmentDialog> createState() => _DebtAdjustmentDialogState();
}

class _DebtAdjustmentDialogState extends State<_DebtAdjustmentDialog> {
  final _money = TextEditingController(text: '0');
  final _gold = TextEditingController(text: '0');
  final _note = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _money.dispose();
    _gold.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final money = int.tryParse(_money.text.trim());
    final goldText = _gold.text.trim().replaceAll(',', '.');
    final validGold = RegExp(r'^-?\d+(\.\d+)?$').hasMatch(goldText);
    if (money == null ||
        !validGold ||
        (money == 0 && RegExp(r'^-?0+(\.0+)?$').hasMatch(goldText))) {
      setState(
        () => _error =
            'Nhập số tiền nguyên hoặc vàng 99; ít nhất một giá trị khác 0',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.addDebtAdjustment(
        customerId: widget.customerId,
        moneyAmount: money,
        goldAmount99: goldText,
        note: _note.text,
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiError catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = error.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Điều chỉnh công nợ'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Dương: khách nợ tiệm. Âm: giảm nợ hoặc tiệm nợ khách.'),
          TextField(
            controller: _money,
            keyboardType: const TextInputType.numberWithOptions(signed: true),
            decoration: const InputDecoration(labelText: 'Tiền (VND)'),
          ),
          TextField(
            controller: _gold,
            keyboardType: const TextInputType.numberWithOptions(
              decimal: true,
              signed: true,
            ),
            decoration: const InputDecoration(labelText: 'Vàng 99 (chỉ)'),
          ),
          TextField(
            controller: _note,
            decoration: const InputDecoration(labelText: 'Lý do'),
          ),
          if (_error != null)
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: _saving ? null : () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(
        onPressed: _saving ? null : _save,
        child: const Text('Ghi nhận'),
      ),
    ],
  );
}
