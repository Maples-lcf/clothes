import { generateXianyuCopyFromImage, type XianyuCopyContext } from '../../lib/xianyuCopy.ts'

interface GenerateRequest extends XianyuCopyContext {
  imageUrl?: string
}

type ApiRequest = {
  method?: string
  headers: { authorization?: string }
  body?: GenerateRequest | string
}

type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: '请先登录' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as GenerateRequest
  if (!body?.imageUrl?.trim()) {
    res.status(400).json({ ok: false, error: '请先上传商品图片' })
    return
  }

  const apiKey = process.env.AI_VISION_API_KEY ?? ''
  if (!apiKey) {
    res.status(500).json({
      ok: false,
      error: '未配置 AI_VISION_API_KEY，请在 Vercel 环境变量中添加',
    })
    return
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

    res.status(200).json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 文案生成失败'
    res.status(500).json({ ok: false, error: message })
  }
}
