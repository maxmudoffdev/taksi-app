/**
 * Yangi imkoniyatlar E2E sinovi (ishlab turgan backend va bazaga qarshi):
 * mashina ma'lumoti, kelish vaqti uchun ma'lumot, baho, tarix, daromad, surge, (admin bo'lsa) qidiruv va bloklash.
 *   npm run e2e:features
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run e2e:features   # admin qismini ham sinash
 * Kerak: tasdiqlangan haydovchi sinov hisobi; yo'lovchi hisobi bo'lmasa — yaratiladi (backend/.env: E2E_* — scripts/testAccounts.ts).
 */
import { config } from 'dotenv'
config({ path: '../frontend/.env', quiet: true })
config({ quiet: true })
import { createClient } from '@supabase/supabase-js'
import { testAccount } from './testAccounts'
import { io, type Socket } from 'socket.io-client'
import type { Order } from '../../shared/types'

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

const PAX = testAccount('PASSENGER')

/** Test yo'lovchi: bor bo'lsa kiradi, yo'q bo'lsa ro'yxatdan o'tadi */
async function passengerToken() {
  try {
    return await login(PAX.email, PAX.password)
  } catch {
    const { data, error } = await anon().auth.signUp({
      email: PAX.email,
      password: PAX.password,
      options: { data: { full_name: 'TEST Yo‘lovchi', phone: '+998900000091', role: 'passenger' } },
    })
    if (error) throw new Error(`${PAX.email} yaratilmadi: ${error.message}`)
    if (!data.session) throw new Error(PAX.email + ' yaratildi, lekin email tasdiqlash yoqilgan — Supabase’da "Confirm email"ni o‘chiring')
    return data.session.access_token
  }
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

const main = async () => {
  const [driverToken, paxToken] = await Promise.all([login(testAccount('DRIVER').email, testAccount('DRIVER').password), passengerToken()])
  const driver = io(URL, { auth: { token: driverToken }, reconnection: false })
  const driverActive = await next<Order | null>(driver, 'order:active')
  if (driverActive && !driverActive.passengerName?.startsWith('TEST')) {
    console.log(`⏸  driver1@test.uz boshqa buyurtma bilan band (${driverActive.id.slice(0, 8)} · ${driverActive.status}). Uni yakunlab, qayta ishga tushiring.`)
    process.exit(3)
  }
  const pax = io(URL, { auth: { token: paxToken }, reconnection: false })
  const paxActive = await next<Order | null>(pax, 'order:active')
  console.log('🔌 Haydovchi va test yo‘lovchi ulandi\n')

  // Oldingi sinovdan qolgan faol buyurtmalarni yopish (faqat TEST hisoblar)
  if (driverActive) await call(driver, 'order:status', { orderId: driverActive.id, status: 'cancelled' })
  if (paxActive) await call(pax, 'order:status', { orderId: paxActive.id, status: 'cancelled' })

  // ---------- 1. Mashina ma'lumoti ----------
  // Haydovchining hozirgi mashinasi saqlanadi (raqam o'zgarsa — qayta tasdiq kerak bo'lib qoladi!)
  const own = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${driverToken}` } },
  })
  const { data: me } = await own.from('users').select('*').maybeSingle()
  const current = me?.car_plate ? { model: me.car_model as string, color: me.car_color as string, plate: me.car_plate as string } : null
  const TEST_PLATE = current?.plate ?? '01A777TS'
  const bad = await call(driver, 'driver:car', { model: 'Cobalt', color: 'Oq', plate: 'ABC' })
  ok('Noto‘g‘ri davlat raqami rad etiladi', !bad.ok, bad.ok ? '' : bad.error)
  // Bo'shliq va kichik harf bilan yuborilsa ham bir xil raqam deb tushunilishi kerak
  const spaced = TEST_PLATE.toLowerCase().replace(/^(\d{2})/, '$1 ')
  const car = await call<{ car: { plate: string }; needsApproval: boolean }>(driver, 'driver:car', {
    model: current?.model ?? 'Chevrolet Cobalt',
    color: current?.color ?? 'Oq',
    plate: spaced,
  })
  ok('Haydovchi mashinasini saqladi', car.ok && car.data.car.plate === TEST_PLATE, car.ok ? car.data.car.plate : car.error)
  if (!car.ok && car.error.includes('011')) {
    console.log('\n⛔ 011_features.sql hali qo‘llanmagan — Supabase SQL Editor’da ishga tushiring.')
    process.exit(2)
  }
  ok('O‘sha mashinani qayta saqlash tasdiqni bekor qilmaydi', car.ok && !car.data.needsApproval)

  // ---------- 2. Surge ----------
  const quote = await call<{ surge: number; enabled: boolean }>(pax, 'surge:quote', { pickup: PICKUP })
  ok('Surge narxi so‘raladi', quote.ok, quote.ok ? `×${quote.data.surge} (${quote.data.enabled ? 'yoqilgan' : 'o‘chiq'})` : quote.error)
  const surge = quote.ok ? quote.data.surge : 1

  // ---------- 3. Safar: buyurtma → qabul → yakun ----------
  await call(driver, 'driver:online', { online: true })
  await call(driver, 'driver:location', { ...NEAR_PICKUP, heading: 0 })

  const created = await call<Order>(pax, 'order:create', {
    pickup: PICKUP,
    dropoff: DROPOFF,
    pickupAddress: 'TEST A',
    dropoffAddress: 'TEST B',
    tariff: 'economy',
    expectedSurge: surge,
  })
  ok('Yo‘lovchi buyurtma berdi', created.ok, created.ok ? `${created.data.price} so'm, ×${created.data.surge}` : created.error)
  if (!created.ok) return finish()
  const orderId = created.data.id

  const paxSeesAccept = next<Order>(pax, 'order:updated', (o) => o.id === orderId && o.status === 'accepted')
  // Joylashuv qabul qilish bilan bir vaqtda keladi — tinglashni oldindan boshlaymiz
  const locPromise = next<{ lat: number; orderId: string | null }>(pax, 'driver:location', (l) => l.orderId === orderId, 6000)
  const accepted = await call<Order>(driver, 'order:accept', { orderId })
  ok('Haydovchi qabul qildi', accepted.ok, accepted.ok ? '' : accepted.error)
  const seen = await paxSeesAccept
  ok('Yo‘lovchi mashina ma’lumotini oladi', seen?.driverCar?.plate === TEST_PLATE, seen?.driverCar ? `${seen.driverCar.model}, ${seen.driverCar.color}, ${seen.driverCar.plate}` : 'yo‘q')
  const loc = await locPromise
  ok('Yo‘lovchi haydovchi joylashuvini oladi (kelish vaqti uchun)', loc !== null)

  for (const status of ['arrived', 'in_trip', 'completed'] as const) {
    const r = await call<Order>(driver, 'order:status', { orderId, status })
    if (!r.ok) ok(`Holat → ${status}`, false, r.error)
  }

  // ---------- 4. Baho ----------
  const badRate = await call(pax, 'order:rate', { orderId, rating: 7 })
  ok('Noto‘g‘ri baho (7) rad etiladi', !badRate.ok)
  const driverHearsRating = next<{ rating: number }>(driver, 'order:rated', (x) => x.rating === 5)
  const rated = await call<Order>(pax, 'order:rate', { orderId, rating: 5, comment: 'Toza mashina' })
  ok('Yo‘lovchi 5★ baho qo‘ydi', rated.ok && rated.data.rating === 5, rated.ok ? `reyting ${rated.data.driverRating}` : rated.error)
  ok('Haydovchiga baho haqida xabar keldi', (await driverHearsRating) !== null)
  const again = await call(pax, 'order:rate', { orderId, rating: 1 })
  ok('Qayta baholab bo‘lmaydi', !again.ok)

  // ---------- 5. Tarix va daromad ----------
  const hist = await call<{ orders: Order[] }>(pax, 'history:list', {})
  ok('Yo‘lovchi tarixida safar bor', hist.ok && hist.data.orders[0]?.id === orderId)
  const dhist = await call<{ orders: Order[] }>(driver, 'history:list', {})
  ok('Haydovchi tarixida safar bor', dhist.ok && dhist.data.orders.some((o) => o.id === orderId))
  const summary = await call<{ today: { trips: number; amount: number }; rating: number | null }>(driver, 'driver:summary', null)
  ok(
    'Haydovchining bugungi daromadi hisoblanadi',
    summary.ok && summary.data.today.trips >= 1 && summary.data.today.amount >= created.data.price,
    summary.ok ? `${summary.data.today.trips} safar, ${summary.data.today.amount} so'm, ★${summary.data.rating}` : summary.error,
  )
  const forbidden = await call(pax, 'driver:summary', null)
  ok('Yo‘lovchi daromad ma’lumotini ololmaydi', !forbidden.ok)

  // ---------- 6. Admin (ixtiyoriy) ----------
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const admin = await connect(await login(ADMIN_EMAIL, ADMIN_PASSWORD))
    const found = await call<{ orders: Order[]; total: number }>(admin, 'admin:orders', { q: '777', status: 'completed' })
    ok('Admin davlat raqami bo‘yicha topadi', found.ok && found.data.orders.some((o) => o.id === orderId), found.ok ? `${found.data.total} ta` : found.error)
    const byPhone = await call<{ total: number }>(admin, 'admin:orders', { q: '900000091' })
    ok('Admin telefon bo‘yicha topadi', byPhone.ok && byPhone.data.total >= 1)

    const paxId = created.data.passengerId!
    const kicked = next(pax, 'account:blocked', () => true, 4000)
    const blk = await call(admin, 'admin:block', { userId: paxId, blocked: true })
    ok('Admin yo‘lovchini blokladi', blk.ok, blk.ok ? '' : blk.error)
    ok('Bloklangan ulanish uziladi', (await kicked) !== null)
    const relogin = await connect(paxToken).then(() => 'ulandi', (e: Error) => e.message)
    ok('Bloklangan qayta ulana olmaydi', relogin.includes('bloklangan'), relogin)
    const unb = await call(admin, 'admin:block', { userId: paxId, blocked: false })
    ok('Blokdan chiqarildi', unb.ok)
    admin.disconnect()
  } else {
    console.log('ℹ️  Admin qismi o‘tkazib yuborildi (ADMIN_EMAIL/ADMIN_PASSWORD berilmagan)')
  }

  await call(driver, 'driver:online', { online: false })
  finish()
}

function finish() {
  console.log(`\n${failed ? '❌' : '✅'} ${passed} ta o‘tdi, ${failed} ta xato`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.message : e)
  process.exit(1)
})
