import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

class WindowsGoogleOAuth {
  const WindowsGoogleOAuth();

  Future<String> authenticate({required String clientId}) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final redirectUri = 'http://127.0.0.1:${server.port}';
    final verifier = _randomUrlSafe(64);
    final challenge = base64Url
        .encode(sha256.convert(ascii.encode(verifier)).bytes)
        .replaceAll('=', '');
    final state = _randomUrlSafe(32);
    final authorizationUri =
        Uri.https('accounts.google.com', '/o/oauth2/v2/auth', {
          'client_id': clientId,
          'redirect_uri': redirectUri,
          'response_type': 'code',
          'scope': 'openid email profile',
          'code_challenge': challenge,
          'code_challenge_method': 'S256',
          'state': state,
          'access_type': 'offline',
          'prompt': 'select_account',
        });

    try {
      if (!await launchUrl(
        authorizationUri,
        mode: LaunchMode.externalApplication,
      )) {
        throw const WindowsGoogleOAuthException(
          'Không thể mở trình duyệt đăng nhập Google.',
        );
      }
      final request = await server.first.timeout(const Duration(minutes: 3));
      final query = request.uri.queryParameters;
      request.response
        ..statusCode = HttpStatus.ok
        ..headers.contentType = ContentType.html
        ..write(
          '<!doctype html><meta charset="utf-8"><title>SpaceHuge POS</title>'
          '<p>Đăng nhập thành công. Bạn có thể đóng cửa sổ này và quay lại ứng dụng.</p>',
        );
      await request.response.close();

      if (query['state'] != state) {
        throw const WindowsGoogleOAuthException(
          'Phiên đăng nhập Google không hợp lệ.',
        );
      }
      if (query['error'] != null) {
        throw WindowsGoogleOAuthException(
          query['error_description'] ?? 'Google đã từ chối đăng nhập.',
        );
      }
      final code = query['code'];
      if (code == null || code.isEmpty) {
        throw const WindowsGoogleOAuthException(
          'Google không trả về mã đăng nhập.',
        );
      }

      final response = await http
          .post(
            Uri.https('oauth2.googleapis.com', '/token'),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: {
              'client_id': clientId,
              'code': code,
              'code_verifier': verifier,
              'grant_type': 'authorization_code',
              'redirect_uri': redirectUri,
            },
          )
          .timeout(const Duration(seconds: 30));
      final payload = jsonDecode(response.body);
      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          payload is! Map) {
        throw const WindowsGoogleOAuthException(
          'Không thể hoàn tất đăng nhập Google.',
        );
      }
      final idToken = payload['id_token'];
      if (idToken is! String || idToken.isEmpty) {
        throw const WindowsGoogleOAuthException(
          'Google không trả về ID token.',
        );
      }
      return idToken;
    } on TimeoutException {
      throw const WindowsGoogleOAuthException(
        'Đăng nhập Google đã hết thời gian chờ.',
      );
    } finally {
      await server.close(force: true);
    }
  }

  String _randomUrlSafe(int length) {
    final random = Random.secure();
    final bytes = List<int>.generate(length, (_) => random.nextInt(256));
    return base64Url.encode(bytes).replaceAll('=', '');
  }
}

class WindowsGoogleOAuthException implements Exception {
  const WindowsGoogleOAuthException(this.message);
  final String message;
}
