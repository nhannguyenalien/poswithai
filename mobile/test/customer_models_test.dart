import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/customers/customer_models.dart';

void main() {
  test('customer debt keeps VND integer and gold decimal string', () {
    final debt = CustomerDebtData.fromJson({
      'money_debt': '-125000',
      'gold_debt_99': '1.250001',
      'orders': [
        {
          'id': 'order-1',
          'order_number': 'DH001',
          'money_debt': 125000,
          'money_debt_direction': 'shop_owes',
          'gold_debt_99': '0.25',
        },
      ],
      'adjustments': [
        {
          'id': 'adjustment-1',
          'money_amount': '-5000',
          'gold_amount_99': '-0.1',
          'note': 'Giảm nợ',
        },
      ],
    });

    expect(debt.moneyDebt, -125000);
    expect(debt.goldDebt99, '1.250001');
    expect(debt.orders.single.direction, 'shop_owes');
    expect(debt.orders.single.goldDebt99, '0.25');
    expect(debt.adjustments.single.moneyAmount, -5000);
    expect(debt.adjustments.single.goldAmount99, '-0.1');
  });

  test('debt overview parses signed balances without double conversion', () {
    final customer = CustomerDebtSummary.fromJson({
      'id': 'customer-1',
      'name': 'Khách A',
      'phone': '0900000000',
      'money_debt': '-9007199254740000',
      'gold_debt_99': '-0.000001',
    });

    expect(customer.moneyDebt, -9007199254740000);
    expect(customer.goldDebt99, '-0.000001');
  });
}
