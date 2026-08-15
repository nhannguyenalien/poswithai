import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../inventory/inventory_models.dart';
import '../orders/barcode_scanner_page.dart';
import 'purchase_models.dart';
import 'purchase_receipt_detail_page.dart';
import 'purchase_repository.dart';
import 'supplier_page.dart';

String _money(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);

class PurchaseReceiptPage extends StatefulWidget {
  const PurchaseReceiptPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<PurchaseReceiptPage> createState() => _PurchaseReceiptPageState();
}

class _PurchaseReceiptPageState extends State<PurchaseReceiptPage> {
  late final PurchaseRepository _repository = PurchaseRepository(widget.api);
  List<PurchaseReceipt> _items = const [];
  bool _loading = false;
  bool _hasMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final page = await _repository.receipts(offset: more ? _items.length : 0);
      if (!mounted) return;
      setState(() {
        _items = more ? [..._items, ...page.items] : page.items;
        _hasMore = page.hasMore;
        _error = null;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _PurchaseReceiptForm(repository: _repository),
      ),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Phiếu nhập kho'),
      actions: [
        IconButton(
          tooltip: 'Nhà cung cấp',
          icon: const Icon(Icons.local_shipping_outlined),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => SupplierPage(repository: _repository),
            ),
          ),
        ),
      ],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: _create,
      icon: const Icon(Icons.add),
      label: const Text('Tạo phiếu'),
    ),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            ListTile(
              leading: const Icon(Icons.error_outline),
              title: Text(_error!),
              trailing: IconButton(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
              ),
            ),
          if (!_loading && _items.isEmpty && _error == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('Chưa có phiếu nhập kho')),
            ),
          for (final item in _items)
            Card(
              child: ListTile(
                leading: const Icon(Icons.local_shipping_outlined),
                title: Text(item.receiptNo),
                subtitle: Text(
                  '${item.supplierName ?? 'Không chọn nhà cung cấp'} · ${item.itemCount} dòng',
                ),
                trailing: Text('${_money(item.totalAmount)} đ'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => PurchaseReceiptDetailPage(
                      repository: _repository,
                      receiptId: item.id,
                    ),
                  ),
                ),
              ),
            ),
          if (_hasMore)
            TextButton(
              onPressed: () => _load(more: true),
              child: const Text('Tải thêm'),
            ),
          const SizedBox(height: 80),
        ],
      ),
    ),
  );
}

class _PurchaseLine {
  const _PurchaseLine(this.item, this.quantity, this.unitCost);
  final StockItem item;
  final int quantity;
  final int unitCost;
}

class _PurchaseReceiptForm extends StatefulWidget {
  const _PurchaseReceiptForm({required this.repository});
  final PurchaseRepository repository;

  @override
  State<_PurchaseReceiptForm> createState() => _PurchaseReceiptFormState();
}

