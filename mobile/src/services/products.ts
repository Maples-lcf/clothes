import type { Category, Product, ProductSku } from '@shared/types'
import { resolveNewArrivalFields } from '@shared/productNewArrival'
import { supabase } from '@/lib/supabase'
import type { ProductFormData } from './productForm'

export async function fetchActiveProducts(keyword = '') {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      account:seller_accounts(id, name),
      skus:product_skus(*)
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) throw error

  const products = (data ?? []) as Product[]
  if (!keyword.trim()) return products

  const q = keyword.trim().toLowerCase()
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.skus?.some((s) => `${s.color}${s.size}`.toLowerCase().includes(q)),
  )
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as Category[]
}

export async function fetchActiveXianyuAccounts() {
  const { data, error } = await supabase
    .from('seller_accounts')
    .select('id, name')
    .eq('platform', 'xianyu')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createProduct(form: ProductFormData) {
  const { skus, ...rest } = form
  const productData = {
    category_id: rest.category_id,
    account_id: rest.account_id,
    name: rest.name.trim(),
    description: rest.description?.trim() || null,
    images: rest.images,
    original_images: rest.original_images,
    xianyu_link: rest.xianyu_link?.trim() || null,
    status: rest.status,
    source_type: rest.source_type,
    ...resolveNewArrivalFields(rest.is_new_arrival),
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single()

  if (productError) throw productError

  if (skus.length > 0) {
    const { error: skuError } = await supabase.from('product_skus').insert(
      skus.map((sku) => ({ ...sku, product_id: product.id })),
    )
    if (skuError) throw skuError
  }

  return product as Product
}

export async function uploadProductImage(file: File) {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function delistProducts(productIds: string[]) {
  if (productIds.length === 0) return

  const { error } = await supabase
    .from('products')
    .update({ status: 'inactive' })
    .in('id', productIds)

  if (error) throw error
}

export async function markProductSoldOut(productId: string) {
  const { error } = await supabase
    .from('products')
    .update({ status: 'sold_out' })
    .eq('id', productId)

  if (error) throw error
}

export function getSkuLabel(sku: ProductSku, product?: Product | null) {
  const name = product?.name ?? sku.product?.name ?? '未知商品'
  return `${name} / ${sku.color} / ${sku.size}`
}

export type { ProductFormData }
