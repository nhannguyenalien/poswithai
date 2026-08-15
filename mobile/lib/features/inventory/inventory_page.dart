import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../orders/barcode_scanner_page.dart';
import '../orders/order_models.dart';
import 'inventory_models.dart';
import 'inventory_repository.dart';

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends State<InventoryPage> {
  late final InventoryRepository _repository = InventoryRepository(widget.api);
  final _search = TextEditingController();
  List<StockItem> _stock = const [];
  List<InventoryEntry> _history = const [];
  String? _historyType;
  String? _error;
  bool _loading = false;
  bool _hasMore = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _repository.stock(),
        _repository.history(type: _historyType),
      ]);
      if (!mounted) return;
      final page = results[1] as InventoryHistoryPage;
      setState(() {
        _stock = results[0] as List<StockItem>;
        _history = page.items;
        _hasMore = page.hasMore;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _more() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final page = await _repository.history(
        offset: _history.length,
        type: _historyType,
      );
      if (mounted) {
        setState(() {
          _history = [..._history, ...page.items];
          _hasMore = page.hasMore;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _scan() async {
    final value = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeScannerPage()),
    );
    if (value == null || !mounted) return;
    final matches = _stock.where(
      (item) =>
          item.barcode == value ||
          item.sku.toLowerCase() == value.toLowerCase(),
    );
    if (matches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không tìm thấy mã $value trong tồn kho')),
      );
      return;
    }
    await _openTransaction(matches.first);
  }

  Future<void> _openTransaction(StockItem item) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _InventoryDialog(item: item, repository: _repository),
    );
    if (saved == true) await _reload();
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý kho'),
        actions: [
          IconButton(
            onPressed: _scan,
            tooltip: 'Quét barcode',
            icon: const Icon(Icons.qr_code_scanner),
          ),
        ],
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Tồn kho'),
            Tab(text: 'Lịch sử'),
          ],
        ),
      ),
      body: Column(
        children: [
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            ListTile(
              leading: const Icon(Icons.error_outline),
              title: Text(_error!),
              trailing: IconButton(
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
              ),
            ),
          Expanded(child: TabBarView(children: [_stockTab(), _historyTab()])),
        ],
      ),
    ),
  );

  Widget _stockTab() {
    final query = _search.text.trim().toLowerCase();
    final items = _stock
        .where(
          (item) =>
              query.isEmpty ||
              item.productName.toLowerCase().contains(query) ||
              item.sku.toLowerCase().contains(query) ||
              item.barcode.toLowerCase().contains(query),
        )
        .toList();
    return RefreshIndicator(
      onRefresh: _reload,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        children: [
          TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Tên, SKU hoặc barcode',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                onPressed: _scan,
                icon: const Icon(Icons.qr_code_scanner),
              ),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('Không có sản phẩm phù hợp.')),
            ),
          ...items.map(
            (item) => Card(
              child: ListTile(
                onTap: () => _openTransaction(item),
                title: Text(item.productName),
                subtitle: Text(
                  '${item.sku}${item.barcode.isEmpty ? '' : ' · ${item.barcode}'}',
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Tồn ${item.quantity}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(formatVnd(item.price)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _historyTab() => RefreshIndicator(
    onRefresh: _reload,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(12),
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final option in const <String?, String>{
              null: 'Tất cả',
              'IN': 'Nhập',
              'OUT': 'Xuất',
              'ADJUST': 'Kiểm kho',
            }.entries)
              ChoiceChip(
                label: Text(option.value),
                selected: _historyType == option.key,
                onSelected: (_) {
                  setState(() => _historyType = option.key);
                  _reload();
                },
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (_history.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: Text('Chưa có giao dịch kho.')),
          ),
        ..._history.map(
          (entry) => ListTile(
            leading: CircleAvatar(child: Icon(_typeIcon(entry.type))),
            title: Text(entry.productName),
            subtitle: Text(
              '${entry.sku} · ${_dateTime(entry.createdAt)}${entry.note?.isNotEmpty == true ? '\n${entry.note}' : ''}',
            ),
            isThreeLine: entry.note?.isNotEmpty == true,
            trailing: Text(
              '${entry.type == 'OUT'
                  ? '-'
                  : entry.type == 'IN'
                  ? '+'
                  : '='}${entry.quantity}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        if (_hasMore)
          OutlinedButton(
            onPressed: _loading ? null : _more,
            child: const Text('Xem thêm'),
          ),
      ],
    ),
  );
}

class _InventoryDialog extends StatefulWidget {
  const _InventoryDialog({required this.item, required this.repository});
  final StockItem item;
  final InventoryRepository repository;
  @override
  State<_InventoryDialog> createState() => _InventoryDialogState();
}

class _InventoryDialogState extends State<_InventoryDialog> {
  String _type = 'IN';
  final _quantity = TextEditingController(text: '1');
  final _cost = TextEditingController();
  final _note = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    if (widget.item.lastCost != null) _cost.text = '${widget.item.lastCost}';
  }

  @override
  void dispose() {
    _quantity.dispose();
    _cost.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final quantity = int.tryParse(_quantity.text.trim());
    final cost = _cost.text.trim().isEmpty
        ? null
        : int.tryParse(_cost.text.trim());
    if (quantity == null ||
        quantity < (_type == 'ADJUST' ? 0 : 1) ||
        (_type == 'IN' && _cost.text.isNotEmpty && cost == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kiểm tra lại số lượng và giá vốn.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.repository.create(
        item: widget.item,
        type: _type,
        quantity: quantity,
        unitCost: _type == 'IN' ? cost : null,
        note: _note.text,
        reason: _type == 'ADJUST' ? _note.text : null,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiError catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.item.productName),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('${widget.item.sku} · đang tồn ${widget.item.quantity}'),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'IN', label: Text('Nhập')),
              ButtonSegment(value: 'OUT', label: Text('Xuất')),
              ButtonSegment(value: 'ADJUST', label: Text('Kiểm')),
            ],
            selected: {_type},
            onSelectionChanged: (value) => setState(() => _type = value.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _quantity,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: _type == 'ADJUST' ? 'Tồn thực tế' : 'Số lượng',
              border: const OutlineInputBorder(),
            ),
          ),
          if (_type == 'IN') ...[
            const SizedBox(height: 12),
            TextField(
              controller: _cost,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Giá vốn VND (không bắt buộc)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: InputDecoration(
              labelText: _type == 'ADJUST' ? 'Lý do kiểm kho' : 'Ghi chú',
              border: const OutlineInputBorder(),
            ),
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
        child: Text(_saving ? 'Đang lưu…' : 'Lưu'),
      ),
    ],
  );
}

IconData _typeIcon(String type) => switch (type) {
  'IN' => Icons.south_west,
  'OUT' => Icons.north_east,
  _ => Icons.fact_check_outlined,
};
String _dateTime(DateTime? value) => value == null
    ? ''
    : '${value.toLocal().day.toString().padLeft(2, '0')}/${value.toLocal().month.toString().padLeft(2, '0')}/${value.toLocal().year} ${value.toLocal().hour.toString().padLeft(2, '0')}:${value.toLocal().minute.toString().padLeft(2, '0')}';
