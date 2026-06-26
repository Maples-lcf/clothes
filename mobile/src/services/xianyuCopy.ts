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

async function requestLocal(params: GenerateXianyuCopyParams) {
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
    if (response.status === 404) {
      throw new Error('本地 AI 接口未就绪，请重启 mobile 开发服务（npm run dev）')
    }
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

  if (error) {
    if (
      error.message?.includes('Edge Function') ||
      error.message?.includes('404') ||
      error.message?.includes('Failed to send')
    ) {
      throw new Error('AI 文案服务未部署，请在 mobile/.env.local 配置 AI_VISION_API_KEY 后重启 dev')
    }
    throw error
  }

  const payload = data as GenerateXianyuCopyResponse | null
  if (!payload?.ok || !payload.name || !payload.description) {
    throw new Error(payload?.error ?? 'AI 文案生成失败')
  }

  return payload
}

/** 开发环境走本地 Vite 中间件；生产环境走 Supabase Edge Function */
export async function generateXianyuCopy(params: GenerateXianyuCopyParams) {
  if (import.meta.env.DEV) {
    return requestLocal(params)
  }
  return requestEdge(params)
}
