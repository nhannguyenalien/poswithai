import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../orders/order_models.dart';
import 'product_detail_page.dart';
import 'product_form_page.dart';
import 'product_models.dart';
import 'product_repository.dart';

class ProductListPage extends StatefulWidget {
  const ProductListPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<ProductListPage> createState() => _ProductListPageState();
}

class _ProductListPageState extends State<ProductListPage> {
  late final ProductRepository _repository = ProductRepository(widget.api);
  final _search = TextEditingController();
  final _products = <ProductSummary>[];
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
        offset: reset ? 0 : _products.length,
        search: _search.text,
      );
      if (!mounted) return;
      setState(() {
        if (reset) _products.clear();
        _products.addAll(page.products);
        _hasMore = page.hasMore;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final id = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => ProductFormPage(repository: _repository),
      ),
    );
    if (id == null || !mounted) return;
    await _load(reset: true);
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            ProductDetailPage(repository: _repository, productId: id),
      ),
    );
    await _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sản phẩm & tồn kho')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('Sản phẩm'),
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
                labelText: 'Tìm tên hoặc SKU',
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
            ..._products.map(
              (product) => Card(
                child: ListTile(
                  leading: product.primaryImageUrl == null
                      ? const CircleAvatar(
                          child: Icon(Icons.inventory_2_outlined),
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Image.network(
                            product.primaryImageUrl!,
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const CircleAvatar(
                              child: Icon(Icons.broken_image_outlined),
                            ),
                          ),
                        ),
                  title: Text(product.name),
                  subtitle: Text('${product.sku} · Tồn ${product.stock}'),
                  trailing: Text(formatVnd(product.price)),
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ProductDetailPage(
                          repository: _repository,
                          productId: product.id,
                        ),
                      ),
                    );
                    await _load(reset: true);
                  },
                ),
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (!_loading && _hasMore && _products.isNotEmpty)
              TextButton(onPressed: _load, child: const Text('Tải thêm')),
            if (!_loading && _products.isEmpty && _error == null)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: Text('Chưa có sản phẩm')),
              ),
          ],
        ),
      ),
    );
  }
}
