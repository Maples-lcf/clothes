import { generateXianyuCopyFromImage, type XianyuCopyContext } from '../../lib/xianyuCopy'

export const config = {
  runtime: 'edge',
}

interface GenerateRequest extends XianyuCopyContext {
  imageUrl?: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405)
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: '请先登录' }, 401)
  }

  let body: GenerateRequest
  try {
    body = (await request.json()) as GenerateRequest
  } catch {
    return jsonResponse({ ok: false, error: '请求体格式错误' }, 400)
  }

  if (!body?.imageUrl?.trim()) {
    return jsonResponse({ ok: false, error: '请先上传商品图片' }, 400)
  }

  const apiKey = process.env.AI_VISION_API_KEY ?? ''
  if (!apiKey) {
    return jsonResponse(
      { ok: false, error: '未配置 AI_VISION_API_KEY，请在 Vercel 环境变量中添加' },
      500,
    )
  }

  try {
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
        apiKey,
        baseUrl: process.env.AI_VISION_BASE_URL,
        model: process.env.AI_VISION_MODEL,
      },
    )

    return jsonResponse({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 文案生成失败'
    return jsonResponse({ ok: false, error: message }, 500)
  }
}
