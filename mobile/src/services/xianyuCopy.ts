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

/** 调用同源 API 生成闲鱼文案（Vercel Serverless / 本地 Vite 中间件） */
export async function generateXianyuCopy(params: GenerateXianyuCopyParams) {
  return requestApi(params)
}
