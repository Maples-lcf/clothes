/**
 * 将已有商品全部归属到「复古研究所」闲鱼账号
 *
 * 用法（在 admin 目录）：
 *   node scripts/assign-products-fugu-account.mjs
 *
 * 可选环境变量：
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 *   VITE_SUPER_ADMIN_EMAIL / SUPER_ADMIN_EMAIL
 *   VITE_SUPER_ADMIN_PASSWORD / SUPER_ADMIN_PASSWORD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.SUPER_ADMIN_EMAIL || process.env.VITE_SUPER_ADMIN_EMAIL || 'admin@clothes.local'
const password = process.env.SUPER_ADMIN_PASSWORD || process.env.VITE_SUPER_ADMIN_PASSWORD

const ACCOUNT_NAME = '复古研究所'

if (!url || !anonKey) {
  console.error('请配置 SUPABASE_URL 和 SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!password) {
  console.error('请配置 SUPER_ADMIN_PASSWORD')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

async function ensureAccount() {
  const { data: existing, error: findError } = await supabase
    .from('seller_accounts')
    .select('id, name')
    .eq('platform', 'xianyu')
    .eq('name', ACCOUNT_NAME)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return existing

  const { data: created, error: createError } = await supabase
    .from('seller_accounts')
    .insert({ name: ACCOUNT_NAME, platform: 'xianyu', is_active: true })
    .select('id, name')
    .single()

  if (createError) throw createError
  console.log(`已创建闲鱼账号：${created.name}`)
  return created
}

async function main() {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`登录失败: ${signInError.message}`)

  const account = await ensureAccount()

  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })

  if (countError) throw countError

  const { error: updateError } = await supabase
    .from('products')
    .update({ account_id: account.id })
    .not('id', 'is', null)

  if (updateError) throw updateError

  const { count: assignedCount, error: verifyError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', account.id)

  if (verifyError) throw verifyError

  console.log(`完成：已将 ${assignedCount ?? count ?? 0} 个商品归属到「${account.name}」`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
