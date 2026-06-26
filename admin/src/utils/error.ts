const MIGRATION_HINTS: Array<{ match: RegExp; message: string }> = [
  {
    match: /xianyu_link does not exist/i,
    message: '数据库缺少「闲鱼链接」字段，请在 Supabase SQL Editor 执行 supabase/migrations/004_product_xianyu_link.sql',
  },
  {
    match: /order_status does not exist/i,
    message: '数据库缺少「订单状态」字段，请在 Supabase SQL Editor 执行 supabase/migrations/005_sale_order_status.sql',
  },
]

export function getServiceErrorMessage(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''

  if (!message) return fallback

  for (const hint of MIGRATION_HINTS) {
    if (hint.match.test(message)) return hint.message
  }

  return message
}
