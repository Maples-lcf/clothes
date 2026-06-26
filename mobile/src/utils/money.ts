export function formatMoney(value: number | null | undefined): string {
  return `¥${Number(value ?? 0).toFixed(2)}`
}

export function formatPercent(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(1)}%`
}

export function calcXianyuFee(amount: number, rate = 0.006): number {
  return Number((amount * rate).toFixed(2))
}

export { getSaleProfit } from '@shared/sale'
