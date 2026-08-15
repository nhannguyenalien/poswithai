import 'package:flutter/material.dart';

import '../auth/auth_controller.dart';
import '../customers/customer_list_page.dart';
import '../customers/customer_debt_overview_page.dart';
import '../dashboard/dashboard_models.dart';
import '../dashboard/dashboard_repository.dart';
import '../dashboard/dashboard_summary_view.dart';
import '../orders/order_list_page.dart';
import '../inventory/inventory_page.dart';
import '../products/product_list_page.dart';
import '../purchases/purchase_receipt_page.dart';
import '../reports/report_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.auth});

  final AuthController auth;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final DashboardRepository _repository = DashboardRepository(
    widget.auth.api,
  );
  DashboardSummary? _summary;
  String? _dashboardError;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    try {
      final summary = await _repository.today();
      if (mounted) {
        setState(() {
          _summary = summary;
          _dashboardError = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _dashboardError = 'Không tải được số liệu tổng quan');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tổng quan'),
        actions: [
          IconButton(
            onPressed: widget.auth.logout,
            tooltip: 'Đăng xuất',
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Xin chào${widget.auth.userName == null ? '' : ', ${widget.auth.userName}'}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 20),
            if (_summary != null)
              DashboardSummaryView(summary: _summary!)
            else if (_dashboardError != null)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.cloud_off_outlined),
                  title: Text(_dashboardError!),
                  trailing: IconButton(
                    onPressed: _loadDashboard,
                    icon: const Icon(Icons.refresh),
                  ),
                ),
              )
            else
              const Center(child: CircularProgressIndicator()),
            const Divider(height: 40),
            Text('Chức năng', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 20),
            _FeatureCard(
              icon: Icons.receipt_long,
              title: 'Đơn hàng',
              subtitle: 'Xem, tìm kiếm và tạo đơn bán hàng.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => OrderListPage(api: widget.auth.api),
                ),
              ),
            ),
            _FeatureCard(
              icon: Icons.inventory_2_outlined,
              title: 'Sản phẩm & tồn kho',
              subtitle: 'Tra cứu giá, biến thể và số lượng tồn.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ProductListPage(api: widget.auth.api),
                ),
              ),
            ),
            _FeatureCard(
              icon: Icons.warehouse_outlined,
              title: 'Quản lý kho',
              subtitle: 'Nhập, xuất, kiểm kho và quét barcode.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => InventoryPage(api: widget.auth.api),
                ),
              ),
            ),
            _FeatureCard(
              icon: Icons.local_shipping_outlined,
              title: 'Phiếu nhập kho',
              subtitle: 'Nhập nhiều sản phẩm, nhà cung cấp và quét barcode.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PurchaseReceiptPage(api: widget.auth.api),
                ),
              ),
            ),
            _FeatureCard(
              icon: Icons.people_outline,
              title: 'Khách hàng',
              subtitle: 'Tra cứu và tạo khách hàng.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => CustomerListPage(api: widget.auth.api),
                ),
              ),
            ),
            _FeatureCard(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Công nợ',
              subtitle: 'Theo dõi khoản cần thu, cần trả và điều chỉnh nhanh.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) =>
                      CustomerDebtOverviewPage(api: widget.auth.api),
                ),
              ),
            ),
            _FeatureCard(
              icon: Icons.insights_outlined,
              title: 'Báo cáo',
              subtitle: 'Doanh thu, bán chạy, công nợ và cảnh báo tồn kho.',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ReportPage(api: widget.auth.api),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
        onTap: onTap,
      ),
    );
  }
}
