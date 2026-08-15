import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_error.dart';
import '../customers/customer_list_page.dart';
import '../customers/customer_models.dart';
import '../customers/customer_repository.dart';
import 'order_models.dart';
import 'order_repository.dart';

class WholesaleOrderCreatePage extends StatefulWidget {
  const WholesaleOrderCreatePage({super.key, required this.repository});

  final OrderRepository repository;

  @override
  State<WholesaleOrderCreatePage> createState() =>
      _WholesaleOrderCreatePageState();
}

class _WholesaleOrderCreatePageState extends State<WholesaleOrderCreatePage> {
  final _search = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _price = TextEditingController();
  final _purity = TextEditingController(text: '99');
  final _grossWeight = TextEditingController();
  final _stoneWeight = TextEditingController(text: '0');
  final _goldPrice = TextEditingController();
  final _goldToMoney = TextEditingController(text: '0');
  final _discountPercent = TextEditingController(text: '0');
  final _payment = TextEditingController(text: '0');
  final _notes = TextEditingController();

  List<ProductChoice>? _products;
  List<VariantChoice> _variants = const [];
  final List<_WholesaleLine> _lines = [];
  final List<_TradeInLine> _tradeIns = [];
  ProductChoice? _product;
  VariantChoice? _variant;
  CustomerSummary? _customer;
  CustomerDebtData? _oldDebt;
  bool _loadingVariants = false;
  bool _loadingDebt = false;
  bool _saving = false;
  String _paymentMethod = 'cash';
  String? _error;

  int get _subtotal =>
      _lines.fold(0, (sum, line) => sum + line.unitPrice * line.quantity);
  int get _goldSoldMicro =>
      _lines.fold(0, (sum, line) => sum + line.gold99Micro);
  int get _goldBoughtMicro =>
      _tradeIns.fold(0, (sum, line) => sum + line.gold99Micro);
  int get _goldToMoneyMicro => _Decimal.parseMicro(_goldToMoney.text) ?? 0;
  int get _goldPriceVnd => _parseVnd(_goldPrice.text);
  int get _goldMoneyValue =>
      (_goldToMoneyMicro * _goldPriceVnd / _Decimal.scale).round();
  int get _discount {
    final percentMicro = _Decimal.parseMicro(_discountPercent.text) ?? 0;
    return ((_subtotal + _goldMoneyValue) *
            percentMicro /
            (100 * _Decimal.scale))
        .round();
  }

  int get _total => _subtotal + _goldMoneyValue - _discount;
  int get _paymentAmount => _parseVnd(_payment.text).abs();
  int get _currentMoneyDebt =>
      _total - (_total < 0 ? -_paymentAmount : _paymentAmount);
  int get _combinedMoneyDebt => _currentMoneyDebt + (_oldDebt?.moneyDebt ?? 0);
  int get _combinedGoldDebtMicro =>
      _goldSoldMicro -
      _goldBoughtMicro -
      _goldToMoneyMicro +
      (_Decimal.parseMicro(_oldDebt?.goldDebt99 ?? '0') ?? 0);

