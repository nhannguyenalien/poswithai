BEGIN;

SET LOCAL search_path = public;

-- Một khoản thu có thể gồm tiền toa hiện tại và phần đối trừ công nợ cũ.
-- Vì công nợ khách được tính bằng SUM(order.total - payments.amount), khoản thu
-- vượt tổng toa sẽ tự làm giảm nợ cũ hoặc tạo số dư âm (tiệm nợ lại khách).
CREATE OR REPLACE FUNCTION create_payment_atomic(
  p_id TEXT,
  p_tenant_id TEXT,
  p_order_id TEXT,
  p_method TEXT,
  p_amount INTEGER,
  p_reference_no TEXT,
  p_now TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  target_order orders%ROWTYPE;
  already_paid BIGINT;
  new_paid BIGINT;
  remaining BIGINT;
  settled BOOLEAN;
BEGIN
  SELECT * INTO target_order
  FROM orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ORDER_NOT_FOUND';
  END IF;
  IF target_order.status = 'cancelled' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ORDER_CANCELLED';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO already_paid
  FROM payments
  WHERE order_id = p_order_id AND status = 'completed';

  IF target_order.total >= 0 AND p_amount <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PAYMENT_MUST_BE_POSITIVE';
  END IF;
  IF target_order.total < 0 AND p_amount >= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'REFUND_MUST_BE_NEGATIVE';
  END IF;

  INSERT INTO payments (id, tenant_id, order_id, method, amount, status, payment_date, reference_no, created_at)
  VALUES (p_id, p_tenant_id, p_order_id, p_method, p_amount, 'completed', p_now, NULLIF(p_reference_no, ''), p_now);

  new_paid := already_paid + p_amount;
  remaining := target_order.total - new_paid;
  settled := CASE WHEN target_order.total >= 0 THEN remaining <= 0 ELSE remaining >= 0 END;

  IF settled THEN
    UPDATE orders SET status = 'completed', updated_at = p_now
    WHERE id = p_order_id AND tenant_id = p_tenant_id;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', p_id,
    'paid_total', new_paid,
    'remaining', remaining,
    'order_completed', settled,
    'customer_id', target_order.customer_id
  );
END;
$$;

COMMIT;
