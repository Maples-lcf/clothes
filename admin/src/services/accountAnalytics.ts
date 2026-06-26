import type { AccountPerformance, XianyuAccountOverview } from '@shared/types'
import { getSaleProfit } from '@shared/sale'
import type { DatePreset } from '@/utils/date'
import { formatRangeQuery, getDateRange, isAllTimePreset } from '@/utils/date'
import { supabase } from '@/lib/supabase'

function buildAccountInsights(rows: AccountPerformance[]): AccountPerformance[] {
  if (rows.length === 0) return rows

  const activeRows = rows.filter((row) => row.order_count > 0)
  if (activeRows.length === 0) return rows

  const avgOrders = activeRows.reduce((sum, row) => sum + row.order_count, 0) / activeRows.length
  const avgProfit = activeRows.reduce((sum, row) => sum + row.total_profit, 0) / activeRows.length
  const avgProfitRate =
    activeRows.reduce((sum, row) => sum + row.profit_rate, 0) / activeRows.length

  const topProfit = Math.max(...activeRows.map((row) => row.total_profit))
  const topAmount = Math.max(...activeRows.map((row) => row.total_amount))

  return rows.map((row) => {
    const tags: string[] = []
    const suggestions: string[] = []

    if (row.order_count === 0) {
      suggestions.push('该时段暂无成交，可增加上新或优化标题')
      return { ...row, tags, suggestions }
    }

    if (row.total_profit === topProfit && row.total_profit > 0) tags.push('利润冠军')
    if (row.total_amount === topAmount && row.total_amount > 0) tags.push('成交额最高')
    if (row.profit_rate >= avgProfitRate + 5) tags.push('利润率高')
    if (row.order_count >= avgOrders * 1.2) tags.push('出单活跃')

    if (row.order_count < avgOrders * 0.6) {
      tags.push('出单偏少')
      suggestions.push('出单量低于平均水平，建议增加曝光或调整定价')
    }
    if (row.total_profit < avgProfit * 0.6 && row.order_count > 0) {
      tags.push('利润偏低')
      suggestions.push('利润低于平均水平，检查定价、进价或货源结构')
    }
    if (row.profit_rate < avgProfitRate - 8) {
      suggestions.push('利润率偏低，可适当提高售价或优先卖自有闲置款')
    }
    if (row.avg_order_amount < 50 && row.order_count >= 2) {
      suggestions.push('客单价较低，可尝试搭配销售或推更高单价商品')
    }
    if (tags.length === 0 && suggestions.length === 0) {
      suggestions.push('表现平稳，可继续观察')
    }

    return { ...row, tags, suggestions }
  })
}

export async function fetchAccountAnalytics(
  preset: DatePreset,
  customRange?: [string, string],
): Promise<{ rows: AccountPerformance[]; rangeLabel: string }> {
  const range = getDateRange(preset, customRange)
  const { startDate, endDate } = formatRangeQuery(range)

  const [salesRes, accountsRes] = await Promise.all([
    supabase
      .from('sales')
      .select(`
        account_id,
        quantity,
        sale_amount,
        profit,
        order_status,
        account:seller_accounts(id, name)
      `)
      .eq('channel', 'xianyu')
      .gte('sold_at', startDate)
      .lte('sold_at', endDate),
    supabase.from('seller_accounts').select('id, name').eq('platform', 'xianyu').eq('is_active', true),
  ])

  if (salesRes.error) throw salesRes.error
  if (accountsRes.error) throw accountsRes.error

  const grouped = new Map<string | null, AccountPerformance>()

  for (const account of accountsRes.data ?? []) {
    grouped.set(account.id, {
      account_id: account.id,
      account_name: account.name,
      order_count: 0,
      total_quantity: 0,
      total_amount: 0,
      total_profit: 0,
      profit_rate: 0,
      avg_order_amount: 0,
      tags: [],
      suggestions: [],
    })
  }

  grouped.set(null, {
    account_id: null,
    account_name: '未标记账号',
    order_count: 0,
    total_quantity: 0,
    total_amount: 0,
    total_profit: 0,
    profit_rate: 0,
    avg_order_amount: 0,
    tags: [],
    suggestions: [],
  })

  for (const row of salesRes.data ?? []) {
    const accountData = row.account as { id: string; name: string } | { id: string; name: string }[] | null
    const account = Array.isArray(accountData) ? accountData[0] : accountData
    const key = row.account_id as string | null
    const name = account?.name ?? '未标记账号'
    const current =
      grouped.get(key) ??
      ({
        account_id: key,
        account_name: name,
        order_count: 0,
        total_quantity: 0,
        total_amount: 0,
        total_profit: 0,
        profit_rate: 0,
        avg_order_amount: 0,
        tags: [],
        suggestions: [],
      } as AccountPerformance)

    current.order_count += 1
    current.total_quantity += Number(row.quantity)
    current.total_amount += Number(row.sale_amount)
    current.total_profit += getSaleProfit(row)
    grouped.set(key, current)
  }

  const rows = [...grouped.values()]
    .map((row) => ({
      ...row,
      profit_rate: row.total_amount > 0 ? (row.total_profit / row.total_amount) * 100 : 0,
      avg_order_amount: row.order_count > 0 ? row.total_amount / row.order_count : 0,
    }))
    .sort((a, b) => b.total_profit - a.total_profit)

  const withInsights = buildAccountInsights(rows).filter(
    (row) => row.account_id !== null || row.order_count > 0,
  )

  return {
    rows: withInsights,
    rangeLabel: range.label,
  }
}

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

/** 首页闲鱼账号数据分析：利润、商品状态、投入、售价、货源 */
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

  // 无 account_id 的商品，从销售记录推断所属账号（取最近一条）
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

  // 按商品均价汇总各账号售卖价格
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
    .filter((row) => row.account_id !== null || row.active_count + row.sold_out_count + row.inactive_count > 0 || row.total_profit > 0)
    .sort((a, b) => {
      if (a.account_id === null) return 1
      if (b.account_id === null) return -1
      return b.total_profit - a.total_profit
    })

  return { rows, rangeLabel: range.label }
}
