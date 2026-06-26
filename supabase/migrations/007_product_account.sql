-- 商品关联闲鱼售卖账号
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES seller_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_account ON products(account_id);

COMMENT ON COLUMN products.account_id IS '闲鱼售卖账号，用于按账号统计商品数据';
