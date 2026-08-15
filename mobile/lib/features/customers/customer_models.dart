class CustomerSummary {
  const CustomerSummary({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.address,
    this.idCard,
    this.isBusiness = false,
    this.taxCode,
    this.totalOrders = 0,
  });

  factory CustomerSummary.fromJson(Map<String, dynamic> json) =>
      CustomerSummary(
        id: '${json['id']}',
        name: '${json['name']}',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        address: json['address'] as String?,
        idCard: json['id_card'] as String?,
        isBusiness: json['is_business'] == true,
        taxCode: json['tax_code'] as String?,
        totalOrders: int.tryParse('${json['total_orders'] ?? 0}') ?? 0,
      );

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final String? idCard;
  final bool isBusiness;
  final String? taxCode;
  final int totalOrders;
}

class CustomerDetailData {
  const CustomerDetailData({required this.customer, required this.orders});

  factory CustomerDetailData.fromJson(Map<String, dynamic> json) =>
      CustomerDetailData(
        customer: CustomerSummary.fromJson(
          json['customer'] as Map<String, dynamic>,
        ),
        orders: (json['orders'] as List<dynamic>? ?? const [])
            .map((row) => CustomerOrder.fromJson(row as Map<String, dynamic>))
            .toList(),
      );

  final CustomerSummary customer;
  final List<CustomerOrder> orders;
}

class CustomerOrder {
  const CustomerOrder({
    required this.id,
    required this.number,
    required this.total,
    required this.status,
    this.createdAt,
  });

  factory CustomerOrder.fromJson(Map<String, dynamic> json) => CustomerOrder(
    id: '${json['id']}',
    number: '${json['order_number']}',
    total: int.tryParse('${json['total']}') ?? 0,
    status: '${json['status']}',
    createdAt: DateTime.tryParse('${json['created_at']}'),
  );

  final String id;
  final String number;
  final int total;
  final String status;
  final DateTime? createdAt;
}

class CustomerDebtData {
  const CustomerDebtData({
    required this.moneyDebt,
    required this.goldDebt99,
    required this.orders,
    required this.adjustments,
  });

  factory CustomerDebtData.fromJson(Map<String, dynamic> json) =>
      CustomerDebtData(
        moneyDebt: int.tryParse('${json['money_debt']}') ?? 0,
        goldDebt99: '${json['gold_debt_99'] ?? '0'}',
        orders: (json['orders'] as List<dynamic>? ?? const [])
            .map((row) => DebtOrder.fromJson(row as Map<String, dynamic>))
            .toList(),
        adjustments: (json['adjustments'] as List<dynamic>? ?? const [])
            .map((row) => DebtAdjustment.fromJson(row as Map<String, dynamic>))
            .toList(),
      );

  final int moneyDebt;
  final String goldDebt99;
  final List<DebtOrder> orders;
  final List<DebtAdjustment> adjustments;
}

class DebtOrder {
  const DebtOrder({
    required this.id,
    required this.number,
    required this.moneyDebt,
    required this.direction,
    required this.goldDebt99,
  });

  factory DebtOrder.fromJson(Map<String, dynamic> json) => DebtOrder(
    id: '${json['id']}',
    number: '${json['order_number']}',
    moneyDebt: int.tryParse('${json['money_debt']}') ?? 0,
    direction: '${json['money_debt_direction']}',
    goldDebt99: '${json['gold_debt_99'] ?? '0'}',
  );

  final String id;
  final String number;
  final int moneyDebt;
  final String direction;
  final String goldDebt99;
}

class DebtAdjustment {
  const DebtAdjustment({
    required this.id,
    required this.moneyAmount,
    required this.goldAmount99,
    this.note,
  });

  factory DebtAdjustment.fromJson(Map<String, dynamic> json) => DebtAdjustment(
    id: '${json['id']}',
    moneyAmount: int.tryParse('${json['money_amount']}') ?? 0,
    goldAmount99: '${json['gold_amount_99'] ?? '0'}',
    note: json['note'] as String?,
  );

  final String id;
  final int moneyAmount;
  final String goldAmount99;
  final String? note;
}

class CustomerPageData {
  const CustomerPageData({required this.customers, required this.hasMore});
  final List<CustomerSummary> customers;
  final bool hasMore;
}

class CustomerDebtSummary {
  const CustomerDebtSummary({
    required this.id,
    required this.name,
    required this.moneyDebt,
    required this.goldDebt99,
    this.phone,
  });

  factory CustomerDebtSummary.fromJson(Map<String, dynamic> json) =>
      CustomerDebtSummary(
        id: '${json['id']}',
        name: '${json['name']}',
        phone: json['phone'] as String?,
        moneyDebt: int.tryParse('${json['money_debt']}') ?? 0,
        goldDebt99: '${json['gold_debt_99'] ?? '0'}',
      );

  final String id;
  final String name;
  final String? phone;
  final int moneyDebt;
  final String goldDebt99;
}

class CustomerDebtPageData {
  const CustomerDebtPageData({
    required this.customers,
    required this.hasMore,
    required this.receivableMoney,
    required this.payableMoney,
    required this.customerCount,
  });

  final List<CustomerDebtSummary> customers;
  final bool hasMore;
  final int receivableMoney;
  final int payableMoney;
  final int customerCount;
}
