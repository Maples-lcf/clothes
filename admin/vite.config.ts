import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')

  return {
    plugins: [
      vue(),
      {
        name: 'xianyu-api',
        configureServer(server) {
          server.middlewares.use('/api/xianyu/fetch', async (req, res, next) => {
            if (req.method !== 'POST') {
              next()
              return
            }

            const { handleXianyuFetchRequest } = await import('./server/xianyuFetchHandler.ts')
            await handleXianyuFetchRequest(req, res)
          })

          server.middlewares.use('/api/ai/generate-product-image', async (req, res, next) => {
            if (req.method !== 'POST') {
              next()
              return
            }

            const { handleGenerateProductImageRequest } = await import('./server/generateProductImageHandler.ts')
            await handleGenerateProductImageRequest(req, res, {
              removeBgApiKey: env.REMOVEBG_API_KEY ?? '',
              supabaseUrl: env.VITE_SUPABASE_URL ?? '',
              supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
            })
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      port: 5173,
    },
  }
})
