import '../orders/order_models.dart';

class ProductSummary {
  const ProductSummary({
    required this.id,
    required this.sku,
    required this.name,
    required this.type,
    required this.price,
    required this.stock,
    this.categoryName,
    this.categoryId,
    this.status = 'active',
    this.primaryImageUrl,
  });

  factory ProductSummary.fromJson(Map<String, dynamic> json) => ProductSummary(
    id: '${json['id']}',
    sku: '${json['sku']}',
    name: '${json['name']}',
    type: '${json['product_type']}',
    price: parseVnd(json['base_price']),
    stock: int.tryParse('${json['total_stock'] ?? 0}') ?? 0,
    categoryName: json['category_name'] as String?,
    categoryId: json['category_id'] as String?,
    status: '${json['status'] ?? 'active'}',
    primaryImageUrl: json['primary_image_url'] as String?,
  );

  final String id;
  final String sku;
  final String name;
  final String type;
  final int price;
  final int stock;
  final String? categoryName;
  final String? categoryId;
  final String status;
  final String? primaryImageUrl;
}

class ProductPageData {
  const ProductPageData({required this.products, required this.hasMore});
  final List<ProductSummary> products;
  final bool hasMore;
}

class ProductDetailData {
  const ProductDetailData({
    required this.product,
    required this.variants,
    this.images = const [],
  });

  factory ProductDetailData.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>;
    return ProductDetailData(
      product: ProductSummary.fromJson({...product, 'total_stock': 0}),
      variants: (json['variants'] as List<dynamic>? ?? const [])
          .map((row) => ProductVariant.fromJson(row as Map<String, dynamic>))
          .toList(),
    );
  }

  final ProductSummary product;
  final List<ProductVariant> variants;
  final List<ProductImage> images;

  ProductDetailData copyWith({List<ProductImage>? images}) => ProductDetailData(
    product: product,
    variants: variants,
    images: images ?? this.images,
  );
}

class ProductImage {
  const ProductImage({
    required this.id,
    required this.url,
    required this.isPrimary,
  });

  factory ProductImage.fromJson(Map<String, dynamic> json) => ProductImage(
    id: '${json['id']}',
    url: '${json['image_url']}',
    isPrimary: json['is_primary'] == true,
  );

  final String id;
  final String url;
  final bool isPrimary;
}

class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.sku,
    required this.price,
    required this.stock,
    this.barcode,
    this.goldTypeName,
    this.goldGross,
    this.goldStone,
    this.goldNet,
    this.silverPurity,
    this.silverGross,
    this.silverStone,
    this.silverNet,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) => ProductVariant(
    id: '${json['id']}',
    sku: '${json['sku']}',
    price: parseVnd(json['price']),
    stock: int.tryParse('${json['stock_qty'] ?? 0}') ?? 0,
    barcode: json['barcode'] as String?,
    goldTypeName: _decimal(json['gold_type_name']),
    goldGross: _decimal(json['gold_gross']),
    goldStone: _decimal(json['gold_stone']),
    goldNet: _decimal(json['gold_net']),
    silverPurity: _decimal(json['silver_purity']),
    silverGross: _decimal(json['silver_gross']),
    silverStone: _decimal(json['silver_stone']),
    silverNet: _decimal(json['silver_net']),
  );

  static String? _decimal(Object? value) => value == null ? null : '$value';

  final String id;
  final String sku;
  final int price;
  final int stock;
  final String? barcode;
  final String? goldTypeName;
  final String? goldGross;
  final String? goldStone;
  final String? goldNet;
  final String? silverPurity;
  final String? silverGross;
  final String? silverStone;
  final String? silverNet;
}

class ProductCategory {
  const ProductCategory({required this.id, required this.name});

  factory ProductCategory.fromJson(Map<String, dynamic> json) =>
      ProductCategory(id: '${json['id']}', name: '${json['name']}');

  final String id;
  final String name;
}
