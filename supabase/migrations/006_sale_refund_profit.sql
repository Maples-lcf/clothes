-- 有退款订单利润计为 0
ALTER TABLE sales DROP COLUMN profit;

ALTER TABLE sales
  ADD COLUMN profit NUMERIC(10, 2) GENERATED ALWAYS AS (
    CASE
      WHEN order_status = 'refunded'::sale_order_status THEN 0
      ELSE sale_amount - unit_cost * quantity - platform_fee - shipping_fee - other_fee
    END
  ) STORED;

COMMENT ON COLUMN sales.profit IS '利润；有退款时为 0';
