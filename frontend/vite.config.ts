import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backend = env.VITE_BACKEND_URL || 'http://localhost:4000'
  // `npm run dev:lan` — telefondan ochish uchun HTTPS (GPS va bildirishnomalar faqat HTTPS'da ishlaydi)
  const lan = mode === 'lan'
  const https = lan ? { key: fs.readFileSync('.cert/key.pem'), cert: fs.readFileSync('.cert/cert.pem') } : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // ../shared papkasidagi umumiy kodni import qilishga ruxsat
      fs: { allow: ['..'] },
      https,
      // `npm run dev:tunnel` — telefondan istalgan internet orqali (Cloudflare vaqtinchalik manzili)
      allowedHosts: ['.trycloudflare.com'],
      // Telefondan kelgan so'rovlar sayt manzili orqali backendga uzatiladi (src/services/backendUrl.ts)
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/socket.io': { target: backend, changeOrigin: true, ws: true },
      },
    },
  }
})
