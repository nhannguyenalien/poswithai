import '../../core/api/api_client.dart';
import 'product_models.dart';

class ProductRepository {
  const ProductRepository(this.api);
  final ApiClient api;

  Future<ProductPageData> list({
    int offset = 0,
    int limit = 20,
    String search = '',
  }) async {
    final json = await api.getJson(
      '/products',
      query: {
        'offset': offset,
        'limit': limit,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    final rows = json['products'] as List<dynamic>? ?? const [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    return ProductPageData(
      products: rows
          .map((row) => ProductSummary.fromJson(row as Map<String, dynamic>))
          .toList(),
      hasMore: pagination['has_more'] == true,
    );
  }

  Future<ProductDetailData> detail(String id) async {
    final responses = await Future.wait([
      api.getJson('/products/$id'),
      api.getJson('/products/$id/images'),
    ]);
    final detail = ProductDetailData.fromJson(responses[0]);
    final images = (responses[1]['images'] as List<dynamic>? ?? const [])
        .map((row) => ProductImage.fromJson(row as Map<String, dynamic>))
        .toList();
    return detail.copyWith(images: images);
  }

  Future<ProductImage> uploadImage({
    required String productId,
    required String filePath,
    required String filename,
    required String mimeType,
    bool primary = false,
  }) async {
    final json = await api.postMultipart(
      '/products/$productId/images',
      field: 'image',
      filePath: filePath,
      filename: filename,
      mimeType: mimeType,
      fields: {'is_primary': '$primary'},
    );
    return ProductImage.fromJson(json);
  }

  Future<List<ProductCategory>> categories() async {
    final json = await api.getJson('/categories');
    return (json['categories'] as List<dynamic>? ?? const [])
        .map((row) => ProductCategory.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  Future<String> createProduct({
    required String name,
    required String sku,
    required String type,
    required int price,
    String? categoryId,
  }) async {
    final json = await api.postJson('/products', {
      'name': name,
      if (sku.isNotEmpty) 'sku': sku,
      'product_type': type,
      'base_price': price,
      'category_id': ?categoryId,
    });
    return '${json['id']}';
  }

  Future<void> updateProduct({
    required String id,
    required String name,
    required String type,
    required int price,
    required String status,
    String? categoryId,
  }) async {
    await api.putJson('/products/$id', {
      'name': name,
      'product_type': type,
      'base_price': price,
      'status': status,
      'category_id': ?categoryId,
    });
  }

  Future<void> updateVariant({
    required String id,
    required String sku,
    required String barcode,
    required int price,
  }) => api.putJson('/variants/$id', {
    'sku': sku,
    'barcode': barcode,
    'price': price,
  });

  Future<void> adjustStock({required String variantId, required int qty}) =>
      api.postJson('/inventory', {
        'product_variant_id': variantId,
        'type': 'ADJUST',
        'quantity': qty,
        'reason': 'Điều chỉnh từ ứng dụng mobile',
      });

  Future<void> deleteImage(String productId, String imageId) =>
      api.deleteJson('/products/$productId/images/$imageId');
}
