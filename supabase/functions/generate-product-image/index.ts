import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import type { ProductImageStyle } from '../../../shared/productImages.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateRequest {
  imageUrl?: string
  style?: ProductImageStyle
}

async function fetchImageBytes(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`无法读取原图（HTTP ${response.status}）`)
  }
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('原图为空')
  }
  return { bytes, contentType }
}

async function generateWithRemoveBg(bytes: Uint8Array, style: ProductImageStyle) {
  const apiKey = Deno.env.get('REMOVEBG_API_KEY')
  if (!apiKey) {
    throw new Error('未配置 REMOVEBG_API_KEY，请在 Supabase Edge Function Secrets 中设置')
  }

  const form = new FormData()
  form.append('image_file', new Blob([bytes], { type: 'image/jpeg' }), 'source.jpg')
  form.append('size', 'auto')
  form.append('format', 'png')

  if (style === 'white_bg') {
    form.append('bg_color', 'ffffff')
  } else {
    form.append('type', 'auto')
  }

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `AI 出图失败（HTTP ${response.status}）`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

async function uploadToStorage(bytes: Uint8Array, style: ProductImageStyle) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('服务端 Supabase 配置缺失')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const path = `ai/${style}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`

  const { error } = await admin.storage.from('product-images').upload(path, bytes, {
    contentType: 'image/png',
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = admin.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: '请先登录' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) {
      throw new Error('服务端 Supabase 配置缺失')
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ ok: false, error: '请先登录' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { imageUrl, style = 'white_bg' } = (await req.json()) as GenerateRequest
    if (!imageUrl?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: '请提供原图地址' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (style !== 'white_bg' && style !== 'enhance') {
      return new Response(JSON.stringify({ ok: false, error: '不支持的出图风格' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { bytes } = await fetchImageBytes(imageUrl.trim())
    const outputBytes = await generateWithRemoveBg(bytes, style)
    const url = await uploadToStorage(outputBytes, style)

    return new Response(JSON.stringify({ ok: true, url, style }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 出图失败'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
