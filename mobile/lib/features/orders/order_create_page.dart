import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_error.dart';
import '../customers/customer_list_page.dart';
import '../customers/customer_models.dart';
import 'barcode_scanner_page.dart';
import 'order_models.dart';
import 'order_repository.dart';

class OrderCreatePage extends StatefulWidget {
  const OrderCreatePage({super.key, required this.repository});
  final OrderRepository repository;

  @override
  State<OrderCreatePage> createState() => _OrderCreatePageState();
}

class _OrderCreatePageState extends State<OrderCreatePage> {
  final _quantity = TextEditingController(text: '1');
  final _price = TextEditingController();
  final _notes = TextEditingController();
  final _productSearch = TextEditingController();
  List<ProductChoice>? _products;
  List<VariantChoice> _variants = const [];
  final List<_CartLine> _cart = [];
  ProductChoice? _product;
  VariantChoice? _variant;
  CustomerSummary? _customer;
  bool _loadingVariants = false;
  bool _saving = false;
  bool _recognizing = false;
  String? _error;
  final _imagePicker = ImagePicker();

  int get _total => _cart.fold(0, (sum, line) => sum + line.total);

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _quantity.dispose();
    _price.dispose();
    _notes.dispose();
    _productSearch.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      final products = await widget.repository.products();
      if (mounted) setState(() => _products = products);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _selectProduct(ProductChoice? product) async {
    setState(() {
      _product = product;
      _variant = null;
      _variants = const [];
      _loadingVariants = product != null;
      _error = null;
    });
    if (product == null) return;
    try {
      final variants = await widget.repository.variants(product.id);
      if (!mounted || _product?.id != product.id) return;
      setState(() {
        _variants = variants;
        _loadingVariants = false;
        if (variants.length == 1) _setVariant(variants.first);
      });
    } on ApiError catch (error) {
      if (mounted) {
        setState(() {
          _loadingVariants = false;
          _error = error.message;
        });
      }
    }
  }

