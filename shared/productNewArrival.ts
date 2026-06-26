/** 上新标签：仅当天上架的商品展示 */

export function getTodayDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeDateString(date: string | null | undefined): string | null {
  if (!date) return null
  return date.slice(0, 10)
}

export function isNewArrivalToday(
  listedAt: string | null | undefined,
  today = getTodayDateString(),
): boolean {
  const normalized = normalizeDateString(listedAt)
  return normalized !== null && normalized === today
}

export function resolveNewArrivalFields(
  isNewArrival: boolean,
  today = getTodayDateString(),
): { is_new_arrival: boolean; listed_at: string | null } {
  if (!isNewArrival) {
    return { is_new_arrival: false, listed_at: null }
  }
  return { is_new_arrival: true, listed_at: today }
}