  @override
  void initState() {
    super.initState();
    _loadProducts();
    for (final controller in [
      _goldPrice,
      _goldToMoney,
      _discountPercent,
      _payment,
    ]) {
      controller.addListener(_refreshTotals);
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _search,
      _quantity,
      _price,
      _purity,
      _grossWeight,
      _stoneWeight,
      _goldPrice,
      _goldToMoney,
      _discountPercent,
      _payment,
      _notes,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _refreshTotals() {
    if (mounted) setState(() {});
  }

  Future<void> _loadProducts([String search = '']) async {
    try {
      final products = await widget.repository.products(search: search);
      if (mounted) {
        setState(() {
          _products = products;
          if (_product != null &&
              !products.any((product) => product.id == _product!.id)) {
            _product = null;
            _variant = null;
            _variants = const [];
          }
        });
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _selectProduct(ProductChoice? product) async {
    setState(() {
      _product = product;
      _variant = null;
      _variants = const [];
      _loadingVariants = product != null;
    });
    if (product == null) return;
    try {
      final variants = await widget.repository.variants(product.id);
      if (!mounted || _product?.id != product.id) return;
      setState(() {
        _variants = variants;
        _loadingVariants = false;
        if (variants.length == 1) _setVariant(variants.first);
      });
    } on ApiError catch (error) {
      if (mounted) {
        setState(() {
          _loadingVariants = false;
          _error = error.message;
        });
      }
    }
  }

  void _setVariant(VariantChoice? variant) {
    _variant = variant;
    if (variant == null) return;
    _price.text =
        '${variant.isGold ? variant.goldMakingFee ?? 0 : variant.price}';
    _purity.text = variant.goldPurity ?? '99';
    _grossWeight.text = variant.goldGross ?? variant.goldNet ?? '';
    _stoneWeight.text = variant.goldStone ?? '0';
  }

  Future<void> _selectCustomer() async {
    final customer = await Navigator.of(context).push<CustomerSummary>(
      MaterialPageRoute(
        builder: (_) =>
            CustomerListPage(api: widget.repository.api, selectionMode: true),
      ),
    );
    if (customer == null || !mounted) return;
    setState(() {
      _customer = customer;
      _oldDebt = null;
      _loadingDebt = true;
      _error = null;
    });
    try {
      final debt = await CustomerRepository(
        widget.repository.api,
      ).debt(customer.id);
      if (mounted && _customer?.id == customer.id) {
        setState(() => _oldDebt = debt);
      }
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loadingDebt = false);
    }
  }

  void _addProduct() {
    final product = _product;
    final variant = _variant;
    final quantity = int.tryParse(_quantity.text) ?? 0;
    final price = _parseVnd(_price.text);
    if (product == null || variant == null) {
      setState(() => _error = 'Vui lòng chọn sản phẩm và biến thể');
      return;
    }
    if (quantity <= 0 || price < 0) {
      setState(() => _error = 'Số lượng hoặc tiền công/đơn giá không hợp lệ');
      return;
    }
    final already = _lines
        .where((line) => line.variant.id == variant.id)
        .fold(0, (sum, line) => sum + line.quantity);
    if (already + quantity > variant.stock) {
      setState(
        () => _error =
            'Không đủ tồn kho. ${variant.sku} chỉ còn ${variant.stock}',
      );
      return;
    }

    var grossMicro = 0;
    var stoneMicro = 0;
    var purityMicro = 0;
    if (variant.isGold) {
      grossMicro = _Decimal.parseMicro(_grossWeight.text) ?? -1;
      stoneMicro = _Decimal.parseMicro(_stoneWeight.text) ?? -1;
      purityMicro = _Decimal.parseMicro(_purity.text) ?? -1;
      if (grossMicro <= 0 || stoneMicro < 0 || stoneMicro > grossMicro) {
        setState(() => _error = 'Trọng lượng vàng/hột không hợp lệ');
        return;
      }
      if (purityMicro <= 0 || purityMicro > 100 * _Decimal.scale) {
        setState(
          () => _error = 'Tuổi vàng phải lớn hơn 0 và không vượt quá 100',
        );
        return;
      }
    }

    setState(() {
      _lines.add(
        _WholesaleLine(
          product: product,
          variant: variant,
          quantity: quantity,
          unitPrice: price,
          purityMicro: purityMicro,
          grossMicro: grossMicro,
          stoneMicro: stoneMicro,
        ),
      );
      _quantity.text = '1';
      _error = null;
    });
  }

  Future<void> _addTradeIn() async {
    final name = TextEditingController(text: 'Vàng cũ khách trả');
    final purity = TextEditingController(text: '99');
    final gross = TextEditingController();
    final stone = TextEditingController(text: '0');
    final result = await showDialog<_TradeInLine>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Thêm hàng cũ khách trả'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Tên hàng'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: purity,
                decoration: const InputDecoration(labelText: 'Tuổi vàng (%)'),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: gross,
                decoration: const InputDecoration(
                  labelText: 'TL vàng + hột (chỉ)',
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: stone,
                decoration: const InputDecoration(
                  labelText: 'TL hột / trừ hao (chỉ)',
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              final p = _Decimal.parseMicro(purity.text) ?? -1;
              final g = _Decimal.parseMicro(gross.text) ?? -1;
              final s = _Decimal.parseMicro(stone.text) ?? -1;
              if (name.text.trim().isEmpty ||
                  p <= 0 ||
                  p > 100 * _Decimal.scale ||
                  g <= 0 ||
                  s < 0 ||
                  s > g) {
                return;
              }
              Navigator.pop(
                context,
                _TradeInLine(
                  name: name.text.trim(),
                  purityMicro: p,
                  grossMicro: g,
                  stoneMicro: s,
                ),
              );
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
    name.dispose();
    purity.dispose();
    gross.dispose();
    stone.dispose();
    if (result != null && mounted) setState(() => _tradeIns.add(result));
  }

  Future<void> _save({required bool draft}) async {
    if (_customer == null) {
      setState(() => _error = 'Đơn sỉ bắt buộc phải chọn khách hàng');
      return;
    }
    if (_loadingDebt || _oldDebt == null) {
      setState(() => _error = 'Chưa tải xong công nợ cũ của khách hàng');
      return;
    }
    if (_lines.isEmpty && _tradeIns.isEmpty) {
      setState(() => _error = 'Cần có sản phẩm bán hoặc hàng cũ khách trả');
      return;
    }
    if (_goldToMoneyMicro.abs() > 0 && _goldPriceVnd <= 0) {
      setState(() => _error = 'Cần nhập giá vàng 99/chỉ khi quy vàng ra tiền');
      return;
    }
    final discountPercent = _Decimal.parseMicro(_discountPercent.text);
    if (discountPercent == null ||
        discountPercent < 0 ||
        discountPercent > 100 * _Decimal.scale) {
      setState(() => _error = 'Chiết khấu phải nằm trong khoảng 0–100%');
      return;
    }
    if (_paymentAmount > _total.abs()) {
      setState(
        () => _error = 'Thanh toán không được vượt quá tổng tiền của toa',
      );
      return;
    }
    if (!draft) {
      final confirmed = await _confirm();
      if (confirmed != true || !mounted) return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await widget.repository.create(
        customerId: _customer!.id,
        orderType: 'wholesale',
        isQuick: draft,
        items: _lines.map((line) => line.toOrderItem()).toList(),
        discount: _discount,
        goldPrice99: '$_goldPriceVnd',
        goldSold99: _Decimal.formatMicro(_goldSoldMicro),
        goldBought99: _Decimal.formatMicro(_goldBoughtMicro),
        goldToMoney99: _Decimal.formatMicro(_goldToMoneyMicro),
        makingFeeTotal: _lines
            .where((line) => line.isGold)
            .fold(0, (sum, line) => sum + line.unitPrice * line.quantity),
        tradeInDetails: _tradeIns.map((line) => line.toJson()).toList(),
        oldMoneyDebt: _oldDebt!.moneyDebt,
        oldGoldDebt99: _oldDebt!.goldDebt99,
        notes: _notes.text,
      );
      if (!draft && _paymentAmount > 0) {
        try {
          await widget.repository.createPayment(
            orderId: result.id,
            method: _paymentMethod,
            amount: result.total < 0 ? -_paymentAmount : _paymentAmount,
          );
        } on ApiError catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Đơn ${result.number} đã tạo nhưng chưa ghi được thanh toán: ${error.message}. Hãy thanh toán lại trong chi tiết đơn.',
                ),
              ),
            );
          }
        }
      }
      if (mounted) Navigator.pop(context, result);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool?> _confirm() => showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Kiểm tra toa bán sỉ'),
      content: SingleChildScrollView(child: _summary(showDebt: true)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Xem lại'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Xác nhận tạo'),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Tạo đơn bán sỉ')),
    body: _products == null && _error == null
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '1. Khách hàng & nợ cũ',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.business_outlined),
                title: Text(_customer?.name ?? 'Chọn khách hàng bán sỉ *'),
                subtitle: _loadingDebt
                    ? const Text('Đang tải công nợ...')
                    : Text(_debtLabel()),
                trailing: const Icon(Icons.chevron_right),
                onTap: _selectCustomer,
              ),
              const Divider(height: 28),
              Text(
                '2. Hàng bán',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (value) => _loadProducts(value.trim()),
                decoration: InputDecoration(
                  labelText: 'Tìm tên, SKU hoặc barcode',
                  suffixIcon: IconButton(
                    onPressed: () => _loadProducts(_search.text.trim()),
                    icon: const Icon(Icons.search),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<ProductChoice>(
                initialValue: _product,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Sản phẩm'),
                items: (_products ?? const [])
                    .map(
                      (p) => DropdownMenuItem(
                        value: p,
                        child: Text(p.name, overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(),
                onChanged: _selectProduct,
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<VariantChoice>(
                initialValue: _variant,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: 'Biến thể / SKU',
                  suffixIcon: _loadingVariants
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : null,
                ),
                items: _variants
                    .map(
                      (v) => DropdownMenuItem(
                        value: v,
                        child: Text('${v.sku} · tồn ${v.stock}'),
                      ),
                    )
                    .toList(),
                onChanged: _loadingVariants
                    ? null
                    : (value) => setState(() => _setVariant(value)),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _integerField(_quantity, 'Số lượng')),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: _integerField(
                      _price,
                      _variant?.isGold == true
                          ? 'Tiền công / món'
                          : 'Đơn giá VND',
                    ),
                  ),
                ],
              ),
              if (_variant?.isGold == true) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _decimalField(_purity, 'Tuổi vàng (%)')),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _decimalField(_grossWeight, 'TL vàng + hột (chỉ)'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _decimalField(_stoneWeight, 'TL hột (chỉ)'),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _addProduct,
                icon: const Icon(Icons.add_shopping_cart),
                label: const Text('Thêm vào toa'),
              ),
              ...List.generate(_lines.length, (index) => _lineTile(index)),
              const Divider(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '3. Hàng cũ khách trả',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  TextButton.icon(
                    onPressed: _addTradeIn,
                    icon: const Icon(Icons.add),
                    label: const Text('Thêm'),
                  ),
                ],
              ),
              ...List.generate(
                _tradeIns.length,
                (index) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(_tradeIns[index].name),
                  subtitle: Text(
                    'Vàng thực ${_Decimal.formatMicro(_tradeIns[index].netMicro)} chỉ · quy 99: ${_Decimal.formatMicro(_tradeIns[index].gold99Micro)} chỉ',
                  ),
                  trailing: IconButton(
                    onPressed: () => setState(() => _tradeIns.removeAt(index)),
                    icon: const Icon(Icons.delete_outline),
                  ),
                ),
              ),
              const Divider(height: 28),
              Text(
                '4. Quy đổi & thanh toán',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _integerField(_goldPrice, 'Giá vàng 99 / chỉ'),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _decimalField(
                      _goldToMoney,
                      'Vàng 99 quy ra tiền',
                      allowSigned: true,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _decimalField(_discountPercent, 'Chiết khấu (%)'),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _integerField(
                      _payment,
                      _total < 0 ? 'Tiền hoàn khách' : 'Khách thanh toán',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _paymentMethod,
                decoration: const InputDecoration(
                  labelText: 'Phương thức thanh toán',
                ),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Tiền mặt')),
                  DropdownMenuItem(
                    value: 'bank_transfer',
                    child: Text('Chuyển khoản'),
                  ),
                  DropdownMenuItem(value: 'card', child: Text('Thẻ')),
                ],
                onChanged: (value) =>
                    setState(() => _paymentMethod = value ?? 'cash'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _notes,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Ghi chú'),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _summary(showDebt: true),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : () => _save(draft: true),
                      child: const Text('Lưu tạm'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _saving ? null : () => _save(draft: false),
                      icon: _saving
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.check),
                      label: const Text('Kiểm tra & tạo đơn'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
            ],
          ),
  );

  Widget _integerField(TextEditingController controller, String label) =>
      TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: label),
      );

