import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProductImageStyle } from '../../shared/productImages.ts'

interface GenerateRequest {
  imageUrl?: string
  style?: ProductImageStyle
}

function readJsonBody(req: IncomingMessage): Promise<GenerateRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as GenerateRequest)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function fetchImageBytes(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`无法读取原图（HTTP ${response.status}）`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('原图为空')
  }
  return bytes
}

async function generateWithRemoveBg(bytes: Buffer, style: ProductImageStyle, apiKey: string) {
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

  return Buffer.from(await response.arrayBuffer())
}

async function uploadToStorage(
  bytes: Buffer,
  style: ProductImageStyle,
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string,
) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const path = `ai/${style}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`
  const { error } = await supabase.storage.from('product-images').upload(path, bytes, {
    contentType: 'image/png',
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function handleGenerateProductImageRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: {
    removeBgApiKey: string
    supabaseUrl: string
    supabaseAnonKey: string
  },
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      sendJson(res, 401, { ok: false, error: '请先登录' })
      return
    }

    if (!env.removeBgApiKey) {
      sendJson(res, 422, {
        ok: false,
        error: '未配置 REMOVEBG_API_KEY，请在 admin/.env.local 中添加',
      })
      return
    }

    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      sendJson(res, 401, { ok: false, error: '请先登录' })
      return
    }

    const body = await readJsonBody(req)
    const imageUrl = body.imageUrl?.trim()
    const style = body.style ?? 'white_bg'

    if (!imageUrl) {
      sendJson(res, 400, { ok: false, error: '请提供原图地址' })
      return
    }

    if (style !== 'white_bg' && style !== 'enhance') {
      sendJson(res, 400, { ok: false, error: '不支持的出图风格' })
      return
    }

    const sourceBytes = await fetchImageBytes(imageUrl)
    const outputBytes = await generateWithRemoveBg(sourceBytes, style, env.removeBgApiKey)
    const url = await uploadToStorage(
      outputBytes,
      style,
      env.supabaseUrl,
      env.supabaseAnonKey,
      authHeader,
    )

    sendJson(res, 200, { ok: true, url, style })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 出图失败'
    sendJson(res, 422, { ok: false, error: message })
  }
}
