export type ProductImageStyle = 'white_bg' | 'enhance'

export const PRODUCT_IMAGE_STYLE_MAP: Record<ProductImageStyle, string> = {
  white_bg: '白底图',
  enhance: '高清增强',
}

type ProductImages = {
  images?: string[]
  original_images?: string[]
}

/** 列表/卡片封面：优先展示图，否则回退原图 */
export function getProductCoverImage(product: ProductImages) {
  return product.images?.[0] ?? product.original_images?.[0] ?? null
}

/** 商品所有可预览图片（展示图 + 未入展示的原图） */
export function getProductPreviewImages(product: ProductImages) {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const url of [...(product.images ?? []), ...(product.original_images ?? [])]) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}
