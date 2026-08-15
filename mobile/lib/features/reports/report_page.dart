import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../orders/order_models.dart';
import 'report_models.dart';
import 'report_repository.dart';

class ReportPage extends StatefulWidget {
  const ReportPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage> {
  late final ReportRepository _repository = ReportRepository(widget.api);
  late DateTime _to = _day(DateTime.now());
  late DateTime _from = _to.subtract(const Duration(days: 29));
  RevenueReport? _revenue;
  StockReport? _stock;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _repository.load(_from, _to);
      if (mounted) {
        setState(() {
          _revenue = result.$1;
          _stock = result.$2;
        });
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: DateTimeRange(start: _from, end: _to),
    );
    if (picked == null) return;
    setState(() {
      _from = picked.start;
      _to = picked.end;
    });
    await _load();
  }

  void _preset(int days) {
    final to = _day(DateTime.now());
    setState(() {
      _to = to;
      _from = to.subtract(Duration(days: days - 1));
    });
    _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Báo cáo kinh doanh')),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('7 ngày'),
                selected: _days == 7,
                onSelected: (_) => _preset(7),
              ),
              ChoiceChip(
                label: const Text('30 ngày'),
                selected: _days == 30,
                onSelected: (_) => _preset(30),
              ),
              ActionChip(
                avatar: const Icon(Icons.date_range, size: 18),
                label: Text('${_date(_from)} – ${_date(_to)}'),
                onPressed: _pickRange,
              ),
            ],
          ),
          if (_loading && _revenue == null)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (_error != null)
            Card(
              child: ListTile(
                leading: const Icon(Icons.error_outline),
                title: Text(_error!),
                trailing: IconButton(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                ),
              ),
            ),
          if (_revenue case final revenue?) ...[
            const SizedBox(height: 16),
            _heading('Kết quả kinh doanh'),
            GridView.count(
              crossAxisCount: 2,
              childAspectRatio: 1.55,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _Metric(
                  title: 'Doanh thu',
                  value: formatVnd(revenue.revenue),
                  note: _change(revenue.revenueChange),
                ),
                _Metric(
                  title: 'Đơn hoàn tất',
                  value: '${revenue.completedOrders}',
                  note: 'Giá trị TB ${formatVnd(revenue.averageOrderValue)}',
                ),
                _Metric(
                  title: 'Công nợ cần thu',
                  value: formatVnd(revenue.receivable),
                ),
                if (_stock case final stock?)
                  _Metric(
                    title: 'Giá trị tồn',
                    value: formatVnd(stock.totalValue),
                    note: '${stock.totalUnits} sản phẩm',
                  ),
              ],
            ),
            const SizedBox(height: 16),
            _heading('Doanh thu theo ngày'),
            if (revenue.daily.isEmpty)
              const _Empty('Chưa có doanh thu trong kỳ.'),
            ...revenue.daily.map(
              (item) => _RevenueBar(
                item: item,
                max: revenue.daily.fold<int>(
                  0,
                  (value, row) => math.max(value, row.revenue),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _heading('Sản phẩm bán chạy'),
            if (revenue.topProducts.isEmpty)
              const _Empty('Chưa có sản phẩm đã bán trong kỳ.'),
            ...revenue.topProducts.asMap().entries.map(
              (entry) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Text('${entry.key + 1}')),
                title: Text(entry.value.name),
                subtitle: Text(
                  '${entry.value.sku} · ${entry.value.quantity} sản phẩm',
                ),
                trailing: Text(formatVnd(entry.value.revenue)),
              ),
            ),
          ],
          if (_stock case final stock?) ...[
            const SizedBox(height: 16),
            _heading('Cảnh báo tồn kho'),
            Text(
              '${stock.lowCount} mã sắp hết · ${stock.zeroCount} mã đã hết',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 8),
            if (stock.items.isEmpty)
              const _Empty('Không có sản phẩm tồn thấp.'),
            ...stock.items.map(
              (item) => Card(
                child: ListTile(
                  leading: Icon(
                    item.isZero
                        ? Icons.remove_shopping_cart_outlined
                        : Icons.warning_amber,
                    color: item.isZero ? Colors.red : Colors.orange.shade800,
                  ),
                  title: Text(item.name),
                  subtitle: Text(item.sku),
                  trailing: Text(
                    item.isZero ? 'Hết hàng' : 'Còn ${item.quantity}',
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    ),
  );

  int get _days => _to.difference(_from).inDays + 1;
  Widget _heading(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text, style: Theme.of(context).textTheme.titleLarge),
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.title, required this.value, this.note});
  final String title;
  final String value;
  final String? note;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(title),
          const SizedBox(height: 6),
          FittedBox(
            child: Text(value, style: Theme.of(context).textTheme.titleLarge),
          ),
          if (note != null)
            Text(note!, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    ),
  );
}

class _RevenueBar extends StatelessWidget {
  const _RevenueBar({required this.item, required this.max});
  final DailyRevenue item;
  final int max;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            SizedBox(width: 55, child: Text(_shortDate(item.date))),
            Expanded(
              child: Text(formatVnd(item.revenue), textAlign: TextAlign.right),
            ),
          ],
        ),
        const SizedBox(height: 4),
        LinearProgressIndicator(
          value: max == 0 ? 0 : item.revenue / max,
          minHeight: 7,
          borderRadius: BorderRadius.circular(8),
        ),
      ],
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Text(text),
  );
}

DateTime _day(DateTime value) => DateTime(value.year, value.month, value.day);
String _date(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
String _shortDate(DateTime? value) => value == null
    ? '--/--'
    : '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}';
String? _change(double? value) => value == null
    ? 'Chưa có kỳ trước để so sánh'
    : '${value >= 0 ? '+' : ''}${value.toStringAsFixed(1)}% so với kỳ trước';
