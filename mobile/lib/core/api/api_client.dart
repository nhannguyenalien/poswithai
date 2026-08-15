import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:uuid/uuid.dart';

import '../storage/token_store.dart';
import 'api_error.dart';

class ApiClient {
  ApiClient({
    required this.baseUri,
    required this.tokenStore,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  final Uri baseUri;
  final TokenStore tokenStore;
  final http.Client _http;
  static const _timeout = Duration(seconds: 10);
  static const _uploadTimeout = Duration(seconds: 30);
  static const _uuid = Uuid();
  Future<bool>? _refreshing;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    return _sendJson('GET', path, query: query, safeRetries: 2);
  }

  Future<Map<String, dynamic>> postJson(
    String path,
    Map<String, dynamic> body, {
    bool idempotent = false,
    String? idempotencyKey,
    bool authenticated = true,
    String? bearerToken,
  }) {
    return _sendJson(
      'POST',
      path,
      body: body,
      authenticated: authenticated,
      bearerToken: bearerToken,
      idempotencyKey: idempotent ? (idempotencyKey ?? _uuid.v4()) : null,
      safeRetries: idempotent ? 1 : 0,
    );
  }

  Future<Map<String, dynamic>> putJson(
    String path,
    Map<String, dynamic> body,
  ) => _sendJson('PUT', path, body: body);

  Future<Map<String, dynamic>> deleteJson(String path) =>
      _sendJson('DELETE', path);

  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required String field,
    required String filePath,
    required String filename,
    required String mimeType,
    Map<String, String> fields = const {},
    bool allowRefresh = true,
  }) async {
    final headers = <String, String>{
      'accept': 'application/json',
      'x-request-id': _uuid.v4(),
    };
    final token = await tokenStore.readAccessToken();
    if (token != null) headers['authorization'] = 'Bearer $token';
    final request = http.MultipartRequest('POST', _uri(path, null))
      ..headers.addAll(headers)
      ..fields.addAll(fields)
      ..files.add(
        await http.MultipartFile.fromPath(
          field,
          filePath,
          filename: filename,
          contentType: MediaType.parse(mimeType),
        ),
      );
    try {
      final streamed = await _http.send(request).timeout(_uploadTimeout);
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode == 401 &&
          allowRefresh &&
          await _refreshSession()) {
        return await postMultipart(
          path,
          field: field,
          filePath: filePath,
          filename: filename,
          mimeType: mimeType,
          fields: fields,
          allowRefresh: false,
        );
      }
      return _decode(response);
    } on TimeoutException catch (error) {
      throw ApiError(
        code: 'NETWORK_ERROR',
        message: 'Tải ảnh quá thời gian. Vui lòng kiểm tra mạng và thử lại.',
        details: error.toString(),
      );
    } on http.ClientException catch (error) {
      throw ApiError(
        code: 'NETWORK_ERROR',
        message: 'Không thể tải ảnh lên máy chủ.',
        details: error.toString(),
      );
    }
  }

  Future<Map<String, dynamic>> _sendJson(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, dynamic>? query,
    String? idempotencyKey,
    bool authenticated = true,
    String? bearerToken,
    int safeRetries = 0,
    bool allowRefresh = true,
  }) async {
    final uri = _uri(path, query);
    Object? lastFailure;
    for (var attempt = 0; attempt <= safeRetries; attempt++) {
      try {
        final headers = <String, String>{
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-request-id': _uuid.v4(),
          'idempotency-key': ?idempotencyKey,
        };
        if (bearerToken != null) {
          headers['authorization'] = 'Bearer $bearerToken';
        } else if (authenticated) {
          final token = await tokenStore.readAccessToken();
          if (token != null) headers['authorization'] = 'Bearer $token';
        }
        final request = http.Request(method, uri)..headers.addAll(headers);
        if (body != null) request.body = jsonEncode(body);
        final streamed = await _http.send(request).timeout(_timeout);
        final response = await http.Response.fromStream(streamed);

        if (response.statusCode == 401 && authenticated && allowRefresh) {
          if (await _refreshSession()) {
            return await _sendJson(
              method,
              path,
              body: body,
              query: query,
              idempotencyKey: idempotencyKey,
              authenticated: authenticated,
              bearerToken: bearerToken,
              safeRetries: safeRetries,
              allowRefresh: false,
            );
          }
        }
        return _decode(response);
      } on TimeoutException catch (error) {
        lastFailure = error;
      } on http.ClientException catch (error) {
        lastFailure = error;
      }
      if (attempt < safeRetries) {
        await Future<void>.delayed(Duration(milliseconds: 250 * (attempt + 1)));
      }
    }
    throw ApiError(
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.',
      details: lastFailure.toString(),
    );
  }

  Future<bool> _refreshSession() =>
      _refreshing ??= _doRefresh().whenComplete(() {
        _refreshing = null;
      });

  Future<bool> _doRefresh() async {
    final refreshToken = await tokenStore.readRefreshToken();
    if (refreshToken == null) return false;
    try {
      final session = await _sendJson(
        'POST',
        '/auth/refresh',
        body: {'refresh_token': refreshToken},
        authenticated: false,
        allowRefresh: false,
      );
      await tokenStore.save(
        accessToken: session['access_token'] as String,
        refreshToken: session['refresh_token'] as String,
      );
      return true;
    } catch (_) {
      await tokenStore.clear();
      return false;
    }
  }

  Uri _uri(String path, Map<String, dynamic>? query) {
    final basePath = baseUri.path.replaceFirst(RegExp(r'/$'), '');
    final childPath = path.startsWith('/') ? path : '/$path';
    return baseUri.replace(
      path: '$basePath$childPath',
      queryParameters: query?.map((key, value) => MapEntry(key, '$value')),
    );
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> data = const {};
    if (response.body.isNotEmpty) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) data = decoded;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiError.fromJson(
        data,
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }
    return data;
  }

  void close() => _http.close();
}
