import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_error.dart';
import '../orders/order_models.dart';
import '../orders/barcode_scanner_page.dart';
import 'product_form_page.dart';
import 'product_models.dart';
import 'product_repository.dart';

class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.repository,
    required this.productId,
  });

  final ProductRepository repository;
  final String productId;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  ProductDetailData? _data;
  String? _error;
  bool _uploading = false;
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await widget.repository.detail(widget.productId);
      if (mounted) {
        setState(() {
          _data = data;
          _error = null;
        });
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _pickAndUpload(ImageSource source) async {
    final file = await _picker.pickImage(
      source: source,
      imageQuality: 88,
      maxWidth: 1800,
    );
    if (file == null || !mounted) return;
    final mimeType = file.mimeType ?? _mimeFromName(file.name);
    if (mimeType == null) {
      setState(() => _error = 'Ảnh phải là JPEG, PNG hoặc WebP');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      await widget.repository.uploadImage(
        productId: widget.productId,
        filePath: file.path,
        filename: file.name,
        mimeType: mimeType,
        primary: _data?.images.isEmpty ?? true,
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã tải ảnh sản phẩm lên')),
        );
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _editProduct() async {
    final data = _data;
    if (data == null) return;
    final changed = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) =>
            ProductFormPage(repository: widget.repository, data: data),
      ),
    );
    if (changed != null) await _load();
  }

  Future<void> _deleteImage(ProductImage image) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa ảnh?'),
        content: const Text('Ảnh sẽ bị xóa khỏi sản phẩm và kho lưu trữ.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.repository.deleteImage(widget.productId, image.id);
      await _load();
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _editVariant(ProductVariant variant) async {
    final sku = TextEditingController(text: variant.sku);
    final barcode = TextEditingController(text: variant.barcode);
    final price = TextEditingController(text: '${variant.price}');
    final stock = TextEditingController(text: '${variant.stock}');
    String? dialogError;
    var saving = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Sửa biến thể'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: sku,
                  decoration: const InputDecoration(labelText: 'SKU'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: barcode,
                  decoration: InputDecoration(
                    labelText: 'Barcode',
                    suffixIcon: IconButton(
                      tooltip: 'Quét barcode',
                      icon: const Icon(Icons.qr_code_scanner),
                      onPressed: () async {
                        final value = await Navigator.of(context).push<String>(
                          MaterialPageRoute(
                            builder: (_) => const BarcodeScannerPage(),
                          ),
                        );
                        if (value != null) barcode.text = value;
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: price,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Giá (VND)'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: stock,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Tồn kho thực tế',
                  ),
                ),
                if (dialogError != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    dialogError!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialogContext),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      final parsedPrice = int.tryParse(price.text.trim());
                      final parsedStock = int.tryParse(stock.text.trim());
                      if (sku.text.trim().isEmpty ||
                          parsedPrice == null ||
                          parsedPrice < 0 ||
                          parsedStock == null ||
                          parsedStock < 0) {
                        setDialogState(
                          () => dialogError = 'Kiểm tra SKU, giá và tồn kho',
                        );
                        return;
                      }
                      setDialogState(() {
                        saving = true;
                        dialogError = null;
                      });
                      try {
                        await widget.repository.updateVariant(
                          id: variant.id,
                          sku: sku.text.trim(),
                          barcode: barcode.text.trim(),
                          price: parsedPrice,
                        );
                        if (parsedStock != variant.stock) {
                          await widget.repository.adjustStock(
                            variantId: variant.id,
                            qty: parsedStock,
                          );
                        }
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } on ApiError catch (error) {
                        if (dialogContext.mounted) {
                          setDialogState(() {
                            saving = false;
                            dialogError = error.message;
                          });
                        }
                      }
                    },
              child: saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Lưu'),
            ),
          ],
        ),
      ),
    );
    sku.dispose();
    barcode.dispose();
    price.dispose();
    stock.dispose();
    await _load();
  }

  String? _mimeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      appBar: AppBar(
        title: Text(data?.product.name ?? 'Chi tiết sản phẩm'),
        actions: [
          IconButton(
            onPressed: data == null ? null : _editProduct,
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      body: _error != null && data == null
          ? Center(child: Text(_error!))
          : data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (data.images.isNotEmpty) ...[
                    SizedBox(
                      height: 190,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: data.images.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 10),
                        itemBuilder: (_, index) {
                          final image = data.images[index];
                          return ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Stack(
                              children: [
                                Image.network(
                                  image.url,
                                  width: 190,
                                  height: 190,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) => const SizedBox(
                                    width: 190,
                                    child: Center(
                                      child: Icon(Icons.broken_image_outlined),
                                    ),
                                  ),
                                ),
                                if (image.isPrimary)
                                  const Positioned(
                                    left: 8,
                                    top: 8,
                                    child: Chip(label: Text('Ảnh chính')),
                                  ),
                                Positioned(
                                  right: 6,
                                  top: 6,
                                  child: IconButton.filledTonal(
                                    tooltip: 'Xóa ảnh',
                                    onPressed: () => _deleteImage(image),
                                    icon: const Icon(Icons.delete_outline),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _uploading
                              ? null
                              : () => _pickAndUpload(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera_outlined),
                          label: const Text('Chụp ảnh'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _uploading
                              ? null
                              : () => _pickAndUpload(ImageSource.gallery),
                          icon: _uploading
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.photo_library_outlined),
                          label: const Text('Thư viện'),
                        ),
                      ),
                    ],
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    data.product.name,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Text('${data.product.sku} · ${_type(data.product.type)}'),
                  const Divider(height: 32),
                  Text(
                    'Biến thể',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  ...data.variants.map(
                    (variant) => _VariantCard(
                      variant: variant,
                      onTap: () => _editVariant(variant),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  String _type(String value) =>
      const {
        'gold': 'Vàng',
        'silver': 'Bạc',
        'general': 'Thông thường',
        'fashion': 'Thời trang',
        'service': 'Dịch vụ',
      }[value] ??
      value;
}

class _VariantCard extends StatelessWidget {
  const _VariantCard({required this.variant, required this.onTap});
  final ProductVariant variant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final specs = <String>[
      if (variant.goldTypeName != null) 'Loại vàng: ${variant.goldTypeName}',
      if (variant.goldGross != null) 'TL tổng: ${variant.goldGross}',
      if (variant.goldStone != null) 'TL đá: ${variant.goldStone}',
      if (variant.goldNet != null) 'TL vàng: ${variant.goldNet}',
      if (variant.silverPurity != null) 'Tuổi bạc: ${variant.silverPurity}',
      if (variant.silverGross != null) 'TL tổng: ${variant.silverGross}',
      if (variant.silverStone != null) 'TL đá: ${variant.silverStone}',
      if (variant.silverNet != null) 'TL bạc: ${variant.silverNet}',
    ];
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      variant.sku,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(formatVnd(variant.price)),
                ],
              ),
              const SizedBox(height: 6),
              Text('Tồn kho: ${variant.stock}'),
              if (variant.barcode?.isNotEmpty == true)
                Text('Barcode: ${variant.barcode}'),
              if (specs.isNotEmpty) ...[
                const Divider(),
                ...specs.map(
                  (value) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(value),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
