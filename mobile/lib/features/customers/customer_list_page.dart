import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import 'customer_detail_page.dart';
import 'customer_models.dart';
import 'customer_repository.dart';

class CustomerListPage extends StatefulWidget {
  const CustomerListPage({
    super.key,
    required this.api,
    this.selectionMode = false,
  });

  final ApiClient api;
  final bool selectionMode;

  @override
  State<CustomerListPage> createState() => _CustomerListPageState();
}

class _CustomerListPageState extends State<CustomerListPage> {
  late final CustomerRepository _repository = CustomerRepository(widget.api);
  final _search = TextEditingController();
  final _customers = <CustomerSummary>[];
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
        offset: reset ? 0 : _customers.length,
        search: _search.text,
      );
      if (!mounted) return;
      setState(() {
        if (reset) _customers.clear();
        _customers.addAll(page.customers);
        _hasMore = page.hasMore;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final customer = await showDialog<CustomerSummary>(
      context: context,
      builder: (_) => _CustomerCreateDialog(repository: _repository),
    );
    if (customer == null || !mounted) return;
    if (widget.selectionMode) {
      Navigator.of(context).pop(customer);
    } else {
      await _load(reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.selectionMode ? 'Chọn khách hàng' : 'Khách hàng'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Tạo khách'),
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
                labelText: 'Tìm theo tên hoặc số điện thoại',
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
            ..._customers.map(
              (customer) => Card(
                child: ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.person_outline),
                  ),
                  title: Text(customer.name),
                  subtitle: Text(
                    customer.phone?.isNotEmpty == true
                        ? customer.phone!
                        : '${customer.totalOrders} đơn hàng',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    if (widget.selectionMode) {
                      Navigator.of(context).pop(customer);
                      return;
                    }
                    await Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => CustomerDetailPage(
                          repository: _repository,
                          customerId: customer.id,
                        ),
                      ),
                    );
                    if (mounted) await _load(reset: true);
                  },
                ),
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (!_loading && _hasMore && _customers.isNotEmpty)
              TextButton(onPressed: _load, child: const Text('Tải thêm')),
            if (!_loading && _customers.isEmpty && _error == null)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: Text('Chưa có khách hàng')),
              ),
            const SizedBox(height: 72),
          ],
        ),
      ),
    );
  }
}

class _CustomerCreateDialog extends StatefulWidget {
  const _CustomerCreateDialog({required this.repository});
  final CustomerRepository repository;

  @override
  State<_CustomerCreateDialog> createState() => _CustomerCreateDialogState();
}

class _CustomerCreateDialogState extends State<_CustomerCreateDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final customer = await widget.repository.create(
        name: _name.text,
        phone: _phone.text,
        email: _email.text,
        address: _address.text,
      );
      if (mounted) Navigator.of(context).pop(customer);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Tạo khách hàng'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'Tên khách hàng *',
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Tên là bắt buộc'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: const InputDecoration(labelText: 'Số điện thoại'),
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _address,
                decoration: const InputDecoration(labelText: 'Địa chỉ'),
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
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: const Text('Tạo'),
        ),
      ],
    );
  }
}
