/**
 * Haydovchi simulyatori (6-bosqichdagi haydovchi interfeysi tayyor bo'lguncha sinov uchun).
 *
 *   npm run simulate-driver -- <email> <parol>          # faqat yangi buyurtmalarni ko'rsatadi
 *   npm run simulate-driver -- <email> <parol> --auto   # birinchi buyurtmani qabul qilib, statuslardan o'tadi
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { io } from 'socket.io-client'
import type { Order, OrderStatus } from '../../shared/types'

config({ path: '../frontend/.env' }) // publishable kalit va backend URL frontend .env'da
config()

const [email, password] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const auto = process.argv.includes('--auto')
if (!email || !password) {
  console.error('Ishlatish: npm run simulate-driver -- <email> <parol> [--auto]')
  process.exit(1)
}

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error) {
  console.error('❌ Kirish xatosi:', error.message)
  process.exit(1)
}

const socket = io(process.env.VITE_BACKEND_URL ?? 'http://localhost:4000', {
  auth: { token: data.session.access_token },
})
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const send = async (event: string, payload: unknown): Promise<Order> => {
  const res = await socket.timeout(15000).emitWithAck(event, payload)
  if (!res.ok) throw new Error(res.error)
  return res.data
}
const show = (o: Order) =>
  `${o.id.slice(0, 8)} · ${o.status} · ${o.tariff} · ${o.distanceKm} km · ${o.price} so'm`

let busy = false
async function drive(order: Order) {
  if (!auto || busy) return
  busy = true
  try {
    console.log('🤝 Qabul qilinmoqda:', show(await send('order:accept', { orderId: order.id })))
    for (const status of ['arrived', 'in_trip', 'completed'] as OrderStatus[]) {
      await wait(3000)
      console.log('➡️ ', show(await send('order:status', { orderId: order.id, status })))
    }
    console.log('✅ Safar yakunlandi')
  } catch (e) {
    console.error('❌', e instanceof Error ? e.message : e)
  } finally {
    busy = false
  }
}

socket.on('connect', async () => {
  console.log(`🚗 Haydovchi ulandi (${email}).`)
  try {
    const res = await socket.timeout(15000).emitWithAck('driver:online', { online: true })
    if (!res.ok) throw new Error(res.error)
    const orders: Order[] = res.data.openOrders
    console.log(`🟢 Onlayn. Ochiq buyurtmalar: ${orders.length}`)
    orders.forEach((o) => console.log('   ', show(o)))
    if (orders[0]) drive(orders[0])
  } catch (e) {
    console.error('❌ Onlayn bo‘lib bo‘lmadi:', e instanceof Error ? e.message : e)
  }
})
socket.on('connect_error', (e) => console.error('❌ Ulanish xatosi:', e.message))
socket.on('server:error', (msg: string) => console.error('❌', msg))
socket.on('order:new', (o: Order) => {
  console.log('🔔 Yangi buyurtma:', show(o))
  drive(o)
})
socket.on('order:taken', (id: string) => console.log(`   (${id.slice(0, 8)} endi ochiq emas)`))
socket.on('order:updated', (o: Order) => {
  if (o.status === 'cancelled') console.log("🚫 Yo'lovchi bekor qildi:", show(o))
})
