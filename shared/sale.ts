import type { SaleOrderStatus } from './types.ts'

export function getSaleProfit(row: { profit: number; order_status?: SaleOrderStatus | null }) {
  if (row.order_status === 'refunded') return 0
  return Number(row.profit ?? 0)
}
