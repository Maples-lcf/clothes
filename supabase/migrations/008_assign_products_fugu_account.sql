-- 将已有商品归属到「复古研究所」闲鱼账号
-- 若账号不存在则自动创建

INSERT INTO seller_accounts (name, platform, is_active)
SELECT '复古研究所', 'xianyu', true
WHERE NOT EXISTS (
  SELECT 1 FROM seller_accounts WHERE name = '复古研究所' AND platform = 'xianyu'
);

UPDATE products
SET account_id = (
  SELECT id FROM seller_accounts
  WHERE name = '复古研究所' AND platform = 'xianyu'
  LIMIT 1
);
