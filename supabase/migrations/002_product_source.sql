-- 商品来源：自有闲置（成本为 0）/ 进货（有进价）
-- 在 Supabase SQL Editor 中执行（已有数据库跑此文件即可）

CREATE TYPE product_source_type AS ENUM ('own', 'purchase');

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_type product_source_type NOT NULL DEFAULT 'own';

COMMENT ON COLUMN products.source_type IS 'own=自有闲置(成本0), purchase=进货';

-- 已有商品默认视为自有闲置，可按需在后台改为进货
UPDATE products SET source_type = 'own' WHERE source_type IS NULL;
