import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createHash } from 'node:crypto'
import { fetchXianyuProductInfo } from '../../../shared/xianyuFetch.ts'

const md5 = (input: string) => createHash('md5').update(input).digest('hex')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = (await req.json()) as { url?: string }
    if (!url?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: '请输入闲鱼链接' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await fetchXianyuProductInfo(url, md5)
    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析失败'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
