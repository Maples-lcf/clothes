export function formatMoney(value: number | null | undefined): string {
  const num = Number(value ?? 0)
  return `¥${num.toFixed(2)}`
}

export function formatPercent(value: number | null | undefined): string {
  const num = Number(value ?? 0)
  return `${num.toFixed(1)}%`
}

export function calcXianyuFee(amount: number, rate = 0.006): number {
  return Number((amount * rate).toFixed(2))
}

export { getSaleProfit } from '@shared/sale'