  Widget _decimalField(
    TextEditingController controller,
    String label, {
    bool allowSigned = false,
  }) => TextField(
    controller: controller,
    keyboardType: TextInputType.numberWithOptions(
      decimal: true,
      signed: allowSigned,
    ),
    inputFormatters: [
      FilteringTextInputFormatter.allow(
        allowSigned
            ? RegExp(r'^-?\d{0,9}([.,]\d{0,6})?')
            : RegExp(r'^\d{0,9}([.,]\d{0,6})?'),
      ),
    ],
    decoration: InputDecoration(labelText: label),
  );

  Widget _lineTile(int index) {
    final line = _lines[index];
    return Card(
      child: ListTile(
        title: Text('${line.product.name} × ${line.quantity}'),
        subtitle: Text(
          line.isGold
              ? '${line.variant.sku} · vàng thực ${_Decimal.formatMicro(line.netMicro)} chỉ · quy 99 ${_Decimal.formatMicro(line.gold99Micro)} chỉ\nTiền công: ${formatVnd(line.unitPrice * line.quantity)}'
              : '${line.variant.sku} · ${formatVnd(line.unitPrice * line.quantity)}',
        ),
        isThreeLine: line.isGold,
        trailing: IconButton(
          onPressed: () => setState(() => _lines.removeAt(index)),
          icon: const Icon(Icons.delete_outline),
        ),
      ),
    );
  }

