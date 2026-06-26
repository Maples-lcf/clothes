-- 闲鱼账号流量投入记录（买曝光/推广等）
-- 在 Supabase SQL Editor 中执行

CREATE TABLE account_traffic_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES seller_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  invested_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_traffic_investments_account
  ON account_traffic_investments(account_id);

CREATE INDEX IF NOT EXISTS idx_account_traffic_investments_invested_at
  ON account_traffic_investments(invested_at DESC);

ALTER TABLE account_traffic_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_account_traffic_investments" ON account_traffic_investments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE account_traffic_investments IS '闲鱼账号流量投入记录，如购买曝光推广';
COMMENT ON COLUMN account_traffic_investments.amount IS '本次投入金额（元）';
COMMENT ON COLUMN account_traffic_investments.invested_at IS '投入日期';
