import type { ProductSourceType, ProductStatus } from '@shared/types'

export interface ProductFormData {
  category_id: string | null
  account_id: string | null
  name: string
  description: string | null
  images: string[]
  original_images: string[]
  xianyu_link: string | null
  status: ProductStatus
  source_type: ProductSourceType
  is_new_arrival: boolean
  listed_at: string | null
  skus: Array<{
    color: string
    size: string
    cost_price: number
    sell_price: number
    stock: number
    low_stock_threshold: number
  }>
}