  Widget _summary({required bool showDebt}) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      _summaryRow('Tiền hàng / tiền công', formatVnd(_subtotal)),
      _summaryRow(
        'Vàng bán quy 99',
        '${_Decimal.formatMicro(_goldSoldMicro)} chỉ',
      ),
      _summaryRow(
        'Vàng mua lại quy 99',
        '${_Decimal.formatMicro(_goldBoughtMicro)} chỉ',
      ),
      _summaryRow(
        'Vàng quy ra tiền',
        '${_Decimal.formatMicro(_goldToMoneyMicro)} chỉ · ${formatVnd(_goldMoneyValue)}',
      ),
      _summaryRow('Chiết khấu', '-${formatVnd(_discount)}'),
      const Divider(),
      _summaryRow('Tổng toa', formatVnd(_total), strong: true),
      _summaryRow(
        _total < 0 ? 'Hoàn khách' : 'Đã thanh toán',
        formatVnd(_paymentAmount),
      ),
      if (showDebt) ...[
        _summaryRow(
          'Công nợ tiền sau toa',
          _debtDirection(_combinedMoneyDebt),
          strong: true,
        ),
        _summaryRow(
          'Công nợ vàng sau toa',
          _goldDebtDirection(_combinedGoldDebtMicro),
          strong: true,
        ),
      ],
    ],
  );

  Widget _summaryRow(String label, String value, {bool strong = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(label)),
            const SizedBox(width: 12),
            Text(
              value,
              textAlign: TextAlign.right,
              style: strong
                  ? const TextStyle(fontWeight: FontWeight.bold)
                  : null,
            ),
          ],
        ),
      );

  String _debtLabel() {
    if (_customer == null) return 'Bắt buộc cho đơn bán sỉ';
    final debt = _oldDebt;
    if (debt == null) return 'Không đọc được công nợ';
    return 'Nợ cũ: ${_debtDirection(debt.moneyDebt)} · ${_goldDebtDirection(_Decimal.parseMicro(debt.goldDebt99) ?? 0)}';
  }

  String _debtDirection(int value) => value == 0
      ? 'không nợ tiền'
      : value > 0
      ? 'khách nợ ${formatVnd(value)}'
      : 'tiệm nợ khách ${formatVnd(value.abs())}';

  String _goldDebtDirection(int micro) => micro == 0
      ? 'không nợ vàng'
      : micro > 0
      ? 'khách nợ ${_Decimal.formatMicro(micro)} chỉ'
      : 'tiệm nợ khách ${_Decimal.formatMicro(micro.abs())} chỉ';
}

