-- 商品货号：CF + 6 位流水号（如 CF000001），全局唯一，插入时自动生成
-- 规则：前缀 CF（Clothes），后接 6 位递增数字，由序列 product_code_seq 分配

CREATE SEQUENCE IF NOT EXISTS product_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION format_product_code(seq_val BIGINT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'CF' || lpad(seq_val::text, 6, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS TEXT AS $$
BEGIN
  RETURN format_product_code(nextval('product_code_seq'));
END;
$$ LANGUAGE plpgsql;

-- 为现有商品按创建时间补全唯一货号
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM products
)
UPDATE products p
SET code = format_product_code(n.rn)
FROM numbered n
WHERE p.id = n.id;

SELECT setval(
  'product_code_seq',
  GREATEST(
    (SELECT COUNT(*)::BIGINT FROM products),
    1
  )
);

ALTER TABLE products
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_unique ON products(code);

COMMENT ON COLUMN products.code IS '商品货号，格式 CF000001，系统自动生成不可修改';

CREATE OR REPLACE FUNCTION set_product_code_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := generate_product_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_set_code_before_insert ON products;
CREATE TRIGGER products_set_code_before_insert
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION set_product_code_on_insert();

CREATE OR REPLACE FUNCTION lock_product_code_on_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := OLD.code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_lock_code_on_update ON products;
CREATE TRIGGER products_lock_code_on_update
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION lock_product_code_on_update();
