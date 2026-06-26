export function formatMoney(value: number | null | undefined): string {
  return `¥${Number(value ?? 0).toFixed(2)}`
}

export function calcXianyuFee(amount: number, rate = 0.006): number {
  return Number((amount * rate).toFixed(2))
}
