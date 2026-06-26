import type { Product, ProductSku, ProductSourceType, ProductStatus } from '@shared/types'
import { resolveNewArrivalFields } from '@shared/productNewArrival'
import { supabase } from '@/lib/supabase'

export interface ProductFormData {
  category_id: string | null
  account_id: string | null
  name: string
  description: string | null
  images: string[]
  original_images: string[]
  xianyu_link: string | null
  status: ProductStatus
  source_type: ProductSourceType
  is_new_arrival: boolean
  listed_at: string | null
  skus: Array<{
    id?: string
    color: string
    size: string
    cost_price: number
    sell_price: number
    stock: number
    low_stock_threshold: number
  }>
}

function buildProductPayload(form: ProductFormData) {
  const { skus: _skus, ...rest } = form
  return {
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
}

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      account:seller_accounts(id, name, platform),
      skus:product_skus(*)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Product[]
}

export async function fetchProduct(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      account:seller_accounts(id, name, platform),
      skus:product_skus(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Product
}

export async function createProduct(form: ProductFormData) {
  const { skus } = form
  const productData = buildProductPayload(form)

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single()

  if (productError) throw productError

  if (skus.length > 0) {
    const { error: skuError } = await supabase.from('product_skus').insert(
      skus.map((sku) => ({
        ...sku,
        product_id: product.id,
      })),
    )
    if (skuError) throw skuError
  }

  return fetchProduct(product.id)
}

export async function updateProduct(id: string, form: ProductFormData) {
  const { skus } = form
  const productData = buildProductPayload(form)

  const { error: productError } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)

  if (productError) throw productError

  const { data: existingSkus, error: fetchError } = await supabase
    .from('product_skus')
    .select('id')
    .eq('product_id', id)

  if (fetchError) throw fetchError

  const existingIds = new Set((existingSkus ?? []).map((s) => s.id))
  const incomingIds = new Set(skus.filter((s) => s.id).map((s) => s.id!))

  const toDelete = [...existingIds].filter((skuId) => !incomingIds.has(skuId))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('product_skus').delete().in('id', toDelete)
    if (error) throw error
  }

  for (const sku of skus) {
    if (sku.id) {
      const { error } = await supabase
        .from('product_skus')
        .update({
          color: sku.color,
          size: sku.size,
          cost_price: sku.cost_price,
          sell_price: sku.sell_price,
          stock: sku.stock,
          low_stock_threshold: sku.low_stock_threshold,
        })
        .eq('id', sku.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('product_skus').insert({
        product_id: id,
        color: sku.color,
        size: sku.size,
        cost_price: sku.cost_price,
        sell_price: sku.sell_price,
        stock: sku.stock,
        low_stock_threshold: sku.low_stock_threshold,
      })
      if (error) throw error
    }
  }

  return fetchProduct(id)
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
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

export function getSkuLabel(sku: ProductSku, product?: Product | null) {
  const name = product?.name ?? sku.product?.name ?? '未知商品'
  return `${name} / ${sku.color} / ${sku.size}`
}

export interface ImportProductsResult {
  success: number
  failed: Array<{ rows: number[]; message: string }>
}

export async function importProducts(
  batches: Array<{ rows: number[]; data: ProductFormData }>,
): Promise<ImportProductsResult> {
  const result: ImportProductsResult = { success: 0, failed: [] }

  for (const { rows, data } of batches) {
    try {
      await createProduct(data)
      result.success++
    } catch (error) {
      result.failed.push({
        rows,
        message: error instanceof Error ? error.message : '导入失败',
      })
    }
  }

  return result
}
