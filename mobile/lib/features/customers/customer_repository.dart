import '../../core/api/api_client.dart';
import 'customer_models.dart';

class CustomerRepository {
  const CustomerRepository(this.api);
  final ApiClient api;

  Future<CustomerPageData> list({
    int offset = 0,
    int limit = 20,
    String search = '',
  }) async {
    final json = await api.getJson(
      '/customers',
      query: {
        'offset': offset,
        'limit': limit,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    final rows = json['customers'] as List<dynamic>? ?? const [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    return CustomerPageData(
      customers: rows
          .map((row) => CustomerSummary.fromJson(row as Map<String, dynamic>))
          .toList(),
      hasMore: pagination['has_more'] == true,
    );
  }

  Future<CustomerSummary> create({
    required String name,
    String? phone,
    String? email,
    String? address,
    String? idCard,
    bool isBusiness = false,
    String? taxCode,
  }) async {
    final json = await api.postJson('/customers', {
      'name': name.trim(),
      if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      if (address != null && address.trim().isNotEmpty)
        'address': address.trim(),
      if (idCard != null && idCard.trim().isNotEmpty) 'id_card': idCard.trim(),
      'is_business': isBusiness,
      if (taxCode != null && taxCode.trim().isNotEmpty)
        'tax_code': taxCode.trim(),
    });
    return CustomerSummary.fromJson(json);
  }

  Future<CustomerDetailData> detail(String id) async =>
      CustomerDetailData.fromJson(await api.getJson('/customers/$id'));

  Future<CustomerDebtData> debt(String id) async =>
      CustomerDebtData.fromJson(await api.getJson('/customers/$id/debt'));

  Future<CustomerDebtPageData> debtList({
    int offset = 0,
    int limit = 30,
    String search = '',
    String direction = 'all',
  }) async {
    final json = await api.getJson(
      '/customers/debts',
      query: {
        'offset': offset,
        'limit': limit,
        'direction': direction,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    final rows = json['customers'] as List<dynamic>? ?? const [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    final summary = json['summary'] as Map<String, dynamic>? ?? const {};
    return CustomerDebtPageData(
      customers: rows
          .map(
            (row) => CustomerDebtSummary.fromJson(row as Map<String, dynamic>),
          )
          .toList(),
      hasMore: pagination['has_more'] == true,
      receivableMoney: int.tryParse('${summary['receivable_money'] ?? 0}') ?? 0,
      payableMoney: int.tryParse('${summary['payable_money'] ?? 0}') ?? 0,
      customerCount: int.tryParse('${summary['customer_count'] ?? 0}') ?? 0,
    );
  }

  Future<void> update({
    required String id,
    required String name,
    required String phone,
    required String email,
    required String address,
    required String idCard,
    required bool isBusiness,
    required String taxCode,
  }) => api.putJson('/customers/$id', {
    'name': name.trim(),
    'phone': phone.trim(),
    'email': email.trim(),
    'address': address.trim(),
    'id_card': idCard.trim(),
    'is_business': isBusiness,
    'tax_code': taxCode.trim(),
  });

  Future<void> addDebtAdjustment({
    required String customerId,
    required int moneyAmount,
    required String goldAmount99,
    required String note,
  }) => api.postJson('/customers/$customerId/debt', {
    'money_amount': moneyAmount,
    'gold_amount_99': goldAmount99,
    'note': note.trim(),
  });
}
