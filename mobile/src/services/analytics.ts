import { getSaleProfit } from '@shared/sale'
import type { DatePreset } from '@/utils/date'
import { eachDayInRange, formatChartLabel, formatRangeQuery, getDateRange } from '@/utils/date'
import { supabase } from '@/lib/supabase'

export interface SalesAnalyticsSummary {
  totalQuantity: number
  totalAmount: number
  totalProfit: number
}

export interface SalesAnalyticsPoint {
  date: string
  label: string
  quantity: number
  amount: number
  profit: number
}

export interface SalesAnalytics {
  summary: SalesAnalyticsSummary
  points: SalesAnalyticsPoint[]
  rangeLabel: string
}

export async function fetchSalesAnalytics(
  preset: DatePreset,
  customRange?: [string, string],
): Promise<SalesAnalytics> {
  const range = getDateRange(preset, customRange)
  const { startDate, endDate } = formatRangeQuery(range)

  const { data, error } = await supabase
    .from('sales')
    .select('sold_at, quantity, sale_amount, profit, order_status')
    .gte('sold_at', startDate)
    .lte('sold_at', endDate)

  if (error) throw error

  const grouped = new Map<string, { quantity: number; amount: number; profit: number }>()

  for (const row of data ?? []) {
    const date = row.sold_at as string
    const current = grouped.get(date) ?? { quantity: 0, amount: 0, profit: 0 }
    current.quantity += Number(row.quantity)
    current.amount += Number(row.sale_amount)
    current.profit += getSaleProfit(row)
    grouped.set(date, current)
  }

  const points = eachDayInRange(range).map((date) => {
    const item = grouped.get(date) ?? { quantity: 0, amount: 0, profit: 0 }
    return {
      date,
      label: formatChartLabel(date, preset),
      quantity: item.quantity,
      amount: item.amount,
      profit: item.profit,
    }
  })

  const summary = points.reduce(
    (acc, point) => ({
      totalQuantity: acc.totalQuantity + point.quantity,
      totalAmount: acc.totalAmount + point.amount,
      totalProfit: acc.totalProfit + point.profit,
    }),
    { totalQuantity: 0, totalAmount: 0, totalProfit: 0 },
  )

  return {
    summary,
    points,
    rangeLabel: range.label,
  }
}
