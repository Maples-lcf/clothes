import dayjs from 'dayjs'
import type { DashboardStats } from '@shared/types'
import { supabase } from '@/lib/supabase'
import { fetchLowStockSkus } from '@/services/inventory'
import { fetchSalesSummary } from '@/services/sales'

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
  const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD')

  const [
    productsRes,
    skusRes,
    monthSummary,
    lowStockSkus,
    recentSalesRes,
  ] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('product_skus').select('stock, cost_price'),
    fetchSalesSummary(monthStart, monthEnd),
    fetchLowStockSkus(),
    supabase
      .from('sales')
      .select(`
        *,
        sku:product_skus(*, product:products(name))
      `)
      .order('sold_at', { ascending: false })
      .limit(8),
  ])

  if (productsRes.error) throw productsRes.error
  if (skusRes.error) throw skusRes.error
  if (recentSalesRes.error) throw recentSalesRes.error

  const skus = skusRes.data ?? []
  const totalStock = skus.reduce((sum, sku) => sum + sku.stock, 0)
  const inventoryValue = skus.reduce(
    (sum, sku) => sum + sku.stock * Number(sku.cost_price),
    0,
  )

  return {
    productCount: productsRes.count ?? 0,
    skuCount: skus.length,
    totalStock,
    inventoryValue,
    monthSales: monthSummary.totalSales,
    monthProfit: monthSummary.totalProfit,
    monthProfitRate: monthSummary.profitRate,
    lowStockSkus: lowStockSkus.slice(0, 8),
    recentSales: recentSalesRes.data ?? [],
  }
}
