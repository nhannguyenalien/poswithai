import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/config/app_config.dart';
import '../../core/storage/token_store.dart';

class AuthController extends ChangeNotifier {
  AuthController({required this.api, required this.tokenStore});

  final ApiClient api;
  final TokenStore tokenStore;
  bool isLoading = false;
  bool isAuthenticated = false;
  String? userName;
  String? errorMessage;
  String? setupToken;
  String? googleEmail;
  String? googleName;
  bool _googleInitialized = false;

  bool get needsSetup => setupToken != null && !isAuthenticated;

  Future<void> restoreSession() async {
    isAuthenticated = await tokenStore.readRefreshToken() != null;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();
    try {
      final result = await api.postJson('/auth/mobile-login', {
        'email': email.trim(),
        'password': password,
      }, authenticated: false);
      await tokenStore.save(
        accessToken: result['access_token'] as String,
        refreshToken: result['refresh_token'] as String,
      );
      final user = result['user'];
      userName = user is Map<String, dynamic> ? user['name'] as String? : null;
      isAuthenticated = true;
      return true;
    } on ApiError catch (error) {
      errorMessage = error.message;
      return false;
    } catch (_) {
      errorMessage = 'Không thể đăng nhập. Vui lòng thử lại.';
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> loginWithGoogle() async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();
    try {
      if (AppConfig.googleClientId.isEmpty ||
          AppConfig.googleServerClientId.isEmpty) {
        throw const ApiError(
          code: 'GOOGLE_AUTH_NOT_CONFIGURED',
          message: 'Bản cài đặt chưa có Google OAuth Client ID.',
        );
      }
      if (!_googleInitialized) {
        await GoogleSignIn.instance.initialize(
          clientId: AppConfig.googleClientId,
          serverClientId: AppConfig.googleServerClientId,
        );
        _googleInitialized = true;
      }
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        throw const ApiError(
          code: 'GOOGLE_TOKEN_MISSING',
          message: 'Google không trả về ID token.',
        );
      }
      final result = await api.postJson('/auth/mobile-google', {
        'id_token': idToken,
      }, authenticated: false);
      if (result['setup_required'] == true) {
        setupToken = result['setup_token'] as String;
        final profile = result['profile'];
        if (profile is Map<String, dynamic>) {
          googleEmail = profile['email'] as String?;
          googleName = profile['name'] as String?;
        }
        return true;
      }
      await _saveSession(result);
      return true;
    } on GoogleSignInException catch (error) {
      if (error.code != GoogleSignInExceptionCode.canceled) {
        errorMessage = 'Không thể đăng nhập Google: ${error.description ?? error.code.name}';
      }
      return false;
    } on ApiError catch (error) {
      errorMessage = error.message;
      return false;
    } catch (_) {
      errorMessage = 'Không thể đăng nhập Google. Vui lòng thử lại.';
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> completeSetup({
    required String shopName,
    required String shopSlug,
    String? password,
  }) async {
    final token = setupToken;
    if (token == null) return false;
    isLoading = true;
    errorMessage = null;
    notifyListeners();
    try {
      final result = await api.postJson('/setup', {
        'tenant_name': shopName.trim(),
        'tenant_slug': shopSlug.trim().toLowerCase(),
        if (password != null && password.isNotEmpty) 'admin_password': password,
      }, authenticated: false, bearerToken: token);
      await _saveSession(result);
      setupToken = null;
      return true;
    } on ApiError catch (error) {
      errorMessage = error.message;
      return false;
    } catch (_) {
      errorMessage = 'Không thể tạo cửa hàng. Vui lòng thử lại.';
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _saveSession(Map<String, dynamic> result) async {
    await tokenStore.save(
      accessToken: result['access_token'] as String,
      refreshToken: result['refresh_token'] as String,
    );
    final user = result['user'];
    userName = user is Map<String, dynamic> ? user['name'] as String? : null;
    isAuthenticated = true;
  }

  Future<void> logout() async {
    final refreshToken = await tokenStore.readRefreshToken();
    try {
      if (refreshToken != null) {
        await api.postJson('/auth/revoke', {
          'refresh_token': refreshToken,
        }, authenticated: false);
      }
    } finally {
      await tokenStore.clear();
      isAuthenticated = false;
      setupToken = null;
      userName = null;
      notifyListeners();
    }
  }
}
