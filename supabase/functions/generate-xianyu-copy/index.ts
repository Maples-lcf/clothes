import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  generateXianyuCopyFromImage,
  type XianyuCopyContext,
} from '../../../shared/xianyuCopy.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateRequest extends XianyuCopyContext {
  imageUrl?: string
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ ok: false, error: '登录已失效' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as GenerateRequest
    if (!body.imageUrl?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: '请先上传商品图片' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await generateXianyuCopyFromImage(
      body.imageUrl.trim(),
      {
        category: body.category,
        sourceType: body.sourceType,
        sellPrice: body.sellPrice,
        color: body.color,
        size: body.size,
      },
      {
        apiKey: Deno.env.get('AI_VISION_API_KEY') ?? '',
        baseUrl: Deno.env.get('AI_VISION_BASE_URL') ?? undefined,
        model: Deno.env.get('AI_VISION_MODEL') ?? undefined,
      },
    )

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 文案生成失败'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
