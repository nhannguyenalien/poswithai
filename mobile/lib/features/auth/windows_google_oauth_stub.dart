class WindowsGoogleOAuth {
  const WindowsGoogleOAuth();

  Future<String> authenticate({required String clientId}) {
    throw const WindowsGoogleOAuthException(
      'Google OAuth desktop không được hỗ trợ trên nền tảng này.',
    );
  }
}

class WindowsGoogleOAuthException implements Exception {
  const WindowsGoogleOAuthException(this.message);
  final String message;
}
