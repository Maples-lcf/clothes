import type { ProductImageStyle } from '@shared/productImages'
import { supabase } from '@/lib/supabase'

interface GenerateResponse {
  ok: boolean
  url?: string
  style?: ProductImageStyle
  error?: string
}

async function requestLocalGenerate(imageUrl: string, style: ProductImageStyle) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('请先登录')

  const response = await fetch('/api/ai/generate-product-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageUrl, style }),
  })

  const payload = (await response.json()) as GenerateResponse
  if (!response.ok || !payload.ok || !payload.url) {
    throw new Error(payload.error ?? 'AI 出图失败')
  }

  return payload.url
}

async function requestEdgeGenerate(imageUrl: string, style: ProductImageStyle) {
  const { data, error } = await supabase.functions.invoke('generate-product-image', {
    body: { imageUrl, style },
  })

  if (error) {
    if (error.message?.includes('Edge Function')) {
      throw new Error('AI 出图服务未部署，请部署 generate-product-image 或本地配置 REMOVEBG_API_KEY')
    }
    throw error
  }

  const payload = data as GenerateResponse | null
  if (!payload?.ok || !payload.url) {
    throw new Error(payload?.error ?? 'AI 出图失败')
  }

  return payload.url
}

export async function generateProductImage(imageUrl: string, style: ProductImageStyle) {
  if (import.meta.env.DEV) {
    try {
      return await requestLocalGenerate(imageUrl, style)
    } catch (localError) {
      try {
        return await requestEdgeGenerate(imageUrl, style)
      } catch {
        throw localError
      }
    }
  }

  return requestEdgeGenerate(imageUrl, style)
}
