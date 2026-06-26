import type { XianyuAccountOverview } from '@shared/types'
import { getSaleProfit } from '@shared/sale'
import type { DatePreset } from '@/utils/date'
import { formatRangeQuery, getDateRange, isAllTimePreset } from '@/utils/date'
import { supabase } from '@/lib/supabase'

function createEmptyOverview(accountId: string | null, accountName: string): XianyuAccountOverview {
  return {
    account_id: accountId,
    account_name: accountName,
    total_sales_amount: 0,
    total_profit: 0,
    active_count: 0,
    sold_out_count: 0,
    inactive_count: 0,
    total_investment: 0,
    avg_sell_price: 0,
    own_count: 0,
    purchase_count: 0,
    total_purchase_cost: 0,
  }
}

export async function fetchXianyuAccountOverview(
  preset: DatePreset,
  customRange?: [string, string],
): Promise<{ rows: XianyuAccountOverview[]; rangeLabel: string }> {
  const range = getDateRange(preset, customRange)
  const allTime = isAllTimePreset(preset)
  const { startDate, endDate } = formatRangeQuery(range)

  let salesQuery = supabase
    .from('sales')
    .select('account_id, sale_amount, profit, order_status')
    .eq('channel', 'xianyu')
  if (!allTime) {
    salesQuery = salesQuery.gte('sold_at', startDate).lte('sold_at', endDate)
  }

  let investmentsQuery = supabase.from('account_traffic_investments').select('account_id, amount')
  if (!allTime) {
    investmentsQuery = investmentsQuery.gte('invested_at', startDate).lte('invested_at', endDate)
  }

  const [accountsRes, productsRes, salesRes, investmentsRes, allSalesRes] = await Promise.all([
    supabase.from('seller_accounts').select('id, name').eq('platform', 'xianyu').eq('is_active', true),
    supabase
      .from('products')
      .select('id, account_id, status, source_type, skus:product_skus(sell_price, cost_price, stock)'),
    salesQuery,
    investmentsQuery,
    supabase.from('sales').select('product_id, account_id').eq('channel', 'xianyu').not('account_id', 'is', null),
  ])

  if (accountsRes.error) throw accountsRes.error
  if (productsRes.error) throw productsRes.error
  if (salesRes.error) throw salesRes.error
  if (investmentsRes.error) throw investmentsRes.error
  if (allSalesRes.error) throw allSalesRes.error

  const grouped = new Map<string | null, XianyuAccountOverview>()

  for (const account of accountsRes.data ?? []) {
    grouped.set(account.id, createEmptyOverview(account.id, account.name))
  }
  grouped.set(null, createEmptyOverview(null, '未分配账号'))

  const productAccountMap = new Map<string, string>()
  for (const sale of allSalesRes.data ?? []) {
    if (sale.account_id && sale.product_id) {
      productAccountMap.set(sale.product_id, sale.account_id)
    }
  }

  for (const product of productsRes.data ?? []) {
    const effectiveAccountId =
      (product.account_id as string | null) ?? productAccountMap.get(product.id) ?? null
    const current = grouped.get(effectiveAccountId) ?? createEmptyOverview(effectiveAccountId, '未分配账号')
    if (effectiveAccountId !== null && !grouped.has(effectiveAccountId)) {
      grouped.set(effectiveAccountId, current)
    }

    const status = product.status as string
    if (status === 'active') current.active_count += 1
    else if (status === 'sold_out') current.sold_out_count += 1
    else if (status === 'inactive') current.inactive_count += 1

    const sourceType = (product.source_type ?? 'own') as string
    if (sourceType === 'own') {
      current.own_count += 1
    } else if (sourceType === 'purchase') {
      current.purchase_count += 1
      const skus = (product.skus ?? []) as Array<{ cost_price: number; stock: number }>
      for (const sku of skus) {
        const cost = Number(sku.cost_price)
        const stock = Number(sku.stock)
        const quantity = stock > 0 ? stock : 1
        current.total_purchase_cost += cost * quantity
      }
    }

    grouped.set(effectiveAccountId, current)
  }

  for (const row of salesRes.data ?? []) {
    const key = row.account_id as string | null
    const current = grouped.get(key) ?? createEmptyOverview(key, '未分配账号')
    current.total_sales_amount += Number(row.sale_amount)
    current.total_profit += getSaleProfit(row)
    grouped.set(key, current)
  }

  for (const row of investmentsRes.data ?? []) {
    const key = row.account_id as string
    const current = grouped.get(key)
    if (current) {
      current.total_investment += Number(row.amount)
    }
  }

  const sellPriceBuckets = new Map<string | null, number[]>()
  for (const product of productsRes.data ?? []) {
    const effectiveAccountId =
      (product.account_id as string | null) ?? productAccountMap.get(product.id) ?? null
    const skus = (product.skus ?? []) as Array<{ sell_price: number }>
    const prices = skus.map((sku) => Number(sku.sell_price)).filter((p) => p > 0)
    if (prices.length === 0) continue
    const productAvg = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const bucket = sellPriceBuckets.get(effectiveAccountId) ?? []
    bucket.push(productAvg)
    sellPriceBuckets.set(effectiveAccountId, bucket)
  }

  for (const [key, prices] of sellPriceBuckets) {
    const current = grouped.get(key)
    if (current && prices.length > 0) {
      current.avg_sell_price = prices.reduce((sum, p) => sum + p, 0) / prices.length
    }
  }

  const rows = [...grouped.values()]
    .filter(
      (row) =>
        row.account_id !== null ||
        row.active_count + row.sold_out_count + row.inactive_count > 0 ||
        row.total_profit > 0,
    )
    .sort((a, b) => {
      if (a.account_id === null) return 1
      if (b.account_id === null) return -1
      return b.total_profit - a.total_profit
    })

  return { rows, rangeLabel: range.label }
}

export function getAccountNetProfit(
  row: Pick<XianyuAccountOverview, 'total_profit' | 'total_investment' | 'total_purchase_cost'>,
) {
  return row.total_profit - row.total_investment - row.total_purchase_cost
}
