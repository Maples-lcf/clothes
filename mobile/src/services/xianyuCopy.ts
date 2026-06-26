import type { ProductSourceType } from '@shared/types'
import { supabase } from '@/lib/supabase'

export interface GenerateXianyuCopyParams {
  imageUrl: string
  category?: string
  sourceType?: ProductSourceType
  sellPrice?: number
  color?: string
  size?: string
}

export interface GenerateXianyuCopyResponse {
  ok: boolean
  name?: string
  description?: string
  color?: string
  error?: string
}

async function requestApi(params: GenerateXianyuCopyParams) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('请先登录')

  const response = await fetch('/api/ai/generate-xianyu-copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      category: params.category,
      sourceType: params.sourceType,
      sellPrice: params.sellPrice,
      color: params.color,
      size: params.size,
    }),
  })

  let payload: GenerateXianyuCopyResponse
  try {
    payload = (await response.json()) as GenerateXianyuCopyResponse
  } catch {
    throw new Error(`AI 文案服务异常（HTTP ${response.status}）`)
  }

  if (!response.ok || !payload.ok || !payload.name || !payload.description) {
    throw new Error(payload.error ?? 'AI 文案生成失败')
  }

  return payload
}

async function requestEdge(params: GenerateXianyuCopyParams) {
  const { data, error } = await supabase.functions.invoke('generate-xianyu-copy', {
    body: {
      imageUrl: params.imageUrl,
      category: params.category,
      sourceType: params.sourceType,
      sellPrice: params.sellPrice,
      color: params.color,
      size: params.size,
    },
  })

  if (error) throw error

  const payload = data as GenerateXianyuCopyResponse | null
  if (!payload?.ok || !payload.name || !payload.description) {
    throw new Error(payload?.error ?? 'AI 文案生成失败')
  }

  return payload
}

/** 优先同源 API（Vercel Serverless / 本地 Vite 中间件），失败再试 Edge Function */
export async function generateXianyuCopy(params: GenerateXianyuCopyParams) {
  try {
    return await requestApi(params)
  } catch (apiError) {
    if (import.meta.env.DEV) throw apiError
    try {
      return await requestEdge(params)
    } catch {
      throw apiError
    }
  }
}
