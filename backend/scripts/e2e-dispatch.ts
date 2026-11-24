/**
 * Dispetcher oqimining E2E sinovi (ishlab turgan backend va bazaga qarshi).
 *   npm run e2e:dispatch
 * Kerak: dispetcher va tasdiqlangan haydovchi sinov hisoblari (backend/.env: E2E_* — scripts/testAccounts.ts).
 * +998900000099 raqamli TEST buyurtmalar yaratadi.
 */
import { config } from 'dotenv'
config({ path: '../frontend/.env', quiet: true })
config({ quiet: true })
import { createClient } from '@supabase/supabase-js'
import { testAccount } from './testAccounts'
import { io, type Socket } from 'socket.io-client'
import type { Order } from '../../shared/types'

const URL = process.env.VITE_BACKEND_URL ?? 'http://localhost:4000'
const PHONE = '90 000 00 99'
const TASHKENT = { lat: 41.2995, lng: 69.2401 }
const PICKUP = { lat: 41.3111, lng: 69.2797 }
const DROPOFF = { lat: 41.2856, lng: 69.2034 }

let passed = 0
let failed = 0
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function login(email: string, password: string) {
  const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
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

async function call<T>(s: Socket, event: string, payload: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string }> {
  return s.timeout(20000).emitWithAck(event, payload)
}

/** Keyingi hodisani kutish (shart bo'yicha) */
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
  const [dispToken, driverToken] = await Promise.all([login(testAccount('DISPATCHER').email, testAccount('DISPATCHER').password), login(testAccount('DRIVER').email, testAccount('DRIVER').password)])
  const disp = await connect(dispToken)
  // Haydovchining joriy buyurtmasi ulanganda keladi — band bo'lsa sinov ma'nosiz
  const driverSocket = io(URL, { auth: { token: driverToken }, reconnection: false })
  const activeAtStart = await next<Order | null>(driverSocket, 'order:active', () => true, 8000)
  const driver = driverSocket
  if (activeAtStart && !activeAtStart.passengerPhone?.startsWith('+99890000009')) {
    console.log(`⏸  driver1@test.uz hozir boshqa (sinovga aloqasiz) buyurtma bilan band: ${activeAtStart.id.slice(0, 8)} · ${activeAtStart.status}`)
    console.log('   O‘sha buyurtmani yakunlang yoki bekor qiling, keyin sinovni qayta ishga tushiring.')
    process.exit(3)
  }
  console.log('🔌 Dispetcher va haydovchi ulandi\n')

  // Haydovchi: onlayn + joylashuv
  const online = await call<{ openOrders: Order[] }>(driver, 'driver:online', { online: true })
  ok('Haydovchi onlayn bo‘ldi', online.ok, online.ok ? '' : online.error)
  await call(driver, 'driver:location', { ...TASHKENT, heading: 90 })

  // Dispetcher monitoringi haydovchini ko'radimi
  const snap = await call<{ drivers: { driverId: string; fullName: string | null }[]; orders: Order[] }>(disp, 'admin:snapshot', null)
  ok('Dispetcher monitoringida onlayn haydovchi ko‘rinadi', snap.ok && snap.data.drivers.some((d) => d.fullName === 'Test Haydovchi'))
  const driverId = snap.ok ? snap.data.drivers.find((d) => d.fullName === 'Test Haydovchi')?.driverId : undefined

  // Oldingi sinovlardan qolgan faol TEST buyurtmalarni yopamiz
  if (snap.ok) {
    for (const o of snap.data.orders.filter((o) => o.passengerPhone === '+998900000099')) {
      await call(disp, 'order:status', { orderId: o.id, status: 'cancelled' })
    }
  }

  console.log('\n— Tekshiruv: noto‘g‘ri ma’lumotlar rad etiladi')
  const badPhone = await call(disp, 'dispatch:create', { customerPhone: '123', pickupNote: '19-maktab yoni', tariff: 'economy' })
  ok('Noto‘g‘ri telefon rad etildi', !badPhone.ok, badPhone.ok ? '' : badPhone.error)
  const noPlace = await call(disp, 'dispatch:create', { customerPhone: PHONE, tariff: 'economy' })
  ok('Joy ham, mo‘ljal ham yo‘q — rad etildi', !noPlace.ok, noPlace.ok ? '' : noPlace.error)

  console.log('\n— Sinov 1: faqat mo‘ljal (A xaritada yo‘q, B yo‘q), avtomatik yuborish')
  const newForDriver = next<Order>(driver, 'order:new', (o) => o.passengerPhone === '+998900000099')
  const c1 = await call<{ order: Order; assignError: string | null }>(disp, 'dispatch:create', {
    customerPhone: PHONE,
    customerName: 'TEST mijoz',
    pickup: null,
    pickupNote: '19-maktab yoni, ko‘k darvoza',
    dropoff: null,
    tariff: 'economy',
    assignDriverId: null,
  })
  ok('Buyurtma yaratildi (008 bajarilgan)', c1.ok, c1.ok ? `narx ${c1.data.order.price}, taxminiy: ${c1.data.order.priceIsEstimate}` : c1.error)
  if (!c1.ok) throw new Error('Keyingi sinovlar 1-buyurtmaga bog‘liq')
  const o1 = c1.data.order
  ok('A ham, B ham yo‘q; mo‘ljal saqlandi', o1.pickup === null && o1.dropoff === null && o1.pickupNote === '19-maktab yoni, ko‘k darvoza')
  ok('Narx taxminiy = eng kam narx', o1.priceIsEstimate && o1.price > 0)
  ok('Telefon bir xil ko‘rinishga keltirildi', o1.passengerPhone === '+998900000099', o1.passengerPhone ?? '')

  const got = await newForDriver
  ok('Haydovchiga "order:new" keldi (📞 telefon, mo‘ljal bilan)', !!got && got.source === 'phone' && got.pickupNote !== null)

  const dup = await call(disp, 'dispatch:create', { customerPhone: PHONE, pickupNote: 'boshqa joy', tariff: 'economy' })
  ok('Shu raqamga ikkinchi buyurtma — tasdiq so‘raldi (DUPLICATE_ACTIVE)', !dup.ok && dup.code === 'DUPLICATE_ACTIVE', dup.ok ? 'tasdiqsiz yaratildi!' : dup.error)
  const dupOk = await call<{ order: Order }>(disp, 'dispatch:create', { customerPhone: PHONE, pickupNote: 'TEST qo‘shimcha mashina', tariff: 'economy', confirmDuplicate: true })
  ok('Tasdiqlangach qo‘shimcha mashina yaratildi (009 bajarilgan)', dupOk.ok, dupOk.ok ? '' : dupOk.error)
  if (dupOk.ok) await call(disp, 'order:status', { orderId: dupOk.data.order.id, status: 'cancelled' })

  const acc = await call<Order>(driver, 'order:accept', { orderId: o1.id })
  ok('Haydovchi qabul qildi', acc.ok && acc.data.status === 'accepted', acc.ok ? '' : acc.error)
  for (const status of ['arrived', 'in_trip'] as const) {
    const r = await call<Order>(driver, 'order:status', { orderId: o1.id, status })
    ok(`Status → ${status}`, r.ok, r.ok ? '' : r.error)
  }
  const noPrice = await call(driver, 'order:status', { orderId: o1.id, status: 'completed' })
  ok('Yakuniy narxsiz yakunlash rad etildi', !noPrice.ok, noPrice.ok ? '' : noPrice.error)
  const lowPrice = await call(driver, 'order:status', { orderId: o1.id, status: 'completed', finalPrice: 1000 })
  ok('Eng kam narxdan past narx rad etildi', !lowPrice.ok, lowPrice.ok ? '' : lowPrice.error)
  const done = await call<Order>(driver, 'order:status', { orderId: o1.id, status: 'completed', finalPrice: 25000 })
  ok('Yakuniy narx 25 000 bilan yakunlandi', done.ok && done.data.price === 25000 && !done.data.priceIsEstimate, done.ok ? `narx ${done.data.price}` : done.error)

  console.log('\n— Sinov 2: A va B xaritada, aniq haydovchiga biriktirish')
  const assignedToDriver = next<Order>(driver, 'order:updated', (o) => o.status === 'accepted' && o.passengerPhone === '+998900000099')
  const c2 = await call<{ order: Order; assignError: string | null }>(disp, 'dispatch:create', {
    customerPhone: PHONE,
    customerName: 'TEST mijoz',
    pickup: PICKUP,
    pickupAddress: 'Amir Temur xiyoboni',
    pickupNote: 'metro chiqishida',
    dropoff: DROPOFF,
    dropoffAddress: 'Chorsu',
    tariff: 'comfort',
    assignDriverId: driverId,
  })
  ok('Yaratildi va biriktirildi', c2.ok && c2.data.order.status === 'accepted' && !c2.data.assignError, c2.ok ? (c2.data.assignError ?? `narx ${c2.data.order.price} so'm, ${c2.data.order.distanceKm} km`) : c2.error)
  ok('Narx OSRM bo‘yicha aniq (taxminiy emas)', c2.ok && !c2.data.order.priceIsEstimate && (c2.data.order.distanceKm ?? 0) > 0)
  ok('Haydovchiga biriktirilgan buyurtma keldi', !!(await assignedToDriver))

  if (c2.ok) {
    const cancelSeen = next<Order>(driver, 'order:updated', (o) => o.id === c2.data.order.id && o.status === 'cancelled')
    const cancel = await call<Order>(disp, 'order:status', { orderId: c2.data.order.id, status: 'cancelled' })
    ok('Dispetcher bekor qildi', cancel.ok, cancel.ok ? '' : cancel.error)
    ok('Haydovchiga bekor qilingani yetib bordi', !!(await cancelSeen))
  }

  console.log('\n— Sinov 2b: bitta qo‘ng‘iroqda 3 ta mashina')
  const multi = await call<{ orders: Order[] }>(disp, 'dispatch:create', {
    customerPhone: '90 000 00 96',
    customerName: 'TEST to‘y',
    pickup: PICKUP,
    pickupNote: 'TEST 3 ta mashina',
    tariff: 'economy',
    carCount: 3,
  })
  ok('3 ta alohida buyurtma yaratildi', multi.ok && multi.data.orders.length === 3 && new Set(multi.data.orders.map((o) => o.id)).size === 3, multi.ok ? `${multi.data.orders.length} ta` : multi.error)
  if (multi.ok) for (const o of multi.data.orders) await call(disp, 'order:status', { orderId: o.id, status: 'cancelled' })

  console.log('\n— Sinov 3: qayta qo‘ng‘iroq — oldingi manzillar')
  const look = await call<{ name: string | null; pickups: { address: string | null; note: string | null; lat: number | null }[] } | null>(disp, 'dispatch:lookup', { phone: PHONE })
  ok('Mijoz ismi topildi', look.ok && look.data?.name === 'TEST mijoz', look.ok ? (look.data?.name ?? 'yo‘q') : look.error)
  ok(
    'Oldingi manzillar: xaritadagi va faqat mo‘ljalli',
    look.ok && !!look.data && look.data.pickups.some((p) => p.lat != null) && look.data.pickups.some((p) => p.lat == null && p.note?.includes('19-maktab')),
    look.ok && look.data ? look.data.pickups.map((p) => p.address ?? `📌 ${p.note}`).join(' | ') : '',
  )

  console.log('\n— Ruxsatlar')
  const drvCreate = await call(driver, 'dispatch:create', { customerPhone: PHONE, pickupNote: 'x yoni', tariff: 'economy' })
  ok('Haydovchi dispetcher buyurtmasini yarata olmaydi', !drvCreate.ok, drvCreate.ok ? '' : drvCreate.error)
  const dispTariff = await call(disp, 'tariffs:update', { id: 'economy', patch: { perKm: 1 } })
  ok('Dispetcher tarifni o‘zgartira olmaydi', !dispTariff.ok, dispTariff.ok ? '' : dispTariff.error)

  await call(driver, 'driver:online', { online: false })
  disp.close()
  driver.close()
  console.log(`\nNatija: ${passed} ta o‘tdi, ${failed} ta xato`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.message : e)
  process.exit(2)
})
