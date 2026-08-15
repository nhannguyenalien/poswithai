// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:pos_mobile/app.dart';
import 'package:pos_mobile/core/api/api_client.dart';
import 'package:pos_mobile/core/config/app_config.dart';
import 'package:pos_mobile/core/storage/token_store.dart';
import 'package:pos_mobile/features/auth/auth_controller.dart';

void main() {
  testWidgets('shows the sign-in screen', (WidgetTester tester) async {
    const tokenStore = SecureTokenStore();
    final auth = AuthController(
      api: ApiClient(baseUri: AppConfig.apiBaseUri, tokenStore: tokenStore),
      tokenStore: tokenStore,
    );
    await tester.pumpWidget(PosMobileApp(auth: auth));

    expect(find.text('SpaceHuge POS'), findsOneWidget);
    expect(find.text('Đăng nhập hoặc đăng ký bằng Google'), findsOneWidget);
  });
}
