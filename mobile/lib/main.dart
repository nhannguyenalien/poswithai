import 'package:flutter/material.dart';

import 'app.dart';
import 'core/api/api_client.dart';
import 'core/config/app_config.dart';
import 'core/storage/token_store.dart';
import 'features/auth/auth_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const tokenStore = SecureTokenStore();
  final api = ApiClient(baseUri: AppConfig.apiBaseUri, tokenStore: tokenStore);
  final auth = AuthController(api: api, tokenStore: tokenStore);
  await auth.restoreSession();
  runApp(PosMobileApp(auth: auth));
}
