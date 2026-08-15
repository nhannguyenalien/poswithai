import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import 'product_models.dart';
import 'product_repository.dart';

class ProductFormPage extends StatefulWidget {
  const ProductFormPage({super.key, required this.repository, this.data});

  final ProductRepository repository;
  final ProductDetailData? data;

  @override
  State<ProductFormPage> createState() => _ProductFormPageState();
}

class _ProductFormPageState extends State<ProductFormPage> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.data?.product.name);
  late final _sku = TextEditingController(text: widget.data?.product.sku);
  late final _price = TextEditingController(
    text: widget.data == null ? '' : '${widget.data!.product.price}',
  );
  List<ProductCategory> _categories = const [];
  late String _type = widget.data?.product.type ?? 'general';
  late String _status = widget.data?.product.status ?? 'active';
  late String? _categoryId = widget.data?.product.categoryId;
  bool _saving = false;
  String? _error;

  bool get _editing => widget.data != null;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final values = await widget.repository.categories();
      if (mounted) setState(() => _categories = values);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final price = int.parse(_price.text.trim());
      final id = widget.data?.product.id;
      if (id == null) {
        final createdId = await widget.repository.createProduct(
          name: _name.text.trim(),
          sku: _sku.text.trim(),
          type: _type,
          price: price,
          categoryId: _categoryId,
        );
        if (mounted) Navigator.of(context).pop(createdId);
      } else {
        await widget.repository.updateProduct(
          id: id,
          name: _name.text.trim(),
          type: _type,
          price: price,
          status: _status,
          categoryId: _categoryId,
        );
        if (mounted) Navigator.of(context).pop(id);
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(_editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm')),
    body: Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Tên sản phẩm *'),
            validator: (value) => value == null || value.trim().isEmpty
                ? 'Nhập tên sản phẩm'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _sku,
            enabled: !_editing,
            decoration: const InputDecoration(
              labelText: 'SKU',
              helperText: 'Để trống để hệ thống tự tạo',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: const InputDecoration(labelText: 'Loại sản phẩm'),
            items:
                const {
                      'general': 'Thông thường',
                      'gold': 'Vàng',
                      'silver': 'Bạc',
                      'fashion': 'Thời trang',
                      'phone': 'Điện thoại',
                      'food': 'Thực phẩm',
                      'hotel': 'Khách sạn',
                      'service': 'Dịch vụ',
                    }.entries
                    .map(
                      (item) => DropdownMenuItem(
                        value: item.key,
                        child: Text(item.value),
                      ),
                    )
                    .toList(),
            onChanged: (value) => setState(() => _type = value!),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _price,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Giá bán (VND) *'),
            validator: (value) {
              final parsed = int.tryParse(value?.trim() ?? '');
              return parsed == null || parsed < 0
                  ? 'Giá phải là số nguyên không âm'
                  : null;
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _categoryId,
            decoration: const InputDecoration(labelText: 'Danh mục'),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Chưa phân loại'),
              ),
              ..._categories.map(
                (item) => DropdownMenuItem<String?>(
                  value: item.id,
                  child: Text(item.name),
                ),
              ),
            ],
            onChanged: (value) => setState(() => _categoryId = value),
          ),
          if (_editing) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(labelText: 'Trạng thái'),
              items: const [
                DropdownMenuItem(value: 'active', child: Text('Đang bán')),
                DropdownMenuItem(value: 'inactive', child: Text('Ngừng bán')),
              ],
              onChanged: (value) => setState(() => _status = value!),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(_editing ? 'Lưu thay đổi' : 'Tạo sản phẩm'),
          ),
        ],
      ),
    ),
  );
}
