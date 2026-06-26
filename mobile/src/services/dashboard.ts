import dayjs from 'dayjs'
import type { DashboardStats } from '@shared/types'
import { getSaleProfit } from '@shared/sale'
import { supabase } from '@/lib/supabase'

async function fetchMonthSummary() {
  const now = dayjs()
  const startDate = now.startOf('month').format('YYYY-MM-DD')
  const endDate = now.endOf('month').format('YYYY-MM-DD')

  const { data, error } = await supabase
    .from('sales')
    .select('sale_amount, profit, quantity, order_status')
    .gte('sold_at', startDate)
    .lte('sold_at', endDate)

  if (error) throw error

  const rows = data ?? []
  const totalSales = rows.reduce((sum, row) => sum + Number(row.sale_amount), 0)
  const totalProfit = rows.reduce((sum, row) => sum + getSaleProfit(row), 0)
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0)
  const profitRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  return { totalSales, totalProfit, totalQuantity, profitRate }
}

export type HomeDashboardStats = Pick<
  DashboardStats,
  'productCount' | 'skuCount' | 'totalStock' | 'monthSales' | 'monthProfit' | 'monthProfitRate'
> & {
  monthQuantity: number
}

export async function fetchHomeDashboardStats(): Promise<HomeDashboardStats> {
  const [productsRes, skusRes, monthSummary] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('product_skus').select('stock'),
    fetchMonthSummary(),
  ])

  if (productsRes.error) throw productsRes.error
  if (skusRes.error) throw skusRes.error

  const skus = skusRes.data ?? []
  const totalStock = skus.reduce((sum, sku) => sum + sku.stock, 0)

  return {
    productCount: productsRes.count ?? 0,
    skuCount: skus.length,
    totalStock,
    monthSales: monthSummary.totalSales,
    monthProfit: monthSummary.totalProfit,
    monthProfitRate: monthSummary.profitRate,
    monthQuantity: monthSummary.totalQuantity,
  }
}
