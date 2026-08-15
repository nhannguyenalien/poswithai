import '../../core/api/api_client.dart';
import 'dashboard_models.dart';

class DashboardRepository {
  const DashboardRepository(this.api);

  final ApiClient api;

  Future<DashboardSummary> today() async {
    final today = _date(DateTime.now());
    final responses = await Future.wait([
      api.getJson('/reports/revenue', query: {'from': today, 'to': today}),
      api.getJson('/reports/stock'),
    ]);
    return DashboardSummary.fromResponses(
      revenueResponse: responses[0],
      stockResponse: responses[1],
    );
  }
}

String _date(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';
