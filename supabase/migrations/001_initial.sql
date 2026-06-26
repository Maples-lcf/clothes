-- 衣服卖货管理 · 初始数据库结构
-- 在 Supabase Dashboard → SQL Editor 中执行此文件

-- ========== 枚举类型 ==========
CREATE TYPE product_status AS ENUM ('active', 'sold_out', 'inactive');
CREATE TYPE product_source_type AS ENUM ('own', 'purchase');
CREATE TYPE sales_channel AS ENUM ('xianyu', 'wechat', 'douyin', 'other');
CREATE TYPE stock_log_type AS ENUM ('in', 'out', 'adjust', 'sale');

-- ========== 分类 ==========
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 商品 SPU ==========
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  status product_status NOT NULL DEFAULT 'active',
  source_type product_source_type NOT NULL DEFAULT 'own',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== SKU（颜色 + 尺码 + 库存） ==========
CREATE TABLE product_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT '均色',
  size TEXT NOT NULL DEFAULT '均码',
  cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, color, size)
);

-- ========== 库存变动记录 ==========
CREATE TABLE stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  type stock_log_type NOT NULL,
  quantity INT NOT NULL,
  note TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 销售记录（闲鱼等渠道手动录入） ==========
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  channel sales_channel NOT NULL DEFAULT 'xianyu',
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sale_amount NUMERIC(10, 2) NOT NULL,
  unit_cost NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  other_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(10, 2) GENERATED ALWAYS AS (
    sale_amount - unit_cost * quantity - platform_fee - shipping_fee - other_fee
  ) STORED,
  sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 索引 ==========
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_skus_product ON product_skus(product_id);
CREATE INDEX idx_skus_stock ON product_skus(stock);
CREATE INDEX idx_sales_sold_at ON sales(sold_at DESC);
CREATE INDEX idx_sales_channel ON sales(channel);
CREATE INDEX idx_stock_logs_sku ON stock_logs(sku_id);

-- ========== 更新时间触发器 ==========
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER product_skus_updated_at
  BEFORE UPDATE ON product_skus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========== 销售出库：自动扣库存 + 写日志 ==========
CREATE OR REPLACE FUNCTION handle_sale_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INT;
BEGIN
  SELECT stock INTO current_stock FROM product_skus WHERE id = NEW.sku_id FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'SKU 不存在';
  END IF;

  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION '库存不足，当前库存 %，需要 %', current_stock, NEW.quantity;
  END IF;

  UPDATE product_skus
  SET stock = stock - NEW.quantity
  WHERE id = NEW.sku_id;

  INSERT INTO stock_logs (sku_id, type, quantity, note, ref_id)
  VALUES (NEW.sku_id, 'sale', -NEW.quantity, '销售出库', NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_after_insert
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION handle_sale_insert();

-- ========== 商品图片 Storage ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- ========== RLS ==========
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 管理后台：登录用户可读写全部
CREATE POLICY "auth_all_categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_skus" ON product_skus FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_stock_logs" ON stock_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_sales" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 小程序预留：匿名用户只能读上架且有库存的商品（后期 uni-app 直接用 anon key）
CREATE POLICY "public_read_active_products" ON products
  FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY "public_read_in_stock_skus" ON product_skus
  FOR SELECT TO anon
  USING (
    stock > 0
    AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_skus.product_id AND p.status = 'active'
    )
  );

-- Storage 策略
CREATE POLICY "auth_upload_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "auth_update_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "auth_delete_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "public_read_images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- ========== 默认分类 ==========
INSERT INTO categories (name, sort_order) VALUES
  ('上衣', 1),
  ('裤子', 2),
  ('裙子', 3),
  ('外套', 4),
  ('配饰', 5);
