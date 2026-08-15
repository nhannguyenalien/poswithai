import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pos_mobile/core/api/api_client.dart';
import 'package:pos_mobile/core/api/api_error.dart';
import 'package:pos_mobile/core/config/app_config.dart';
import 'package:pos_mobile/core/storage/token_store.dart';

class _MemoryTokenStore implements TokenStore {
  String? accessToken;
  String? refreshToken;

  @override
  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
  }

  @override
  Future<String?> readAccessToken() async => accessToken;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

void main() {
  test('API error follows normalized contract', () {
    final error = ApiError.fromJson(
      {
        'code': 'INSUFFICIENT_STOCK',
        'message': 'Không đủ tồn kho',
        'details': {'available': 1},
      },
      statusCode: 409,
      requestId: 'request-123',
    );

    expect(error.code, 'INSUFFICIENT_STOCK');
    expect(error.message, 'Không đủ tồn kho');
    expect(error.details, {'available': 1});
    expect(error.statusCode, 409);
    expect(error.requestId, 'request-123');
  });

  test('default API URL includes the API prefix', () {
    expect(AppConfig.apiBaseUri.path, '/api');
  });

  test('idempotent write reuses its key after a network failure', () async {
    var calls = 0;
    final keys = <String?>[];
    final client = MockClient((request) async {
      calls++;
      keys.add(request.headers['idempotency-key']);
      if (calls == 1) throw http.ClientException('connection reset');
      return http.Response('{"order_id":"order-1"}', 201);
    });
    final api = ApiClient(
      baseUri: Uri.parse('https://example.test/api'),
      tokenStore: _MemoryTokenStore(),
      httpClient: client,
    );

    final result = await api.postJson('/orders', {
      'items': [
        {'product_variant_id': 'variant-1', 'quantity': 1, 'unit_price': 100},
      ],
    }, idempotent: true);

    expect(result['order_id'], 'order-1');
    expect(calls, 2);
    expect(keys.first, isNotEmpty);
    expect(keys.last, keys.first);
  });
}
