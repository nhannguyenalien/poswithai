import 'package:flutter/material.dart';

import '../orders/order_models.dart';
import 'dashboard_models.dart';

class DashboardSummaryView extends StatelessWidget {
  const DashboardSummaryView({super.key, required this.summary});

  final DashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Hôm nay', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        _MetricCard(
          icon: Icons.trending_up,
          label: 'Doanh thu',
          value: formatVnd(summary.revenue),
          color: Colors.green,
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                icon: Icons.receipt_long_outlined,
                label: 'Đơn hàng',
                value: '${summary.totalOrders}',
                detail:
                    '${summary.completedOrders} xong · ${summary.pendingOrders} chờ',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MetricCard(
                icon: Icons.account_balance_wallet_outlined,
                label: 'Phải thu',
                value: formatVnd(summary.receivable),
                color: Colors.orange,
              ),
            ),
          ],
        ),
        if (summary.lowStockCount > 0 || summary.outOfStockCount > 0) ...[
          const SizedBox(height: 10),
          Card(
            color: Theme.of(context).colorScheme.errorContainer,
            child: ListTile(
              leading: Icon(
                Icons.inventory_2_outlined,
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
              title: const Text('Cảnh báo tồn kho'),
              subtitle: Text(
                '${summary.lowStockCount} SKU sắp hết · '
                '${summary.outOfStockCount} SKU đã hết',
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.icon,
    required this.label,
    required this.value,
    this.detail,
    this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? detail;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: accent),
            const SizedBox(height: 10),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
            if (detail != null) ...[
              const SizedBox(height: 3),
              Text(detail!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}
