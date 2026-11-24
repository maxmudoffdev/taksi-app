import 'dotenv/config'
import { createServer } from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import { router } from './routes/index.js'
import { registerSockets } from './sockets/index.js'
import { setHasCancelReason, setHasFeatures } from './services/orders.service.js'
import { loadSurgeSettings } from './services/surge.service.js'
import { startBot, isBotConfigured } from './services/telegram.bot.js'
import { handleBotMessage, setTelegramReady } from './services/tgAuth.service.js'
import { loadCommission, setWalletReady } from './services/wallet.service.js'
import { loadTariffs } from './services/tariffs.service.js'
import { securityHeaders, TRUST_PROXY_HOPS } from './security.js'
import { checkSupabase, isSecretKey, supabase } from './supabase.js'

const PORT = Number(process.env.PORT ?? 4000)
// Bir nechta manzil vergul bilan: "https://taksi.vercel.app,http://localhost:5173"
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

const app = express()
app.disable('x-powered-by')
// Hosting (Render va h.k.) proksi ortida bo'lsa — TRUST_PROXY=1: foydalanuvchining haqiqiy IP'si (cheklovlar uchun).
// Lokalda 0: aks holda X-Forwarded-For'ni soxtalashtirib cheklovni chetlab o'tish mumkin.
app.set('trust proxy', TRUST_PROXY_HOPS)
app.use(securityHeaders)
app.use(cors({ origin: CLIENT_ORIGIN }))
app.use(express.json({ limit: '20kb' }))
app.use('/api', router)

const httpServer = createServer(app)
// Hodisa hajmi 64 KB dan oshmaydi (standart 1 MB — katta "axlat" bilan xotirani to'ldirishning oldini olish)
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN }, maxHttpBufferSize: 64 * 1024 })
registerSockets(io)

httpServer.listen(PORT, async () => {
  console.log(`🚕 Backend: http://localhost:${PORT}`)
  const db = await checkSupabase()
  console.log(db.ok ? '[Supabase] ulandi ✅' : `[Supabase] xato ❌ ${db.error}`)
  if (db.ok && isSecretKey) {
    const { error } = await supabase!.from('orders_view').select('id').limit(1)
    if (error) console.warn('⚠️  003_orders.sql ishga tushirilmagan (orders_view topilmadi) → Supabase SQL Editor’da bajaring.')
    const v4 = await supabase!.from('driver_locations_view').select('driver_id').limit(1)
    if (v4.error) console.warn('⚠️  004_driver_tracking.sql ishga tushirilmagan → Supabase SQL Editor’da bajaring.')
    const v5 = await supabase!.from('orders_view').select('pickup_address').limit(1)
    if (v5.error) console.warn('⚠️  005_addresses.sql ishga tushirilmagan → Supabase SQL Editor’da bajaring.')
    const v6 = await supabase!.from('tariffs').select('id').limit(1)
    if (v6.error) console.warn('⚠️  006_admin.sql ishga tushirilmagan → Supabase SQL Editor’da bajaring.')
    const v7 = await supabase!.from('orders_view').select('price_is_estimate').limit(1)
    if (v7.error) console.warn('⚠️  007_dispatcher.sql ishga tushirilmagan → Supabase SQL Editor’da bajaring.')
    const v10 = await supabase!.from('orders_view').select('cancel_reason').limit(1)
    setHasCancelReason(!v10.error)
    if (v10.error) console.warn('⚠️  010_fixes.sql ishga tushirilmagan → Supabase SQL Editor’da bajaring (bekor qilish sababi yozilmaydi).')
    const v11 = await supabase!.from('orders_view').select('driver_car_plate, rating, surge').limit(1)
    setHasFeatures(!v11.error)
    if (v11.error) console.warn('⚠️  011_features.sql ishga tushirilmagan → Supabase SQL Editor’da bajaring (mashina, reyting, bloklash, surge ishlamaydi).')
    else {
      const surge = await loadSurgeSettings()
      console.log(`[surge] ${surge.enabled ? `yoqilgan (max ×${surge.max})` : "o'chiq"}`)
    }
    const v13 = await supabase!.from('users').select('balance, score, red_until').limit(1)
    setWalletReady(!v13.error)
    if (v13.error) console.warn('⚠️  013_wallet_score.sql ishga tushirilmagan → balans, komissiya va ball tizimi o‘chiq.')
    else console.log(`[wallet] komissiya ${await loadCommission()}%`)
    const v12 = await supabase!.from('telegram_links').select('phone').limit(1)
    setTelegramReady(!v12.error)
    if (v12.error) console.warn('⚠️  012_telegram.sql ishga tushirilmagan → Telegram orqali kirish o‘chiq.')
    if (!isBotConfigured) console.warn('ℹ️  TELEGRAM_BOT_TOKEN berilmagan → Telegram orqali kirish o‘chiq (@BotFather’dan token oling).')
    else if (!v12.error) await startBot(handleBotMessage)
    const tariffs = await loadTariffs()
    console.log(`[tariffs] ${tariffs.map((t) => `${t.name}: ${t.perKm} so'm/km`).join(' · ')}`)
  }
  if (!isSecretKey) {
    console.warn(
      "⚠️  SUPABASE_SERVICE_ROLE_KEY maxfiy kalit emas (publishable/anon). Buyurtmalar bazaga yozilmaydi.\n" +
        '    Supabase → Project Settings → API Keys → Secret keys (sb_secret_...) ni backend/.env ga qo‘ying.',
    )
  }
})
