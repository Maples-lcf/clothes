-- 闲鱼等多平台售卖账号
-- 在 Supabase SQL Editor 中执行

CREATE TABLE seller_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform sales_channel NOT NULL DEFAULT 'xianyu',
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES seller_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_account ON sales(account_id);
CREATE INDEX IF NOT EXISTS idx_seller_accounts_platform ON seller_accounts(platform);

ALTER TABLE seller_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_seller_accounts" ON seller_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE seller_accounts IS '售卖账号，如多个闲鱼号';
COMMENT ON COLUMN sales.account_id IS '成交所用账号，闲鱼销售建议必填';
