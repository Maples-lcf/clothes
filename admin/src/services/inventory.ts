import type { ProductSku, StockLog, StockLogType } from '@shared/types'
import { supabase } from '@/lib/supabase'

export async function fetchAllSkus() {
  const { data, error } = await supabase
    .from('product_skus')
    .select(`
      *,
      product:products(id, name, status, images)
    `)
    .order('stock', { ascending: true })

  if (error) throw error
  return data as ProductSku[]
}

export async function fetchStockLogs(limit = 50) {
  const { data, error } = await supabase
    .from('stock_logs')
    .select(`
      *,
      sku:product_skus(*, product:products(name))
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as StockLog[]
}

export async function adjustStock(
  skuId: string,
  type: StockLogType,
  quantity: number,
  note?: string,
) {
  const absQty = Math.abs(quantity)
  if (absQty <= 0) throw new Error('数量必须大于 0')

  const { data: sku, error: skuError } = await supabase
    .from('product_skus')
    .select('stock')
    .eq('id', skuId)
    .single()

  if (skuError) throw skuError

  let delta = 0
  if (type === 'in') delta = absQty
  else if (type === 'out') delta = -absQty
  else if (type === 'adjust') delta = quantity
  else throw new Error('不支持的操作类型')

  const nextStock = sku.stock + delta
  if (nextStock < 0) throw new Error('库存不能为负数')

  const { error: updateError } = await supabase
    .from('product_skus')
    .update({ stock: nextStock })
    .eq('id', skuId)

  if (updateError) throw updateError

  const { error: logError } = await supabase.from('stock_logs').insert({
    sku_id: skuId,
    type,
    quantity: delta,
    note: note ?? null,
  })

  if (logError) throw logError

  return nextStock
}

export async function fetchLowStockSkus() {
  const { data, error } = await supabase
    .from('product_skus')
    .select(`
      *,
      product:products(id, name, status)
    `)
    .order('stock', { ascending: true })

  if (error) throw error

  return (data as ProductSku[]).filter(
    (sku) => sku.stock <= sku.low_stock_threshold && sku.product?.status === 'active',
  )
}

export async function fetchInventoryStats() {
  const skus = await fetchAllSkus()
  const totalStock = skus.reduce((sum, sku) => sum + sku.stock, 0)
  const inventoryValue = skus.reduce((sum, sku) => sum + sku.stock * Number(sku.cost_price), 0)
  const lowStockCount = skus.filter((sku) => sku.stock <= sku.low_stock_threshold).length

  return { totalStock, inventoryValue, skuCount: skus.length, lowStockCount }
}
