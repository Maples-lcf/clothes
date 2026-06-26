export function getSuperAdminConfig() {
  return {
    email: import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'admin@clothes.local',
    password: import.meta.env.VITE_SUPER_ADMIN_PASSWORD || '',
  }
}

export function isSuperAdminLoginInput(value: string) {
  return value.trim().toLowerCase() === 'admin'
}

export function isSuperAdminUser(email: string | null | undefined) {
  const { email: adminEmail } = getSuperAdminConfig()
  return email === adminEmail
}