class _WholesaleLine {
  const _WholesaleLine({
    required this.product,
    required this.variant,
    required this.quantity,
    required this.unitPrice,
    required this.purityMicro,
    required this.grossMicro,
    required this.stoneMicro,
  });
  final ProductChoice product;
  final VariantChoice variant;
  final int quantity;
  final int unitPrice;
  final int purityMicro;
  final int grossMicro;
  final int stoneMicro;
  bool get isGold => purityMicro > 0;
  int get netMicro => grossMicro - stoneMicro;
  int get gold99Micro => isGold
      ? ((netMicro * quantity * purityMicro) / (99 * _Decimal.scale)).round()
      : 0;

  OrderCreateItem toOrderItem() => OrderCreateItem(
    variantId: variant.id,
    quantity: quantity,
    unitPrice: unitPrice,
    metalDetails: isGold
        ? {
            'metalType': 'gold',
            'purity': _Decimal.formatMicro(purityMicro),
            'basePurity': 99,
            'grossWeight': _Decimal.formatMicro(grossMicro),
            'stoneWeight': _Decimal.formatMicro(stoneMicro),
            'netWeight': _Decimal.formatMicro(netMicro),
            'unit': 'chỉ',
            'conv99': _Decimal.formatMicro(gold99Micro),
          }
        : null,
  );
}

