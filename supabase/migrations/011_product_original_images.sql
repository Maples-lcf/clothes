-- 商品原图：与展示图（images）分离，AI 出图不覆盖原图
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS original_images TEXT[] NOT NULL DEFAULT '{}';

-- 历史数据：现有 images 视为原图
UPDATE products
SET original_images = images
WHERE original_images = '{}'
  AND images <> '{}';
