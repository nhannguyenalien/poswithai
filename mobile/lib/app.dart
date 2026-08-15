import 'package:flutter/material.dart';

import 'features/auth/auth_controller.dart';
import 'features/auth/login_page.dart';
import 'features/auth/setup_page.dart';
import 'features/home/home_page.dart';

class PosMobileApp extends StatelessWidget {
  const PosMobileApp({super.key, required this.auth});

  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SpaceHuge POS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF8B6914)),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
        ),
      ),
      home: ListenableBuilder(
        listenable: auth,
        builder: (context, _) {
          if (auth.isAuthenticated) return HomePage(auth: auth);
          if (auth.needsSetup) return SetupPage(auth: auth);
          return LoginPage(auth: auth);
        },
      ),
    );
  }
}
