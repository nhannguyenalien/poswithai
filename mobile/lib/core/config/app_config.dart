class AppConfig {
  AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://pos.schoolsai.work/api',
  );

  /// OAuth client loại iOS (dùng chung cho macOS trong Google Cloud Console).
  static const googleClientId = String.fromEnvironment('GOOGLE_CLIENT_ID');

  /// OAuth Web client mà backend dùng để kiểm tra audience của ID token.
  static const googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );

  static Uri get apiBaseUri {
    final uri = Uri.parse(apiBaseUrl);
    if (!uri.hasScheme || uri.host.isEmpty) {
      throw StateError('API_BASE_URL không hợp lệ: $apiBaseUrl');
    }
    return uri;
  }
}