class _PurchaseReceiptFormState extends State<_PurchaseReceiptForm> {
  final _receiptNo = TextEditingController();
  final _note = TextEditingController();
  List<Supplier> _suppliers = const [];
  List<StockItem> _stock = const [];
  final List<_PurchaseLine> _lines = [];
  String? _supplierId;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  int get _total =>
      _lines.fold(0, (sum, line) => sum + line.quantity * line.unitCost);

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  @override
  void dispose() {
    _receiptNo.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _prepare() async {
    try {
      final data = await Future.wait([
        widget.repository.suppliers(),
        widget.repository.stock(),
      ]);
      if (mounted) {
        setState(() {
          _suppliers = data[0] as List<Supplier>;
          _stock = data[1] as List<StockItem>;
        });
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _scan() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeScannerPage()),
    );
    if (code == null || !mounted) return;
    final matches = _stock.where(
      (item) =>
          item.barcode == code || item.sku.toLowerCase() == code.toLowerCase(),
    );
    if (matches.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Không tìm thấy mã $code')));
      return;
    }
    await _edit(matches.first);
  }

  Future<void> _choose() async {
    final search = TextEditingController();
    final selected = await showModalBottomSheet<StockItem>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final query = search.text.trim().toLowerCase();
          final filtered = _stock
              .where(
                (item) =>
                    query.isEmpty ||
                    item.productName.toLowerCase().contains(query) ||
                    item.sku.toLowerCase().contains(query),
              )
              .toList();
          return SafeArea(
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height * .75,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: TextField(
                      controller: search,
                      onChanged: (_) => setSheetState(() {}),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        labelText: 'Tìm sản phẩm hoặc SKU',
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (_, index) {
                        final item = filtered[index];
                        return ListTile(
                          title: Text(item.productName),
                          subtitle: Text('${item.sku} · tồn ${item.quantity}'),
                          onTap: () => Navigator.pop(context, item),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    search.dispose();
    if (selected != null && mounted) await _edit(selected);
  }

  Future<void> _edit(StockItem item) async {
    final old = _lines
        .where((line) => line.item.variantId == item.variantId)
        .firstOrNull;
    final qty = TextEditingController(text: '${old?.quantity ?? 1}');
    final cost = TextEditingController(
      text: '${old?.unitCost ?? item.lastCost ?? 0}',
    );
    final result = await showDialog<(int, int)>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item.productName),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: qty,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Số lượng'),
            ),
            TextField(
              controller: cost,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Giá nhập (VND)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              final q = int.tryParse(qty.text);
              final c = int.tryParse(cost.text);
              if (q != null && q > 0 && c != null && c >= 0) {
                Navigator.pop(context, (q, c));
              }
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
    qty.dispose();
    cost.dispose();
    if (result == null || !mounted) return;
    setState(() {
      _lines.removeWhere((line) => line.item.variantId == item.variantId);
      _lines.add(_PurchaseLine(item, result.$1, result.$2));
    });
  }

  Future<void> _newSupplier() async {
    final name = TextEditingController();
    final phone = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nhà cung cấp mới'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Tên *'),
            ),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Điện thoại'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, name.text.trim().isNotEmpty),
            child: const Text('Tạo'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      final supplier = await widget.repository.createSupplier(
        name: name.text,
        phone: phone.text,
      );
      if (mounted) {
        setState(() {
          _suppliers = [..._suppliers, supplier];
          _supplierId = supplier.id;
        });
      }
    }
    name.dispose();
    phone.dispose();
  }

  Future<void> _save() async {
    if (_lines.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.createReceipt(
        supplierId: _supplierId,
        receiptNo: _receiptNo.text,
        note: _note.text,
        items: _lines
            .map(
              (line) => (
                variantId: line.item.variantId,
                quantity: line.quantity,
                unitCost: line.unitCost,
              ),
            )
            .toList(),
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Tạo phiếu nhập'),
      actions: [
        IconButton(
          onPressed: _loading ? null : _scan,
          icon: const Icon(Icons.qr_code_scanner),
          tooltip: 'Quét barcode',
        ),
      ],
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null)
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _supplierId,
                      decoration: const InputDecoration(
                        labelText: 'Nhà cung cấp',
                      ),
                      items: _suppliers
                          .map(
                            (supplier) => DropdownMenuItem(
                              value: supplier.id,
                              child: Text(supplier.name),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => _supplierId = value),
                    ),
                  ),
                  IconButton(
                    onPressed: _newSupplier,
                    icon: const Icon(Icons.person_add_alt_1),
                    tooltip: 'Thêm nhà cung cấp',
                  ),
                ],
              ),
              TextField(
                controller: _receiptNo,
                decoration: const InputDecoration(
                  labelText: 'Số phiếu (để trống sẽ tự tạo)',
                ),
              ),
              TextField(
                controller: _note,
                decoration: const InputDecoration(labelText: 'Ghi chú'),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Sản phẩm',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  OutlinedButton.icon(
                    onPressed: _choose,
                    icon: const Icon(Icons.add),
                    label: const Text('Thêm'),
                  ),
                ],
              ),
              for (final line in _lines)
                Card(
                  child: ListTile(
                    onTap: () => _edit(line.item),
                    title: Text(line.item.productName),
                    subtitle: Text(
                      '${line.quantity} × ${_money(line.unitCost)} đ',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => setState(() => _lines.remove(line)),
                    ),
                  ),
                ),
              const Divider(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Tổng tiền'),
                  Text(
                    '${_money(_total)} đ',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _lines.isEmpty || _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save),
                label: const Text('Lưu và nhập kho'),
              ),
            ],
          ),
  );
}
