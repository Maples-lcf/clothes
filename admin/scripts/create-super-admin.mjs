/**
 * 在 Supabase 中创建超管账号（只需运行一次）
 *
 * 用法：
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/create-super-admin.mjs
 *
 * Service Role Key 在 Supabase → Project Settings → API → service_role
 */

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SUPER_ADMIN_EMAIL || 'admin@clothes.local'
const password = process.env.SUPER_ADMIN_PASSWORD || 'Lcf1163665207.'

if (!url || !serviceRoleKey) {
  console.error('请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
  }),
})

const data = await res.json()

if (!res.ok) {
  if (data.msg?.includes('already been registered') || data.message?.includes('already')) {
    console.log(`超管账号已存在: ${email}`)
    process.exit(0)
  }
  console.error('创建失败:', data)
  process.exit(1)
}

console.log(`超管账号创建成功: ${email}`)
