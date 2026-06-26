/** 前后端共享类型 — 后期小程序可直接复用此文件 */

export type ProductStatus = 'active' | 'sold_out' | 'inactive'
export type ProductSourceType = 'own' | 'purchase'
export type SalesChannel = 'xianyu' | 'wechat' | 'douyin' | 'other'
export type SaleOrderStatus = 'success' | 'refunded'
export type StockLogType = 'in' | 'out' | 'adjust' | 'sale'

export interface Category {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export interface SellerAccount {
  id: string
  name: string
  platform: SalesChannel
  note: string | null
  is_active: boolean
  created_at: string
}

export interface AccountTrafficInvestment {
  id: string
  account_id: string
  amount: number
  invested_at: string
  note: string | null
  created_at: string
  account?: SellerAccount | null
}

export interface Product {
  id: string
  category_id: string | null
  account_id: string | null
  name: string
  code: string
  description: string | null
  /** 展示/上架用图（可含 AI 生成图） */
  images: string[]
  /** 拍摄或上传的原始图，AI 出图不会覆盖 */
  original_images: string[]
  xianyu_link: string | null
  status: ProductStatus
  source_type: ProductSourceType
  is_new_arrival: boolean
  listed_at: string | null
  created_at: string
  updated_at: string
  category?: Category | null
  account?: SellerAccount | null
  skus?: ProductSku[]
}

export interface ProductSku {
  id: string
  product_id: string
  color: string
  size: string
  cost_price: number
  sell_price: number
  stock: number
  low_stock_threshold: number
  created_at: string
  updated_at: string
  product?: Product | null
}

export interface StockLog {
  id: string
  sku_id: string
  type: StockLogType
  quantity: number
  note: string | null
  ref_id: string | null
  created_at: string
  sku?: ProductSku | null
}

export interface Sale {
  id: string
  sku_id: string
  product_id: string
  account_id: string | null
  channel: SalesChannel
  quantity: number
  sale_amount: number
  unit_cost: number
  platform_fee: number
  shipping_fee: number
  other_fee: number
  profit: number
  sold_at: string
  note: string | null
  order_status: SaleOrderStatus
  created_at: string
  sku?: ProductSku | null
  product?: Product | null
  account?: SellerAccount | null
}

export interface AccountPerformance {
  account_id: string | null
  account_name: string
  order_count: number
  total_quantity: number
  total_amount: number
  total_profit: number
  profit_rate: number
  avg_order_amount: number
  tags: string[]
  suggestions: string[]
}

/** 闲鱼账号数据概览（首页 / 账号分析） */
export interface XianyuAccountOverview {
  account_id: string | null
  account_name: string
  total_sales_amount: number
  total_profit: number
  active_count: number
  sold_out_count: number
  inactive_count: number
  total_investment: number
  avg_sell_price: number
  own_count: number
  purchase_count: number
  total_purchase_cost: number
}

export interface DashboardStats {
  productCount: number
  skuCount: number
  totalStock: number
  inventoryValue: number
  monthSales: number
  monthProfit: number
  monthProfitRate: number
  lowStockSkus: ProductSku[]
  recentSales: Sale[]
}

export const PRODUCT_STATUS_MAP: Record<ProductStatus, string> = {
  active: '在售',
  inactive: '主动下架',
  sold_out: '售出下架',
}

export const PRODUCT_SOURCE_MAP: Record<ProductSourceType, string> = {
  own: '自有闲置',
  purchase: '进货',
}

export const PRODUCT_SOURCE_HINT: Record<ProductSourceType, string> = {
  own: '自己以前买的衣服，进价填 0，卖出后利润 ≈ 成交额 - 平台费',
  purchase: '从批发市场/厂家拿货，需填写进价和售价',
}

export const SALES_CHANNEL_MAP: Record<SalesChannel, string> = {
  xianyu: '闲鱼',
  wechat: '微信',
  douyin: '抖音',
  other: '其他',
}

export const SALE_ORDER_STATUS_MAP: Record<SaleOrderStatus, string> = {
  success: '成功',
  refunded: '有退款',
}

export const STOCK_LOG_TYPE_MAP: Record<StockLogType, string> = {
  in: '入库',
  out: '出库',
  adjust: '调整',
  sale: '销售',
}
