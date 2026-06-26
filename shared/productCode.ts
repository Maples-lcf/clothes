/** 商品货号规则：CF + 6 位流水号，如 CF000001 */

export const PRODUCT_CODE_PREFIX = 'CF'
export const PRODUCT_CODE_DIGITS = 6

export function formatProductCode(seq: number): string {
  return `${PRODUCT_CODE_PREFIX}${String(seq).padStart(PRODUCT_CODE_DIGITS, '0')}`
}

export function isValidProductCode(code: string | null | undefined): boolean {
  if (!code) return false
  const pattern = new RegExp(`^${PRODUCT_CODE_PREFIX}\\d{${PRODUCT_CODE_DIGITS}}$`)
  return pattern.test(code)
}
