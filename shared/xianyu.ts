export interface XianyuProductInfo {
  name: string
  price: number
  description: string
  images: string[]
  xianyu_link: string
  item_id: string | null
}

export interface XianyuShareParseResult {
  url: string | null
  name: string
  description: string
}

export function normalizeXianyuLink(input: string): string {
  return input.trim()
}

/** 从微信/闲鱼分享文案中提取链接、商品名、描述 */
export function parseXianyuShareText(text: string): XianyuShareParseResult {
  const normalized = text.trim()
  if (!normalized) {
    return { url: null, name: '', description: '' }
  }

  const urlMatch = normalized.match(/https?:\/\/[^\s「」\u300c\u300d#]+/i)
  const url = urlMatch?.[0]?.replace(/[，,。.!?！？]+$/, '') ?? null

  let name = ''
  const publishMatch = normalized.match(/我在闲鱼发布了(?:【)+([^】]+)(?:】)+/)
  if (publishMatch?.[1]) {
    name = publishMatch[1].trim()
  } else {
    for (const match of normalized.matchAll(/【([^】]{2,})】/g)) {
      if (match[1] !== '闲鱼') {
        name = match[1].trim()
        break
      }
    }
  }

  let description = ''
  const publishIndex = normalized.indexOf('我在闲鱼发布了')
  if (publishIndex >= 0) {
    const afterPublish = normalized.slice(publishIndex)
    const descMatch = afterPublish.match(/(?:【)+[^】]+(?:】)+([^」\n]+)/)
    if (descMatch?.[1]) {
      description = descMatch[1]
        .replace(/^[，,、\s]+/, '')
        .replace(/[】」]+$/g, '')
        .replace(/[，,。.]+$/, '')
        .trim()
    }
  }

  return { url, name, description }
}

/** 从分享文案或纯链接中取出用于请求的 URL */
export function extractXianyuFetchUrl(text: string): string {
  const trimmed = text.trim()
  const share = parseXianyuShareText(trimmed)
  return share.url ?? trimmed
}

export function extractItemId(link: string): string | null {
  const trimmed = normalizeXianyuLink(link)
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const id = url.searchParams.get('id')
    if (id) return id

    const pathMatch = url.pathname.match(/\/item\/(\d+)/i)
    if (pathMatch?.[1]) return pathMatch[1]
  } catch {
    const queryMatch = trimmed.match(/[?&]id=(\d+)/i)
    if (queryMatch?.[1]) return queryMatch[1]
  }

  return null
}

export function buildCanonicalXianyuLink(itemId: string): string {
  return `https://www.goofish.com/item?id=${itemId}`
}

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const cleaned = value.replace(/[^\d.]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))]
}

function parseShareInfo(shareJsonStr: string): { description: string; images: string[] } {
  if (!shareJsonStr) return { description: '', images: [] }

  try {
    const inner = JSON.parse(shareJsonStr) as {
      contentParams?: {
        mainParams?: {
          content?: string
          images?: Array<{ image?: string }>
        }
      }
    }
    const mainParams = inner.contentParams?.mainParams
    const description = mainParams?.content?.trim() ?? ''
    const images = (mainParams?.images ?? [])
      .map((item) => item.image?.trim())
      .filter((item): item is string => Boolean(item))
    return { description, images }
  } catch {
    return { description: '', images: [] }
  }
}

export function parseMtopDetailPayload(
  payload: Record<string, unknown>,
  sourceLink: string,
): XianyuProductInfo {
  const itemDO = (payload.itemDO ?? {}) as Record<string, unknown>
  const shareData = (itemDO.shareData ?? {}) as Record<string, unknown>
  const shareInfo = parseShareInfo(String(shareData.shareInfoJsonString ?? ''))

  const imageInfos = Array.isArray(itemDO.imageInfos) ? itemDO.imageInfos : []
  const fallbackImages = imageInfos
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const record = item as Record<string, unknown>
      return String(record.url ?? record.major ?? record.image ?? '').trim()
    })
    .filter(Boolean)

  const images = uniqueStrings(shareInfo.images.length > 0 ? shareInfo.images : fallbackImages)
  const itemId = String(itemDO.itemId ?? extractItemId(sourceLink) ?? '').trim() || null

  return {
    name: String(itemDO.title ?? '').trim(),
    price: parsePrice(itemDO.soldPrice ?? itemDO.price ?? itemDO.minPrice),
    description: shareInfo.description || String(itemDO.desc ?? '').trim(),
    images,
    xianyu_link: itemId ? buildCanonicalXianyuLink(itemId) : normalizeXianyuLink(sourceLink),
    item_id: itemId,
  }
}
