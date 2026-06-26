import type { XianyuProductInfo } from './xianyu.ts'
import {
  buildCanonicalXianyuLink,
  extractItemId,
  normalizeXianyuLink,
  parseMtopDetailPayload,
} from './xianyu.ts'

const APP_KEY = '34839810'
const DETAIL_API = 'https://h5api.m.goofish.com/h5/mtop.taobao.idle.pc.detail/1.0/'
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://www.goofish.com',
}

function getCookieToken(setCookieHeaders: string[]): string {
  for (const header of setCookieHeaders) {
    const match = header.match(/_m_h5_tk=([^;]+)/)
    if (match?.[1]) return match[1].split('_')[0] ?? ''
  }
  return ''
}

function collectSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

function mergeCookieHeader(existing: string, setCookieHeaders: string[]): string {
  const jar = new Map<string, string>()

  for (const part of existing.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name) jar.set(name, rest.join('='))
  }

  for (const header of setCookieHeaders) {
    const [pair] = header.split(';')
    const [name, ...rest] = pair.split('=')
    if (name) jar.set(name.trim(), rest.join('='))
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function requestMtopDetail(
  itemId: string,
  cookieHeader: string,
  md5: (input: string) => string,
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const timestamp = String(Date.now())
  const dataVal = JSON.stringify({ itemId })
  const token = cookieHeader.match(/_m_h5_tk=([^;]+)/)?.[1]?.split('_')[0] ?? ''
  const sign = md5(`${token}&${timestamp}&${APP_KEY}&${dataVal}`)
  const query = new URLSearchParams({
    jsv: '2.7.2',
    appKey: APP_KEY,
    t: timestamp,
    sign,
    v: '1.0',
    type: 'originaljson',
    accountSite: 'xianyu',
    dataType: 'json',
    timeout: '20000',
    api: 'mtop.taobao.idle.pc.detail',
    sessionOption: 'AutoLoginOnly',
  })

  const response = await fetch(`${DETAIL_API}?${query.toString()}`, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      Referer: buildCanonicalXianyuLink(itemId),
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader,
    },
    body: new URLSearchParams({ data: dataVal }),
  })

  const body = (await response.json()) as Record<string, unknown>
  return { response, body }
}

function getMtopError(body: Record<string, unknown>): string | null {
  const ret = body.ret
  if (!Array.isArray(ret) || ret.length === 0) return null
  const first = String(ret[0])
  if (first.startsWith('SUCCESS')) return null
  if (first.includes('ITEM_NOT_FOUND') || first.includes('NOT_FOUND')) {
    return '未找到该闲鱼商品，请检查链接是否正确'
  }
  if (first.includes('RGV587') || first.includes('挤爆')) {
    return '闲鱼接口限流，请稍后重试或手动填写商品信息'
  }
  return first.replace(/^FAIL_SYS_|^ERROR::/g, '').trim() || '闲鱼接口返回异常'
}

export async function fetchXianyuProductInfo(
  link: string,
  md5: (input: string) => string,
): Promise<XianyuProductInfo> {
  const normalizedLink = normalizeXianyuLink(link)
  if (!normalizedLink) throw new Error('请输入闲鱼链接')

  let itemId = extractItemId(normalizedLink)
  let resolvedLink = normalizedLink

  if (!itemId) {
    const redirectResponse = await fetch(normalizedLink, {
      method: 'GET',
      redirect: 'follow',
      headers: DEFAULT_HEADERS,
    })
    resolvedLink = redirectResponse.url
    itemId = extractItemId(resolvedLink)
  }

  if (!itemId) throw new Error('无法从链接中识别商品 ID，请粘贴完整的闲鱼商品链接')

  const warmUp = await fetch(buildCanonicalXianyuLink(itemId), {
    headers: DEFAULT_HEADERS,
  })
  let cookieHeader = mergeCookieHeader('', collectSetCookies(warmUp))

  let { response, body } = await requestMtopDetail(itemId, cookieHeader, md5)
  cookieHeader = mergeCookieHeader(cookieHeader, collectSetCookies(response))

  const token = getCookieToken(collectSetCookies(response))
  if (token && getMtopError(body)) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    ;({ response, body } = await requestMtopDetail(itemId, cookieHeader, md5))
  }

  const mtopError = getMtopError(body)
  if (mtopError) throw new Error(mtopError)

  const data = body.data
  if (!data || typeof data !== 'object') {
    throw new Error('闲鱼返回数据为空，请稍后重试')
  }

  const parsed = parseMtopDetailPayload(data as Record<string, unknown>, resolvedLink)
  if (!parsed.name && parsed.images.length === 0 && parsed.price <= 0) {
    throw new Error('未能解析到商品信息，请手动填写')
  }

  return parsed
}

export type { XianyuProductInfo }
