import '../../core/api/api_client.dart';
import 'report_models.dart';

class ReportRepository {
  const ReportRepository(this.api);

  final ApiClient api;

  Future<(RevenueReport, StockReport)> load(DateTime from, DateTime to) async {
    final responses = await Future.wait([
      api.getJson(
        '/reports/revenue',
        query: {'from': _date(from), 'to': _date(to)},
      ),
      api.getJson('/reports/stock', query: {'filter': 'low'}),
    ]);
    return (
      RevenueReport.fromJson(responses[0]),
      StockReport.fromJson(responses[1]),
    );
  }
}

String _date(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
