import 'package:flutter/material.dart';

import 'auth_controller.dart';

class SetupPage extends StatefulWidget {
  const SetupPage({super.key, required this.auth});

  final AuthController auth;

  @override
  State<SetupPage> createState() => _SetupPageState();
}

class _SetupPageState extends State<SetupPage> {
  final _formKey = GlobalKey<FormState>();
  final _shopName = TextEditingController();
  final _slug = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _shopName.dispose();
    _slug.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await widget.auth.completeSetup(
      shopName: _shopName.text,
      shopSlug: _slug.text,
      password: _password.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.storefront, size: 64, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 16),
                  Text('Tạo cửa hàng', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 8),
                  Text(widget.auth.googleEmail ?? '', textAlign: TextAlign.center),
                  const SizedBox(height: 28),
                  TextFormField(
                    controller: _shopName,
                    decoration: const InputDecoration(labelText: 'Tên cửa hàng'),
                    validator: (value) => value == null || value.trim().length < 2 ? 'Nhập tên cửa hàng' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _slug,
                    decoration: const InputDecoration(labelText: 'Mã cửa hàng', hintText: 'vi-du: cua-hang-an-phat'),
                    validator: (value) => value == null || !RegExp(r'^[a-z0-9-]+$').hasMatch(value) ? 'Chỉ dùng chữ thường, số và dấu gạch ngang' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Mật khẩu dự phòng (không bắt buộc)'),
                    validator: (value) => value != null && value.isNotEmpty && value.length < 8 ? 'Mật khẩu tối thiểu 8 ký tự' : null,
                  ),
                  if (widget.auth.errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(widget.auth.errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: widget.auth.isLoading ? null : _submit,
                    icon: widget.auth.isLoading
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.check),
                    label: const Text('Tạo và bắt đầu sử dụng'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
