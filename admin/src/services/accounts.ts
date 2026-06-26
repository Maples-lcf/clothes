import type { SalesChannel, SellerAccount } from '@shared/types'
import { supabase } from '@/lib/supabase'

export interface AccountFormData {
  name: string
  platform: SalesChannel
  note: string | null
  is_active: boolean
}

export async function fetchSellerAccounts(platform?: SalesChannel) {
  let query = supabase
    .from('seller_accounts')
    .select('*, investments:account_traffic_investments(amount)')
    .order('created_at', { ascending: true })

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query
  if (error) throw error
  return data as SellerAccount[]
}

export async function fetchActiveXianyuAccounts() {
  const { data, error } = await supabase
    .from('seller_accounts')
    .select('*')
    .eq('platform', 'xianyu')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as SellerAccount[]
}

export async function createSellerAccount(form: AccountFormData) {
  const { data, error } = await supabase.from('seller_accounts').insert(form).select().single()
  if (error) throw error
  return data as SellerAccount
}

export async function updateSellerAccount(id: string, form: Partial<AccountFormData>) {
  const { data, error } = await supabase
    .from('seller_accounts')
    .update(form)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as SellerAccount
}

export async function deleteSellerAccount(id: string) {
  const { error } = await supabase.from('seller_accounts').delete().eq('id', id)
  if (error) throw error
}
