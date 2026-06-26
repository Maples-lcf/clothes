import type { SalesChannel, SaleOrderStatus } from '@shared/types'
import { supabase } from '@/lib/supabase'
import { markProductSoldOut } from './products'

export interface SaleFormData {
  sku_id: string
  channel: SalesChannel
  account_id: string | null
  quantity: number
  sale_amount: number
  unit_cost: number
  platform_fee: number
  shipping_fee: number
  other_fee: number
  sold_at: string
  note: string | null
  order_status: SaleOrderStatus
}

export async function createSale(form: SaleFormData) {
  const { data: sku, error: skuError } = await supabase
    .from('product_skus')
    .select('product_id, stock, cost_price')
    .eq('id', form.sku_id)
    .single()

  if (skuError) throw skuError
  if (sku.stock < form.quantity) {
    throw new Error(`库存不足，当前仅剩 ${sku.stock} 件`)
  }
  if (form.channel === 'xianyu' && !form.account_id) {
    throw new Error('请选择闲鱼账号')
  }

  const { data, error } = await supabase
    .from('sales')
    .insert({
      ...form,
      product_id: sku.product_id,
      unit_cost: form.unit_cost || sku.cost_price,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** 售出下架：记销售 + 商品改售出下架 */
export async function soldAndDelist(form: SaleFormData, productId: string) {
  const sale = await createSale(form)
  await markProductSoldOut(productId)
  return sale
}

export async function fetchMonthSummary() {
  const now = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const end = now.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('sales')
    .select('quantity, profit, order_status')
    .gte('sold_at', start)
    .lte('sold_at', end)

  if (error) throw error

  const rows = data ?? []
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0)
  const totalProfit = rows.reduce(
    (sum, row) => sum + (row.order_status === 'refunded' ? 0 : Number(row.profit)),
    0,
  )

  return { totalQuantity, totalProfit }
}
