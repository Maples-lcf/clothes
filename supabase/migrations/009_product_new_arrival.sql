-- 商品上新标记与上架日期
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listed_at DATE;

CREATE INDEX IF NOT EXISTS idx_products_listed_at ON products(listed_at DESC NULLS LAST);

COMMENT ON COLUMN products.is_new_arrival IS '是否标记为上新（列表仅当天上架时展示标签）';
COMMENT ON COLUMN products.listed_at IS '上架日期，标记为上新时自动设为当天';
