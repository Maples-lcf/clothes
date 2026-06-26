export function getSuperAdminConfig() {
  return {
    email: import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'admin@clothes.local',
    password: import.meta.env.VITE_SUPER_ADMIN_PASSWORD || '',
  }
}

/** 登录框输入 admin 或超管邮箱时，走超管登录流程 */
export function isSuperAdminLoginInput(email: string) {
  const { email: adminEmail } = getSuperAdminConfig()
  const normalized = email.trim().toLowerCase()
  return normalized === 'admin' || normalized === adminEmail.toLowerCase()
}

export function isSuperAdminUser(email: string | undefined) {
  if (!email) return false
  const { email: adminEmail } = getSuperAdminConfig()
  return email.toLowerCase() === adminEmail.toLowerCase()
}
