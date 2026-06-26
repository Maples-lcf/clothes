import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchXianyuProductInfo } from '../../shared/xianyuFetch.ts'

const md5 = (input: string) => createHash('md5').update(input).digest('hex')

function readJsonBody(req: IncomingMessage): Promise<{ url?: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as { url?: string })
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

export async function handleXianyuFetchRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJsonBody(req)
    if (!body.url?.trim()) {
      sendJson(res, 400, { ok: false, error: '请输入闲鱼链接' })
      return
    }

    const data = await fetchXianyuProductInfo(body.url, md5)
    sendJson(res, 200, { ok: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析失败'
    sendJson(res, 422, { ok: false, error: message })
  }
}
