import type { Category } from '@shared/types'
import { supabase } from '@/lib/supabase'

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as Category[]
}

export async function createCategory(name: string, sortOrder = 0) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, sort_order: sortOrder })
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, payload: Partial<Category>) {
  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
