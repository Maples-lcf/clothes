import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

function aiXianyuCopyApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'ai-xianyu-copy-api',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        if (pathname !== '/api/ai/generate-xianyu-copy') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          const { handleGenerateXianyuCopyRequest } = await import(
            './server/generateXianyuCopyHandler.ts'
          )
          await handleGenerateXianyuCopyRequest(req, res, {
            aiVisionApiKey: env.AI_VISION_API_KEY ?? '',
            aiVisionBaseUrl: env.AI_VISION_BASE_URL,
            aiVisionModel: env.AI_VISION_MODEL,
          })
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : '服务异常',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')

  return {
    plugins: [vue(), aiXianyuCopyApiPlugin(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      port: 5174,
      host: true,
    },
  }
})