  Future<void> _searchProducts([String? value]) async {
    final search = (value ?? _productSearch.text).trim();
    try {
      final products = await widget.repository.products(search: search);
      if (!mounted) return;
      setState(() {
        _products = products;
        _product = null;
        _variant = null;
        _variants = const [];
        _error = products.isEmpty ? 'Không tìm thấy sản phẩm' : null;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _scanBarcode() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeScannerPage()),
    );
    if (code == null || !mounted) return;
    _productSearch.text = code;
    try {
      final products = await widget.repository.products(search: code);
      if (!mounted) return;
      if (products.isEmpty) {
        setState(() => _error = 'Không tìm thấy sản phẩm có mã $code');
        return;
      }
      final product = products.firstWhere(
        (item) => item.sku.toLowerCase() == code.toLowerCase(),
        orElse: () => products.first,
      );
      setState(() => _products = products);
      await _selectProduct(product);
      if (!mounted) return;
      final matches = _variants.where(
        (item) =>
            item.sku.toLowerCase() == code.toLowerCase() ||
            item.barcode?.toLowerCase() == code.toLowerCase(),
      );
      setState(() {
        if (matches.isNotEmpty) _setVariant(matches.first);
        _error = null;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _recognizeProduct() async {
    final image = await _imagePicker.pickImage(
      source: ImageSource.camera,
      imageQuality: 88,
      maxWidth: 1800,
    );
    if (image == null || !mounted) return;
    final mimeType = image.mimeType ?? _mimeFromName(image.name);
    if (mimeType == null) {
      setState(() => _error = 'Ảnh phải là JPEG, PNG hoặc WebP');
      return;
    }
    setState(() {
      _recognizing = true;
      _error = null;
    });
    try {
      final candidates = await widget.repository.recognizeProduct(
        filePath: image.path,
        filename: image.name,
        mimeType: mimeType,
      );
      if (!mounted) return;
      if (candidates.isEmpty) {
        setState(() => _error = 'Không tìm thấy sản phẩm tương tự');
        return;
      }
      final selected = await showModalBottomSheet<ProductChoice>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.only(bottom: 12),
            children: [
              const ListTile(title: Text('Chọn sản phẩm phù hợp')),
              ...candidates.map(
                (candidate) => ListTile(
                  leading: candidate.product.primaryImageUrl == null
                      ? const CircleAvatar(
                          child: Icon(Icons.inventory_2_outlined),
                        )
                      : CircleAvatar(
                          backgroundImage: NetworkImage(
                            candidate.product.primaryImageUrl!,
                          ),
                        ),
                  title: Text(candidate.product.name),
                  subtitle: Text(
                    '${candidate.product.sku} · tương đồng ${(candidate.score * 100).round()}%',
                  ),
                  onTap: () => Navigator.pop(context, candidate.product),
                ),
              ),
            ],
          ),
        ),
      );
      if (selected != null && mounted) {
        setState(() {
          _products = [
            selected,
            ...?_products?.where((p) => p.id != selected.id),
          ];
          _productSearch.text = selected.name;
        });
        await _selectProduct(selected);
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _recognizing = false);
    }
  }

  String? _mimeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return null;
  }

  void _setVariant(VariantChoice? variant) {
    _variant = variant;
    if (variant != null) _price.text = '${variant.price}';
  }

  void _addToCart() {
    final product = _product;
    final variant = _variant;
    final quantity = int.tryParse(_quantity.text) ?? 0;
    final price = int.tryParse(_price.text) ?? -1;
    if (product == null || variant == null) {
      setState(() => _error = 'Vui lòng chọn sản phẩm và biến thể');
      return;
    }
    if (quantity <= 0 || price < 0) {
      setState(() => _error = 'Số lượng hoặc đơn giá không hợp lệ');
      return;
    }

    final existingIndex = _cart.indexWhere(
      (line) => line.variant.id == variant.id && line.unitPrice == price,
    );
    final quantityInCart = _cart
        .where((line) => line.variant.id == variant.id)
        .fold(0, (sum, line) => sum + line.quantity);
    if (quantityInCart + quantity > variant.stock) {
      setState(
        () => _error =
            'Không đủ tồn kho. ${variant.sku} chỉ còn ${variant.stock}',
      );
      return;
    }

    setState(() {
      if (existingIndex >= 0) {
        final line = _cart[existingIndex];
        _cart[existingIndex] = line.copyWith(
          quantity: line.quantity + quantity,
        );
      } else {
        _cart.add(
          _CartLine(
            product: product,
            variant: variant,
            quantity: quantity,
            unitPrice: price,
          ),
        );
      }
      _quantity.text = '1';
      _error = null;
    });
  }

  void _changeQuantity(int index, int delta) {
    final line = _cart[index];
    final next = line.quantity + delta;
    if (next <= 0) {
      setState(() => _cart.removeAt(index));
      return;
    }
    final otherQuantity = _cart
        .where((item) => item.variant.id == line.variant.id && item != line)
        .fold(0, (sum, item) => sum + item.quantity);
    if (otherQuantity + next > line.variant.stock) {
      setState(
        () => _error =
            'Không đủ tồn kho. ${line.variant.sku} chỉ còn ${line.variant.stock}',
      );
      return;
    }
    setState(() {
      _cart[index] = line.copyWith(quantity: next);
      _error = null;
    });
  }

  Future<void> _save() async {
    if (_cart.isEmpty) {
      setState(() => _error = 'Vui lòng thêm ít nhất một sản phẩm');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await widget.repository.create(
        customerId: _customer?.id,
        items: _cart
            .map(
              (line) => OrderCreateItem(
                variantId: line.variant.id,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
              ),
            )
            .toList(),
        notes: _notes.text,
      );
      if (mounted) Navigator.of(context).pop(result);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tạo đơn hàng')),
      body: _products == null && _error == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _customerTile(),
                const Divider(height: 32),
                Text(
                  'Thêm sản phẩm',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _productSearch,
                  textInputAction: TextInputAction.search,
                  onSubmitted: _searchProducts,
                  decoration: InputDecoration(
                    labelText: 'Tìm tên, SKU hoặc barcode',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      tooltip: 'Quét barcode',
                      onPressed: _scanBarcode,
                      icon: const Icon(Icons.qr_code_scanner),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _recognizing ? null : _recognizeProduct,
                  icon: _recognizing
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.camera_alt_outlined),
                  label: Text(
                    _recognizing
                        ? 'Đang nhận dạng...'
                        : 'Chụp ảnh để tìm sản phẩm',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<ProductChoice>(
                  key: ValueKey('${_products?.length}-${_product?.id}'),
                  initialValue: _product,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Sản phẩm'),
                  items: (_products ?? const [])
                      .map(
                        (product) => DropdownMenuItem(
                          value: product,
                          child: Text(
                            product.name,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _selectProduct,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<VariantChoice>(
                  key: ValueKey('${_product?.id}-${_variant?.id}'),
                  initialValue: _variant,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'Biến thể / SKU',
                    suffixIcon: _loadingVariants
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : null,
                  ),
                  items: _variants
                      .map(
                        (variant) => DropdownMenuItem(
                          value: variant,
                          child: Text('${variant.sku} · tồn ${variant.stock}'),
                        ),
                      )
                      .toList(),
                  onChanged: _loadingVariants
                      ? null
                      : (value) => setState(() => _setVariant(value)),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _quantity,
                        decoration: const InputDecoration(
                          labelText: 'Số lượng',
                        ),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _price,
                        decoration: const InputDecoration(
                          labelText: 'Đơn giá (VND)',
                        ),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loadingVariants ? null : _addToCart,
                  icon: const Icon(Icons.add_shopping_cart),
                  label: const Text('Thêm vào đơn'),
                ),
                const Divider(height: 32),
                Text(
                  'Giỏ hàng (${_cart.length})',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (_cart.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Text('Chưa có sản phẩm nào.'),
                  )
                else
                  ...List.generate(_cart.length, _cartTile),
                TextFormField(
                  controller: _notes,
                  decoration: const InputDecoration(labelText: 'Ghi chú'),
                  maxLines: 2,
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tổng cộng'),
                    Text(
                      formatVnd(_total),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check),
                  label: const Text('Tạo đơn'),
                ),
              ],
            ),
    );
  }

  Widget _customerTile() => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: const Icon(Icons.person_outline),
    title: Text(_customer?.name ?? 'Khách lẻ'),
    subtitle: Text(_customer?.phone ?? 'Chạm để chọn khách hàng'),
    trailing: _customer == null
        ? const Icon(Icons.chevron_right)
        : IconButton(
            tooltip: 'Bỏ chọn',
            onPressed: () => setState(() => _customer = null),
            icon: const Icon(Icons.close),
          ),
    onTap: () async {
      final customer = await Navigator.of(context).push<CustomerSummary>(
        MaterialPageRoute(
          builder: (_) =>
              CustomerListPage(api: widget.repository.api, selectionMode: true),
        ),
      );
      if (customer != null && mounted) setState(() => _customer = customer);
    },
  );

  Widget _cartTile(int index) {
    final line = _cart[index];
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text('${line.variant.sku} · ${formatVnd(line.unitPrice)}'),
                  Text('Thành tiền: ${formatVnd(line.total)}'),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Giảm',
              onPressed: () => _changeQuantity(index, -1),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('${line.quantity}'),
            IconButton(
              tooltip: 'Tăng',
              onPressed: () => _changeQuantity(index, 1),
              icon: const Icon(Icons.add_circle_outline),
            ),
            IconButton(
              tooltip: 'Xóa',
              onPressed: () => setState(() => _cart.removeAt(index)),
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartLine {
  const _CartLine({
    required this.product,
    required this.variant,
    required this.quantity,
    required this.unitPrice,
  });

  final ProductChoice product;
  final VariantChoice variant;
  final int quantity;
  final int unitPrice;

  int get total => quantity * unitPrice;

  _CartLine copyWith({int? quantity}) => _CartLine(
    product: product,
    variant: variant,
    quantity: quantity ?? this.quantity,
    unitPrice: unitPrice,
  );
}
