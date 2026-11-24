/**
 * Telefondan istalgan internet orqali sinash: sayt + Cloudflare vaqtinchalik HTTPS manzili.
 *   npm run dev:tunnel
 * Backend alohida ishlab turishi kerak (cd backend && npm run dev). Server so'rovlari sayt orqali uzatiladi (vite proxy).
 * To'xtatish: Ctrl+C
 */
import { spawn } from 'node:child_process'

const PORT = 5175
const children = []
const stop = () => {
  for (const c of children) c.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] })
children.push(vite)
vite.stdout.on('data', () => {}) // Vite chiqishini yashiramiz — kerakli manzilni o'zimiz chiqaramiz
vite.on('exit', (code) => {
  console.error(`Sayt to‘xtadi (kod ${code}). ${PORT}-port band bo‘lishi mumkin.`)
  stop()
})

const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'ignore', 'pipe'] })
children.push(tunnel)
let shown = false
tunnel.stderr.on('data', (buf) => {
  const text = String(buf)
  // Ulanish xatolari ko'rinsin (tarmoq Cloudflare'ni bloklasa)
  if (/failed to request|ERR /.test(text)) console.error('⚠️ ', text.trim().split('\n')[0].replace(/^\S+Z /, ''))
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
  if (m && !shown) {
    shown = true
    console.log('\n📱 Telefonda oching (istalgan internet orqali):')
    console.log(`   ${m[0]}\n`)
    console.log('   Backend ishlab turishi kerak: cd backend && npm run dev')
    console.log('   Manzil har safar yangi bo‘ladi. To‘xtatish: Ctrl+C\n')
  }
})
tunnel.on('error', () => {
  console.error('cloudflared topilmadi. O‘rnatish: brew install cloudflared')
  stop()
})
tunnel.on('exit', (code) => {
  console.error(`Tunnel yopildi (kod ${code}).`)
  stop()
})
