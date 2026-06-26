import type { XianyuProductInfo } from '@shared/xianyu'
import { supabase } from '@/lib/supabase'

interface FetchResponse {
  ok: boolean
  data?: XianyuProductInfo
  error?: string
}

async function requestLocalFetch(link: string): Promise<XianyuProductInfo> {
  const response = await fetch('/api/xianyu/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: link }),
  })

  const payload = (await response.json()) as FetchResponse
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error ?? '解析闲鱼商品失败')
  }

  return payload.data
}

async function requestEdgeFetch(link: string): Promise<XianyuProductInfo> {
  const { data, error } = await supabase.functions.invoke('fetch-xianyu', {
    body: { url: link },
  })

  if (error) throw error

  const payload = data as FetchResponse | null
  if (!payload?.ok || !payload.data) {
    throw new Error(payload?.error ?? '解析闲鱼商品失败')
  }

  return payload.data
}

export async function fetchXianyuProductInfo(link: string): Promise<XianyuProductInfo> {
  if (import.meta.env.DEV) {
    try {
      return await requestLocalFetch(link)
    } catch (localError) {
      try {
        return await requestEdgeFetch(link)
      } catch {
        throw localError
      }
    }
  }

  return requestEdgeFetch(link)
}

export type { XianyuProductInfo }
