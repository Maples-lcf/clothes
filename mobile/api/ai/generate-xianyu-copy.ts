import type { VercelRequest, VercelResponse } from '@vercel/node'

interface XianyuCopyContext {
  category?: string
  sourceType?: 'own' | 'purchase'
  sellPrice?: number
  color?: string
  size?: string
}

interface GenerateRequest extends XianyuCopyContext {
  imageUrl?: string
}

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-vl-max'

function buildPrompt(context: XianyuCopyContext): string {
  const lines = [
    '你是一位资深闲鱼服装卖家，擅长写高转化率的发布文案。',
    '请根据图片识别这件衣服，并生成适合闲鱼发布的标题和描述。',
    '',
    '要求：',
    '1. 标题 name：简洁吸引人，20字以内，突出款式/风格/亮点',
    '2. 描述 description：口语化、真实感，包含款式特点、颜色材质、适合场景、搭配建议',
    '3. 描述里留「尺码：均码（可按实际修改）」这类占位',
    '4. 末尾加一句发货说明，如「非偏远包邮，喜欢可以直接拍～」',
    '5. 不要编造品牌真伪，不确定的用「类似」「风格」表述',
    '6. 只返回 JSON，不要 markdown 代码块',
    '',
    'JSON 格式：',
    '{"name":"标题","description":"完整描述","color":"识别到的颜色（可选）"}',
  ]

  if (context.category) lines.push(`\n已知分类：${context.category}`)
  if (context.sourceType === 'own') lines.push('货源：自有闲置（可强调几乎全新/穿过次数少）')
  if (context.sourceType === 'purchase') lines.push('货源：进货转卖（强调性价比）')
  if (context.sellPrice && context.sellPrice > 0) lines.push(`参考售价：¥${context.sellPrice}`)
  if (context.color && context.color !== '均色') lines.push(`已知颜色：${context.color}`)
  if (context.size && context.size !== '均码') lines.push(`已知尺码：${context.size}`)

  return lines.join('\n')
}

function parseJsonResponse(text: string) {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 返回格式异常，请重试')

  const parsed = JSON.parse(jsonMatch[0]) as {
    name?: string
    description?: string
    color?: string
  }
  const name = parsed.name?.trim()
  const description = parsed.description?.trim()
  if (!name || !description) throw new Error('AI 未生成完整文案，请重试')

  return {
    name,
    description,
    color: parsed.color?.trim() || undefined,
  }
}

async function generateXianyuCopyFromImage(
  imageUrl: string,
  context: XianyuCopyContext,
  config: { apiKey: string; baseUrl?: string; model?: string },
) {
  if (!config.apiKey) throw new Error('未配置 AI_VISION_API_KEY')

  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = config.model ?? DEFAULT_MODEL

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(context) },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `AI 文案生成失败（HTTP ${response.status}）`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }

  if (payload.error?.message) throw new Error(payload.error.message)

  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 未返回内容')

  return parseJsonResponse(content)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: '请先登录' })
  }

  const body = req.body as GenerateRequest
  if (!body?.imageUrl?.trim()) {
    return res.status(400).json({ ok: false, error: '请先上传商品图片' })
  }

  const apiKey = process.env.AI_VISION_API_KEY ?? ''
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: '未配置 AI_VISION_API_KEY，请在 Vercel 环境变量中添加',
    })
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

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 文案生成失败'
    return res.status(500).json({ ok: false, error: message })
  }
}
