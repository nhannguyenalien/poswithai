import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../orders/order_models.dart';
import 'customer_detail_page.dart';
import 'customer_models.dart';
import 'customer_repository.dart';

class CustomerDebtOverviewPage extends StatefulWidget {
  const CustomerDebtOverviewPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<CustomerDebtOverviewPage> createState() =>
      _CustomerDebtOverviewPageState();
}

class _CustomerDebtOverviewPageState extends State<CustomerDebtOverviewPage> {
  late final CustomerRepository _repository = CustomerRepository(widget.api);
  final _search = TextEditingController();
  final _customers = <CustomerDebtSummary>[];
  String _direction = 'all';
  bool _loading = false;
  bool _hasMore = true;
  int _receivable = 0;
  int _payable = 0;
  int _customerCount = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await _repository.debtList(
        offset: reset ? 0 : _customers.length,
        search: _search.text,
        direction: _direction,
      );
      if (!mounted) return;
      setState(() {
        if (reset) _customers.clear();
        _customers.addAll(page.customers);
        _hasMore = page.hasMore;
        _receivable = page.receivableMoney;
        _payable = page.payableMoney;
        _customerCount = page.customerCount;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(CustomerDebtSummary customer) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CustomerDetailPage(
          repository: _repository,
          customerId: customer.id,
        ),
      ),
    );
    if (mounted) await _load(reset: true);
  }

  Future<void> _adjust(CustomerDebtSummary customer) async {
    final changed = await showDebtAdjustmentDialog(
      context: context,
      repository: _repository,
      customerId: customer.id,
    );
    if (changed) await _load(reset: true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Công nợ khách hàng')),
    body: RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: _DebtMetric(
                  label: 'Cần thu',
                  value: formatVnd(_receivable),
                  color: Colors.orange.shade800,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DebtMetric(
                  label: 'Cần trả',
                  value: formatVnd(_payable),
                  color: Colors.blue.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _load(reset: true),
            decoration: InputDecoration(
              labelText: 'Tên hoặc số điện thoại',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                onPressed: () => _load(reset: true),
                icon: const Icon(Icons.arrow_forward),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'all', label: Text('Tất cả')),
              ButtonSegment(value: 'customer_owes', label: Text('Cần thu')),
              ButtonSegment(value: 'shop_owes', label: Text('Cần trả')),
            ],
            selected: {_direction},
            onSelectionChanged: (value) {
              setState(() => _direction = value.single);
              _load(reset: true);
            },
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 16, 4, 4),
            child: Text('$_customerCount khách có công nợ'),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          ..._customers.map(
            (customer) => Card(
              child: ListTile(
                onTap: () => _open(customer),
                title: Text(customer.name),
                subtitle: Text(_debtDescription(customer)),
                trailing: IconButton(
                  tooltip: 'Thu/trả nợ nhanh',
                  onPressed: () => _adjust(customer),
                  icon: const Icon(Icons.payments_outlined),
                ),
              ),
            ),
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (!_loading && _hasMore && _customers.isNotEmpty)
            TextButton(onPressed: _load, child: const Text('Tải thêm')),
          if (!_loading && _customers.isEmpty && _error == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('Không có công nợ phù hợp')),
            ),
        ],
      ),
    ),
  );

  String _debtDescription(CustomerDebtSummary customer) {
    final parts = <String>[];
    if (customer.moneyDebt > 0) {
      parts.add('Khách nợ ${formatVnd(customer.moneyDebt)}');
    } else if (customer.moneyDebt < 0) {
      parts.add('Tiệm nợ ${formatVnd(customer.moneyDebt.abs())}');
    }
    if (_decimalIsNonZero(customer.goldDebt99)) {
      parts.add('Vàng ${customer.goldDebt99} chỉ');
    }
    return parts.join(' · ');
  }

  bool _decimalIsNonZero(String value) =>
      !RegExp(r'^-?0+(\.0+)?$').hasMatch(value);
}

class _DebtMetric extends StatelessWidget {
  const _DebtMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(color: color),
          ),
        ],
      ),
    ),
  );
}