class _TradeInLine {
  const _TradeInLine({
    required this.name,
    required this.purityMicro,
    required this.grossMicro,
    required this.stoneMicro,
  });
  final String name;
  final int purityMicro;
  final int grossMicro;
  final int stoneMicro;
  int get netMicro => grossMicro - stoneMicro;
  int get gold99Micro =>
      ((netMicro * purityMicro) / (99 * _Decimal.scale)).round();
  Map<String, dynamic> toJson() => {
    'name': name,
    'purity': _Decimal.formatMicro(purityMicro),
    'grossWeight': _Decimal.formatMicro(grossMicro),
    'stoneWeight': _Decimal.formatMicro(stoneMicro),
    'weight': _Decimal.formatMicro(netMicro),
    'conv99': _Decimal.formatMicro(gold99Micro),
  };
}

class _Decimal {
  static const scale = 1000000;

  static int? parseMicro(String value) {
    final normalized = value.trim().replaceAll(',', '.');
    if (!RegExp(r'^-?\d+(\.\d{0,6})?$').hasMatch(normalized)) return null;
    final negative = normalized.startsWith('-');
    final parts = (negative ? normalized.substring(1) : normalized).split('.');
    final whole = int.tryParse(parts.first);
    if (whole == null) return null;
    final fraction = parts.length == 1 ? '' : parts[1];
    final result =
        whole * scale + int.parse('${fraction}000000'.substring(0, 6));
    return negative ? -result : result;
  }

  static String formatMicro(int value) {
    final sign = value < 0 ? '-' : '';
    final absolute = value.abs();
    final fraction = (absolute % scale)
        .toString()
        .padLeft(6, '0')
        .replaceFirst(RegExp(r'0+$'), '');
    return '$sign${absolute ~/ scale}${fraction.isEmpty ? '' : '.$fraction'}';
  }
}

int _parseVnd(String value) =>
    int.tryParse(value.replaceAll(RegExp(r'[^0-9-]'), '')) ?? 0;
