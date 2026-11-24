/**
 * Balans, komissiya va ball tizimi E2E sinovi (ishlab turgan backend va bazaga qarshi).
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run e2e:wallet
 * Kerak: 013_wallet_score.sql, haydovchi va yo'lovchi sinov hisoblari (backend/.env: E2E_* — scripts/testAccounts.ts).
 * Oxirida driver1 ning balansi va bali sinovdan oldingi holatiga qaytariladi.
 */
import { config } from 'dotenv'
config({ path: '../frontend/.env', quiet: true })
config({ quiet: true })
import { createClient } from '@supabase/supabase-js'
import { testAccount } from './testAccounts'
import { io, type Socket } from 'socket.io-client'
import type { Order } from '../../shared/types'
import { commissionFor, type DriverStanding } from '../../shared/wallet'

const URL = process.env.VITE_BACKEND_URL ?? 'http://localhost:4000'
const PICKUP = { lat: 41.3111, lng: 69.2797 }
const DROPOFF = { lat: 41.2856, lng: 69.2034 }
const NEAR_PICKUP = { lat: 41.309, lng: 69.276 }

let passed = 0
let failed = 0
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const anon = () => createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
async function login(email: string, password: string) {
  const { data, error } = await anon().auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email}: ${error.message}`)
  return data.session.access_token
}
function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(URL, { auth: { token }, reconnection: false })
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })
}
type Ack<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }
const call = <T>(s: Socket, event: string, payload: unknown): Promise<Ack<T>> => s.timeout(20000).emitWithAck(event, payload)
function next<T>(s: Socket, event: string, match: (x: T) => boolean = () => true, ms = 8000): Promise<T | null> {
  return new Promise((resolve) => {
    const h = (x: T) => {
      if (!match(x)) return
      s.off(event, h)
      clearTimeout(t)
      resolve(x)
    }
    const t = setTimeout(() => {
      s.off(event, h)
      resolve(null)
    }, ms)
    s.on(event, h)
  })
}
const must = <T>(r: Ack<T>, what: string): T => {
  if (!r.ok) throw new Error(`${what}: ${r.error}`)
  return r.data
}

type Wallet = { standing: DriverStanding; blockMessage: string | null }
type Standing = DriverStanding & { blockMessage: string | null }

const main = async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('ADMIN_EMAIL va ADMIN_PASSWORD kerak (balansni to‘ldirish va qaytarish uchun).')
    process.exit(2)
  }
  const [driverToken, paxToken, adminToken] = await Promise.all([
    login(testAccount('DRIVER').email, testAccount('DRIVER').password),
    login(testAccount('PASSENGER').email, testAccount('PASSENGER').password),
    login(ADMIN_EMAIL, ADMIN_PASSWORD),
  ])
  const driver = io(URL, { auth: { token: driverToken }, reconnection: false })
  const driverActive = await next<Order | null>(driver, 'order:active')
  if (driverActive && !driverActive.passengerName?.startsWith('TEST')) {
    console.log(`⏸  driver1 boshqa buyurtma bilan band (${driverActive.id.slice(0, 8)}). Uni yakunlab, qayta ishga tushiring.`)
    process.exit(3)
  }
  const pax = io(URL, { auth: { token: paxToken }, reconnection: false })
  const paxActive = await next<Order | null>(pax, 'order:active')
  const admin = await connect(adminToken)
  if (driverActive) await call(driver, 'order:status', { orderId: driverActive.id, status: 'cancelled' })
  if (paxActive) await call(pax, 'order:status', { orderId: paxActive.id, status: 'cancelled' })

  const settings = must(await call<{ commissionPct: number | null }>(admin, 'settings:get', null), 'settings:get')
  if (settings.commissionPct == null) {
    console.log('⛔ 013_wallet_score.sql hali qo‘llanmagan (yoki backend qayta ishga tushirilmagan).')
    process.exit(2)
  }
  const pct = settings.commissionPct
  // Haydovchi ID'si — access token ichida (sub)
  const id: string = JSON.parse(Buffer.from(driverToken.split('.')[1], 'base64url').toString()).sub
  const w0 = must(await call<Wallet>(driver, 'driver:wallet', null), 'driver:wallet').standing
  console.log(`🔌 Ulandi. Komissiya ${pct}%, driver1: balans ${w0.balance}, ball ${w0.score}\n`)

  let restored = false
  const restore = async () => {
    if (restored) return
    restored = true
    const now = must(await call<Wallet>(admin, 'admin:wallet', { driverId: id }), 'admin:wallet').standing
    if (now.balance !== w0.balance) await call(admin, 'admin:balance', { driverId: id, amount: w0.balance - now.balance, note: 'TEST e2e: qaytarish' })
    if (now.score !== w0.score) await call(admin, 'admin:score', { driverId: id, delta: w0.score - now.score, note: 'TEST e2e: qaytarish' })
    const back = must(await call<Wallet>(admin, 'admin:wallet', { driverId: id }), 'admin:wallet').standing
    ok('driver1 balansi va bali avvalgi holatiga qaytdi', back.balance === w0.balance && back.score === w0.score, `${back.balance} so'm, ${back.score} ball`)
    await call(driver, 'driver:online', { online: false })
  }

  try {
    // ---------- 1. To'ldirish ----------
    const topSeen = next<Standing>(driver, 'wallet:updated')
    must(await call(admin, 'admin:balance', { driverId: id, amount: 50_000, note: 'TEST e2e' }), 'admin:balance')
    const afterTop = await topSeen
    ok('Admin balansni to‘ldirdi, haydovchi darhol ko‘rdi', afterTop?.balance === w0.balance + 50_000, `${afterTop?.balance}`)
    const neg = await call(admin, 'admin:balance', { driverId: id, amount: -100 })
    ok('Izohsiz ayirish rad etiladi', !neg.ok)

    // ---------- 2. Safar → komissiya va +2 ball ----------
    await call(driver, 'driver:online', { online: true })
    await call(driver, 'driver:location', { ...NEAR_PICKUP, heading: 0 })
    const quote = must(await call<{ surge: number }>(pax, 'surge:quote', { pickup: PICKUP }), 'surge')
    const o1 = must(await call<Order>(pax, 'order:create', { pickup: PICKUP, dropoff: DROPOFF, pickupAddress: 'TEST A', dropoffAddress: 'TEST B', tariff: 'economy', expectedSurge: quote.surge }), 'order:create')
    must(await call(driver, 'order:accept', { orderId: o1.id }), 'accept')
    for (const status of ['arrived', 'in_trip'] as const) must(await call(driver, 'order:status', { orderId: o1.id, status }), status)
    const settled = next<Standing>(driver, 'wallet:updated')
    const done = must(await call<Order>(driver, 'order:status', { orderId: o1.id, status: 'completed' }), 'completed')
    const st1 = await settled
    const fee = commissionFor(done.price + done.waitingFee, pct)
    ok(`Komissiya ${pct}% yechildi`, st1?.balance === w0.balance + 50_000 - fee, `${done.price + done.waitingFee} so'm → −${fee}, balans ${st1?.balance}`)
    ok('Safar uchun +2 ball', st1?.score === Math.min(100, w0.score + 2), `${w0.score} → ${st1?.score}`)

    // ---------- 3. Baho ----------
    const rated = next<Standing>(driver, 'wallet:updated')
    must(await call(pax, 'order:rate', { orderId: o1.id, rating: 5 }), 'rate')
    const st2 = await rated
    ok('5★ uchun +1 ball', st2?.score === Math.min(100, (st1?.score ?? 0) + 1), `${st2?.score}`)

    // ---------- 4. Haydovchi bekor qildi → −10 ----------
    const o2 = must(await call<Order>(pax, 'order:create', { pickup: PICKUP, dropoff: DROPOFF, pickupAddress: 'TEST A', dropoffAddress: 'TEST B', tariff: 'economy', expectedSurge: quote.surge }), 'order:create 2')
    must(await call(driver, 'order:accept', { orderId: o2.id }), 'accept 2')
    const pen = next<Standing>(driver, 'wallet:updated')
    must(await call(driver, 'order:status', { orderId: o2.id, status: 'cancelled' }), 'cancel')
    const st3 = await pen
    ok('Haydovchi bekor qilsa −10 ball', st3?.score === Math.max(0, (st2?.score ?? 0) - 10), `${st2?.score} → ${st3?.score}`)

    // ---------- 5. Balans manfiy → buyurtma kelmaydi ----------
    const cur = st3?.balance ?? 0
    const blocked = next<Standing>(driver, 'wallet:updated')
    must(await call(admin, 'admin:balance', { driverId: id, amount: -(cur + 1000), note: 'TEST e2e: blok sinovi' }), 'minus')
    const st4 = await blocked
    ok('Balans manfiy — haydovchiga sabab yuborildi', Boolean(st4?.blockMessage), st4?.blockMessage ?? '')
    const noNew = next<Order>(driver, 'order:new', () => true, 4000)
    const o3 = must(await call<Order>(pax, 'order:create', { pickup: PICKUP, dropoff: DROPOFF, pickupAddress: 'TEST A', dropoffAddress: 'TEST B', tariff: 'economy', expectedSurge: quote.surge }), 'order:create 3')
    ok('Balansi manfiy haydovchiga yangi buyurtma kelmadi', (await noNew) === null)
    const tryAccept = await call(driver, 'order:accept', { orderId: o3.id })
    ok('Qabul qilishga ham ruxsat yo‘q', !tryAccept.ok, tryAccept.ok ? '' : tryAccept.error)
    const online = must(await call<{ openOrders: Order[]; blockMessage: string | null }>(driver, 'driver:online', { online: true }), 'online')
    ok('Ochiq buyurtmalar ro‘yxati bo‘sh', online.openOrders.length === 0 && Boolean(online.blockMessage))
    await call(pax, 'order:status', { orderId: o3.id, status: 'cancelled' })

    // ---------- 6. Tarix ----------
    const hist = must(await call<{ transactions: { kind: string; orderId: string | null }[]; scoreEvents: { reason: string }[] }>(driver, 'driver:wallet', null), 'wallet')
    ok('Balans tarixida komissiya yozuvi bor', hist.transactions.some((t) => t.kind === 'commission' && t.orderId === o1.id))
    ok('Ball tarixida sabablar bor', ['completed', 'rating_5', 'driver_cancel'].every((r) => hist.scoreEvents.some((e) => e.reason === r)))
    const forbidden = await call(driver, 'admin:balance', { driverId: id, amount: 1_000_000, note: 'hack' })
    ok('Haydovchi o‘ziga balans yoza olmaydi', !forbidden.ok)
  } finally {
    await restore()
  }
  admin.disconnect()
  console.log(`\n${failed ? '❌' : '✅'} ${passed} ta o‘tdi, ${failed} ta xato`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.message : e)
  process.exit(1)
})
