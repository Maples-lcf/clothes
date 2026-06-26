import type { IncomingMessage, ServerResponse } from 'node:http'
import { generateXianyuCopyFromImage, type XianyuCopyContext } from '../../shared/xianyuCopy.ts'

interface GenerateRequest extends XianyuCopyContext {
  imageUrl?: string
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

export async function handleGenerateXianyuCopyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: {
    aiVisionApiKey: string
    aiVisionBaseUrl?: string
    aiVisionModel?: string
  },
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      sendJson(res, 401, { ok: false, error: '请先登录' })
      return
    }

    const body = await readJsonBody(req)
    if (!body.imageUrl?.trim()) {
      sendJson(res, 400, { ok: false, error: '请先上传商品图片' })
      return
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
        apiKey: env.aiVisionApiKey,
        baseUrl: env.aiVisionBaseUrl,
        model: env.aiVisionModel,
      },
    )

    sendJson(res, 200, { ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 文案生成失败'
    sendJson(res, 500, { ok: false, error: message })
  }
}
