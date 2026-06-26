-- 商品闲鱼链接
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS xianyu_link TEXT;

COMMENT ON COLUMN products.xianyu_link IS '闲鱼商品链接';
