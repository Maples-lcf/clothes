import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { getSuperAdminConfig, isSuperAdminUser } from '@/config/super-admin'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const loading = ref(true)

  const user = computed<User | null>(() => session.value?.user ?? null)
  const isLoggedIn = computed(() => Boolean(session.value))

  async function init() {
    loading.value = true
    const { data } = await supabase.auth.getSession()
    session.value = data.session

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      session.value = nextSession
    })

    loading.value = false
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signInSuperAdmin(password: string) {
    const { email, password: adminPassword } = getSuperAdminConfig()
    if (!adminPassword) throw new Error('未配置 VITE_SUPER_ADMIN_PASSWORD')
    if (password !== adminPassword) throw new Error('密码错误')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: adminPassword,
    })
    if (!signInError) return

    const { error: signUpError } = await supabase.auth.signUp({ email, password: adminPassword })
    if (signUpError && !signUpError.message.includes('already registered')) throw signUpError

    const { error: retryError } = await supabase.auth.signInWithPassword({
      email,
      password: adminPassword,
    })
    if (retryError) throw new Error('登录失败，请检查 Supabase 配置')
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    session,
    user,
    loading,
    isLoggedIn,
    isSuperAdmin: computed(() => isSuperAdminUser(user.value?.email)),
    init,
    signIn,
    signInSuperAdmin,
    signOut,
  }
})
