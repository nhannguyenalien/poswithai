import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import 'purchase_models.dart';
import 'purchase_repository.dart';

class SupplierPage extends StatefulWidget {
  const SupplierPage({super.key, required this.repository});
  final PurchaseRepository repository;

  @override
  State<SupplierPage> createState() => _SupplierPageState();
}

class _SupplierPageState extends State<SupplierPage> {
  final _search = TextEditingController();
  List<Supplier> _items = const [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await widget.repository.suppliers(search: _search.text);
      if (mounted) setState(() => _items = items);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit([Supplier? current]) async {
    final result = await showDialog<Supplier>(
      context: context,
      builder: (_) => _SupplierDialog(current: current),
    );
    if (result == null) return;
    try {
      if (current == null) {
        await widget.repository.createSupplier(
          name: result.name,
          phone: result.phone,
          email: result.email,
          taxCode: result.taxCode,
          address: result.address,
          note: result.note,
        );
      } else {
        await widget.repository.updateSupplier(result);
      }
      await _load();
    } on ApiError catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _archive(Supplier item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ngừng sử dụng nhà cung cấp?'),
        content: Text(
          '${item.name} sẽ bị ẩn khỏi danh sách, lịch sử phiếu nhập vẫn được giữ.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Ngừng sử dụng'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.repository.archiveSupplier(item.id);
      await _load();
    } on ApiError catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Nhà cung cấp')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: _edit,
      icon: const Icon(Icons.person_add_alt_1),
      label: const Text('Thêm'),
    ),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _load(),
            decoration: InputDecoration(
              labelText: 'Tìm tên, điện thoại hoặc mã số thuế',
              suffixIcon: IconButton(
                onPressed: _load,
                icon: const Icon(Icons.search),
              ),
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            ListTile(
              title: Text(_error!),
              trailing: IconButton(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
              ),
            ),
          for (final item in _items)
            Card(
              child: ListTile(
                leading: const CircleAvatar(
                  child: Icon(Icons.local_shipping_outlined),
                ),
                title: Text(item.name),
                subtitle: Text(
                  item.phone?.isNotEmpty == true
                      ? item.phone!
                      : (item.email ?? 'Chưa có thông tin liên hệ'),
                ),
                onTap: () => _edit(item),
                trailing: PopupMenuButton<String>(
                  onSelected: (value) =>
                      value == 'edit' ? _edit(item) : _archive(item),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'edit', child: Text('Chỉnh sửa')),
                    PopupMenuItem(
                      value: 'archive',
                      child: Text('Ngừng sử dụng'),
                    ),
                  ],
                ),
              ),
            ),
          if (!_loading && _items.isEmpty && _error == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('Chưa có nhà cung cấp')),
            ),
          const SizedBox(height: 72),
        ],
      ),
    ),
  );
}

class _SupplierDialog extends StatefulWidget {
  const _SupplierDialog({this.current});
  final Supplier? current;

  @override
  State<_SupplierDialog> createState() => _SupplierDialogState();
}

class _SupplierDialogState extends State<_SupplierDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.current?.name);
  late final _phone = TextEditingController(text: widget.current?.phone);
  late final _email = TextEditingController(text: widget.current?.email);
  late final _taxCode = TextEditingController(text: widget.current?.taxCode);
  late final _address = TextEditingController(text: widget.current?.address);
  late final _note = TextEditingController(text: widget.current?.note);

  @override
  void dispose() {
    for (final value in [_name, _phone, _email, _taxCode, _address, _note]) {
      value.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.current == null ? 'Thêm nhà cung cấp' : 'Sửa nhà cung cấp',
    ),
    content: Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Tên *'),
              validator: (value) => value?.trim().isEmpty == true
                  ? 'Nhập tên nhà cung cấp'
                  : null,
            ),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Điện thoại'),
            ),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            TextFormField(
              controller: _taxCode,
              decoration: const InputDecoration(labelText: 'Mã số thuế'),
            ),
            TextFormField(
              controller: _address,
              decoration: const InputDecoration(labelText: 'Địa chỉ'),
            ),
            TextFormField(
              controller: _note,
              decoration: const InputDecoration(labelText: 'Ghi chú'),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(
        onPressed: () {
          if (!_formKey.currentState!.validate()) return;
          Navigator.pop(
            context,
            Supplier(
              id: widget.current?.id ?? '',
              name: _name.text.trim(),
              phone: _phone.text.trim(),
              email: _email.text.trim(),
              taxCode: _taxCode.text.trim(),
              address: _address.text.trim(),
              note: _note.text.trim(),
              status: widget.current?.status ?? 'active',
            ),
          );
        },
        child: const Text('Lưu'),
      ),
    ],
  );
}
