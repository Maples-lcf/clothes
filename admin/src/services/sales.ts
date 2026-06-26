import type { ProductSku, Sale, SalesChannel, SaleOrderStatus } from '@shared/types'
import { getSaleProfit } from '@shared/sale'
import { supabase } from '@/lib/supabase'

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

export interface SaleUpdateData {
  sale_amount: number
  platform_fee: number
  shipping_fee: number
  account_id: string | null
  order_status: SaleOrderStatus
  sold_at: string
}

export async function fetchSales() {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      sku:product_skus(*, product:products(*)),
      account:seller_accounts(id, name, platform)
    `)
    .order('sold_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Sale[]
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
    throw new Error('闲鱼销售请选择成交账号')
  }

  const { data, error } = await supabase
    .from('sales')
    .insert({
      ...form,
      product_id: sku.product_id,
      unit_cost: form.unit_cost || sku.cost_price,
    })
    .select(`
      *,
      sku:product_skus(*, product:products(*)),
      account:seller_accounts(id, name, platform)
    `)
    .single()

  if (error) throw error
  return data as Sale
}

export async function updateSale(id: string, data: SaleUpdateData, channel: SalesChannel) {
  if (channel === 'xianyu' && !data.account_id) {
    throw new Error('闲鱼销售请选择成交账号')
  }

  const { data: sale, error } = await supabase
    .from('sales')
    .update({
      sale_amount: data.sale_amount,
      platform_fee: data.platform_fee,
      shipping_fee: data.shipping_fee,
      account_id: channel === 'xianyu' ? data.account_id : null,
      order_status: data.order_status,
      sold_at: data.sold_at,
    })
    .eq('id', id)
    .select(`
      *,
      sku:product_skus(*, product:products(*)),
      account:seller_accounts(id, name, platform)
    `)
    .single()

  if (error) throw error
  return sale as Sale
}

export async function deleteSale(id: string) {
  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) throw error
}

export async function fetchSkuOptions() {
  const { data, error } = await supabase
    .from('product_skus')
    .select(`
      *,
      product:products(id, name, status, source_type)
    `)
    .gt('stock', 0)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as ProductSku[]).filter((sku) => sku.product?.status === 'active')
}

export async function fetchAllSkuOptions() {
  const { data, error } = await supabase
    .from('product_skus')
    .select(`
      *,
      product:products(id, name, status, source_type)
    `)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as ProductSku[]).filter((sku) => sku.product?.status === 'active')
}

export interface ImportSalesResult {
  success: number
  failed: Array<{ row: number; message: string }>
}

export async function importSales(
  rows: Array<{ row: number; data: SaleFormData }>,
): Promise<ImportSalesResult> {
  const result: ImportSalesResult = { success: 0, failed: [] }

  for (const { row, data } of rows) {
    try {
      await createSale(data)
      result.success++
    } catch (error) {
      result.failed.push({
        row,
        message: error instanceof Error ? error.message : '导入失败',
      })
    }
  }

  return result
}

export async function fetchSalesSummary(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('sale_amount, profit, channel, order_status')
    .gte('sold_at', startDate)
    .lte('sold_at', endDate)

  if (error) throw error

  const rows = data ?? []
  const totalSales = rows.reduce((sum, row) => sum + Number(row.sale_amount), 0)
  const totalProfit = rows.reduce((sum, row) => sum + getSaleProfit(row), 0)
  const profitRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  return { totalSales, totalProfit, profitRate, count: rows.length }
}
