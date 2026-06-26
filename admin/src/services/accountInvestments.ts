import type { AccountTrafficInvestment, SellerAccount } from '@shared/types'
import { supabase } from '@/lib/supabase'

export interface InvestmentFormData {
  account_id: string
  amount: number
  invested_at: string
  note: string | null
}

export type SellerAccountWithInvestments = SellerAccount & {
  investments?: Pick<AccountTrafficInvestment, 'amount'>[]
}

export function sumInvestments(investments: Pick<AccountTrafficInvestment, 'amount'>[] | undefined): number {
  return (investments ?? []).reduce((sum, item) => sum + Number(item.amount), 0)
}

export async function fetchAccountTrafficInvestments(accountId: string) {
  const { data, error } = await supabase
    .from('account_traffic_investments')
    .select('*')
    .eq('account_id', accountId)
    .order('invested_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as AccountTrafficInvestment[]
}

export async function createAccountTrafficInvestment(form: InvestmentFormData) {
  const { data, error } = await supabase
    .from('account_traffic_investments')
    .insert(form)
    .select()
    .single()

  if (error) throw error
  return data as AccountTrafficInvestment
}

export async function updateAccountTrafficInvestment(id: string, form: Partial<InvestmentFormData>) {
  const { data, error } = await supabase
    .from('account_traffic_investments')
    .update(form)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as AccountTrafficInvestment
}

export async function deleteAccountTrafficInvestment(id: string) {
  const { error } = await supabase.from('account_traffic_investments').delete().eq('id', id)
  if (error) throw error
}
