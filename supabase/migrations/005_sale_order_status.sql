-- 销售订单状态
CREATE TYPE sale_order_status AS ENUM ('success', 'refunded');

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS order_status sale_order_status NOT NULL DEFAULT 'success';

COMMENT ON COLUMN sales.order_status IS '订单状态：成功/有退款';
