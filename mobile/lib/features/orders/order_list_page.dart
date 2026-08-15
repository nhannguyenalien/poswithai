import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import 'order_create_page.dart';
import 'order_detail_page.dart';
import 'order_models.dart';
import 'order_repository.dart';

class OrderListPage extends StatefulWidget {
  const OrderListPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<OrderListPage> createState() => _OrderListPageState();
}

class _OrderListPageState extends State<OrderListPage> {
  late final OrderRepository _repository = OrderRepository(widget.api);
  final _search = TextEditingController();
  final _orders = <OrderSummary>[];
  bool _loading = false;
  bool _hasMore = true;
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
      final page = await _repository.list(
        offset: reset ? 0 : _orders.length,
        search: _search.text,
      );
      if (!mounted) return;
      setState(() {
        if (reset) _orders.clear();
        _orders.addAll(page.orders);
        _hasMore = page.hasMore;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final result = await Navigator.of(context).push<CreateOrderResult>(
      MaterialPageRoute(
        builder: (_) => OrderCreatePage(repository: _repository),
      ),
    );
    if (result != null) {
      await _load(reset: true);
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => OrderDetailPage(
              repository: _repository,
              orderId: result.id,
              openPaymentOnLoad: result.total > 0,
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đơn hàng')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('Tạo đơn'),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _load(reset: true),
              decoration: InputDecoration(
                labelText: 'Tìm mã đơn hoặc khách hàng',
                suffixIcon: IconButton(
                  onPressed: () => _load(reset: true),
                  icon: const Icon(Icons.search),
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (!_loading && _orders.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: Text('Chưa có đơn hàng')),
              ),
            ..._orders.map(
              (order) => Card(
                child: ListTile(
                  title: Text(order.number),
                  subtitle: Text(
                    '${order.customerName ?? 'Khách lẻ'} · ${_status(order.status)}',
                  ),
                  trailing: Text(
                    formatVnd(order.total),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => OrderDetailPage(
                        repository: _repository,
                        orderId: order.id,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (!_loading && _hasMore && _orders.isNotEmpty)
              TextButton(onPressed: _load, child: const Text('Tải thêm')),
            const SizedBox(height: 72),
          ],
        ),
      ),
    );
  }

  String _status(String value) =>
      const {
        'draft': 'Nháp',
        'pending': 'Chờ xử lý',
        'completed': 'Hoàn tất',
        'cancelled': 'Đã hủy',
      }[value] ??
      value;
}
