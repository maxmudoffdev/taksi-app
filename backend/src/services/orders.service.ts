import { ACTIVE_STATUSES, canTransition } from '../../../shared/orderStatus'
import { fetchRoute } from '../../../shared/osrm'
import { applySurge, calculatePrice, freeWaitIsOver, minutesBetween, waitingFeeFor, type TariffConfig } from '../../../shared/pricing'
import type { CancelReason, LatLng, Order, OrderSource, OrderStatus, Tariff } from '../../../shared/types'
import type { SocketUser } from '../auth.js'
import { db } from '../supabase.js'
import { getTariff } from './tariffs.service.js'

export class OrderError extends Error {
  /** Mijoz tomonda alohida ishlov berish uchun (masalan, tasdiq so'rash) */
  constructor(message: string, readonly code?: 'DUPLICATE_ACTIVE' | 'SURGE_CHANGED') {
    super(message)
  }
}

/** 010_fixes.sql bajarilganmi (cancel_reason ustuni bor) — ishga tushganda tekshiriladi */
let hasCancelReason = false
export function setHasCancelReason(v: boolean) {
  hasCancelReason = v
}
const withReason = (reason: CancelReason) => (hasCancelReason ? { cancel_reason: reason } : {})

/** 011_features.sql bajarilganmi (reyting, surge, mashina ustunlari) */
let hasFeatures = false
export function setHasFeatures(v: boolean) {
  hasFeatures = v
}
export const featuresReady = () => hasFeatures
/** Baza xatosini tushunarli xabarga aylantiradi (011 qo'llanmagan bo'lsa — shuni aytadi) */
const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
export function dbError(error: { code?: string; message: string }): OrderError {
  if (error.code && MISSING_SCHEMA.has(error.code)) {
    return new OrderError('Bazada yangi ustunlar yo‘q — avval migratsiyalarni (backend/supabase/*.sql) Supabase SQL Editor’da ishga tushiring')
  }
  // Ichki xato matni (jadval/ustun nomlari) foydalanuvchiga ko'rsatilmaydi — faqat logda
  console.error(`[db] ${error.code ?? ''} ${error.message}`)
  return new OrderError('Serverda xato. Birozdan keyin qayta urining.')
}
const withSurge = (surge: number) => (hasFeatures && surge > 1 ? { surge } : {})

/** Bitta qo'ng'iroqda so'rash mumkin bo'lgan eng ko'p mashina */
export const MAX_CARS_PER_CALL = 5

async function countActiveByPhone(phone: string): Promise<number> {
  const { count, error } = await db()
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_phone', phone)
    .in('status', ACTIVE_STATUSES)
  if (error) throw dbError(error)
  return count ?? 0
}

/** Haydovchi kiritadigan yakuniy narxning yuqori chegarasi (so'm) */
const MAX_FINAL_PRICE = 10_000_000

export type OrderRow = {
  id: string
  passenger_id: string | null
  driver_id: string | null
  status: OrderStatus
  tariff: Tariff
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  pickup_address: string | null
  dropoff_address: string | null
  distance_km: number | null
  duration_min: number | null
  price: number
  created_at: string
  updated_at: string
  arrived_at: string | null
  started_at: string | null
  completed_at: string | null
  waiting_fee: number
  passenger_name: string | null
  passenger_phone: string | null
  driver_name: string | null
  driver_phone: string | null
  source: OrderSource
  pickup_note: string | null
  created_by: string | null
  price_is_estimate: boolean
  cancel_reason: CancelReason | null
  // 011_features.sql
  rating?: number | null
  rating_comment?: string | null
  surge?: number | null
  driver_car_model?: string | null
  driver_car_color?: string | null
  driver_car_plate?: string | null
  driver_rating?: number | null
  driver_rating_count?: number | null
}

const numOrNull = (v: number | null) => (v == null ? null : Number(v))

export function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    passengerId: r.passenger_id,
    driverId: r.driver_id,
    status: r.status,
    tariff: r.tariff,
    pickup: r.pickup_lat == null || r.pickup_lng == null ? null : { lat: r.pickup_lat, lng: r.pickup_lng },
    dropoff: r.dropoff_lat == null || r.dropoff_lng == null ? null : { lat: r.dropoff_lat, lng: r.dropoff_lng },
    pickupAddress: r.pickup_address,
    dropoffAddress: r.dropoff_address,
    distanceKm: numOrNull(r.distance_km),
    durationMin: numOrNull(r.duration_min),
    price: Number(r.price),
    priceIsEstimate: r.price_is_estimate,
    source: r.source,
    pickupNote: r.pickup_note,
    createdBy: r.created_by,
    cancelReason: r.cancel_reason ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    arrivedAt: r.arrived_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    waitingFee: Number(r.waiting_fee),
    passengerName: r.passenger_name,
    passengerPhone: r.passenger_phone,
    driverName: r.driver_name,
    driverPhone: r.driver_phone,
    driverCar: r.driver_car_plate
      ? { model: r.driver_car_model ?? '', color: r.driver_car_color ?? '', plate: r.driver_car_plate }
      : null,
    driverRating: numOrNull(r.driver_rating ?? null),
    driverRatingCount: Number(r.driver_rating_count ?? 0),
    surge: Number(r.surge ?? 1),
    rating: r.rating ?? null,
    ratingComment: r.rating_comment ?? null,
  }
}

const ewkt = (p: LatLng) => `SRID=4326;POINT(${p.lng} ${p.lat})`

function isLatLng(v: unknown): v is LatLng {
  const p = v as LatLng
  return (
    typeof p === 'object' && p !== null &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
  )
}

/** Mijozdan kelgan qisqa matn (manzil, ism, mo'ljal) */
function cleanText(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/\s+/g, ' ').slice(0, max)
  return s || null
}

/**
 * Telefon raqamini yagona ko'rinishga keltirish:
 *   "90 123 45 67" / "901234567" / "+998 90 123-45-67" → "+998901234567"
 */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const digits = v.replace(/\D/g, '')
  if (digits.length === 9) return `+998${digits}`
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return null
}

/** Marshrut va narx: A va B ma'lum bo'lsa OSRM bo'yicha, bo'lmasa — eng kam narx (taxminiy) */
async function priceFor(tariff: TariffConfig, pickup: LatLng | null, dropoff: LatLng | null, surge = 1) {
  if (!pickup || !dropoff) {
    return { distanceKm: null, durationMin: null, price: applySurge(tariff.minFare, surge), priceIsEstimate: true }
  }
  const route = await fetchRoute(pickup, dropoff).catch((e: Error) => {
    throw new OrderError(`Marshrut hisoblanmadi: ${e.message}`)
  })
  const { total } = calculatePrice(tariff, route.distanceKm, route.durationMin, 0, surge)
  return { distanceKm: route.distanceKm, durationMin: route.durationMin, price: total, priceIsEstimate: false }
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data, error } = await db().from('orders_view').select('*').eq('id', id).maybeSingle()
  if (error) throw dbError(error)
  return data ? toOrder(data as OrderRow) : null
}

export async function getActiveOrderFor(user: SocketUser): Promise<Order | null> {
  if (user.role !== 'driver' && user.role !== 'passenger') return null
  const column = user.role === 'driver' ? 'driver_id' : 'passenger_id'
  const { data, error } = await db()
    .from('orders_view')
    .select('*')
    .eq(column, user.id)
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw dbError(error)
  return data ? toOrder(data as OrderRow) : null
}

export async function listActiveOrders(): Promise<Order[]> {
  const { data, error } = await db()
    .from('orders_view')
    .select('*')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw dbError(error)
  return (data as OrderRow[]).map(toOrder)
}

export async function listOpenOrders(): Promise<Order[]> {
  const { data, error } = await db()
    .from('orders_view')
    .select('*')
    .eq('status', 'created')
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw dbError(error)
  return (data as OrderRow[]).map(toOrder)
}

async function insertOrder(row: Record<string, unknown>, duplicateMessage: string): Promise<Order> {
  const { data, error } = await db().from('orders').insert(row).select('id').single()
  if (error) {
    if (error.code === '23505') throw new OrderError(duplicateMessage)
    throw dbError(error)
  }
  const order = await getOrder(data.id)
  if (!order) throw new OrderError('Buyurtma saqlandi, lekin o‘qib bo‘lmadi')
  return order
}

/** Buyurtma berishdan oldin A nuqtani tekshirish (surge hisoblash uchun) */
export function parsePickup(input: unknown): LatLng | null {
  const pickup = (input as Record<string, unknown> | null)?.pickup
  return isLatLng(pickup) ? pickup : null
}

/**
 * Yo'lovchi ilovadan buyurtma beradi.
 * @param surge serverda hisoblangan joriy koeffitsiyent; yo'lovchi ko'rganidan yuqori bo'lsa — qayta tasdiq so'raladi
 */
export async function createOrder(user: SocketUser, input: unknown, surge = 1): Promise<Order> {
  if (user.role !== 'passenger') throw new OrderError("Faqat yo'lovchi buyurtma bera oladi")

  const { pickup, dropoff, tariff, pickupAddress, dropoffAddress, expectedSurge } = (input ?? {}) as Record<string, unknown>
  if (!isLatLng(pickup) || !isLatLng(dropoff)) throw new OrderError("A yoki B nuqta noto'g'ri")
  const tariffConfig = getTariff(tariff)
  if (!tariffConfig) throw new OrderError("Tarif noto'g'ri")
  const seen = typeof expectedSurge === 'number' && Number.isFinite(expectedSurge) ? expectedSurge : 1
  if (surge > seen + 0.001) {
    throw new OrderError(`Hozir talab yuqori — narx ${surge} barobar. Yangi narxni ko‘rib, qayta tasdiqlang.`, 'SURGE_CHANGED')
  }

  // Masofa va narxni serverning o'zi hisoblaydi — mijozga ishonilmaydi
  const p = await priceFor(tariffConfig, pickup, dropoff, surge)
  return insertOrder(
    {
      passenger_id: user.id,
      source: 'app',
      tariff: tariffConfig.id,
      pickup: ewkt(pickup),
      dropoff: ewkt(dropoff),
      pickup_address: cleanText(pickupAddress),
      dropoff_address: cleanText(dropoffAddress),
      distance_km: p.distanceKm,
      duration_min: p.durationMin,
      price: p.price,
      ...withSurge(surge),
    },
    'Sizda allaqachon faol buyurtma bor',
  )
}

/** Dispetcher qo'ng'iroq qilgan mijoz uchun buyurtma yaratadi */
export async function createPhoneOrder(user: SocketUser, input: unknown, surge = 1): Promise<Order> {
  if (user.role !== 'dispatcher' && user.role !== 'admin') throw new OrderError('Faqat dispetcher uchun')

  const i = (input ?? {}) as Record<string, unknown>
  const phone = normalizePhone(i.customerPhone)
  if (!phone) throw new OrderError("Telefon raqami noto'g'ri (masalan: 90 123 45 67)")
  if (i.pickup != null && !isLatLng(i.pickup)) throw new OrderError("A nuqta noto'g'ri")
  const pickup = (i.pickup as LatLng | null | undefined) ?? null
  const pickupNote = cleanText(i.pickupNote, 300)
  const pickupAddress = cleanText(i.pickupAddress)
  // Joyni xaritada bilmasa ham bo'ladi — lekin mo'ljal yozilishi shart
  if (!pickup && (!pickupNote || pickupNote.length < 3)) {
    throw new OrderError('Joyni xaritada belgilang yoki mo‘ljalni yozing (masalan: 19-maktab yoni)')
  }
  if (i.dropoff != null && !isLatLng(i.dropoff)) throw new OrderError("B nuqta noto'g'ri")
  const dropoff = (i.dropoff as LatLng | null | undefined) ?? null
  const tariffConfig = getTariff(i.tariff)
  if (!tariffConfig) throw new OrderError("Tarif noto'g'ri")

  // Bir raqamdan bir nechta mashina bo'lishi mumkin, lekin tasodifiy takrorni oldini olish uchun tasdiq so'raymiz
  if (i.confirmDuplicate !== true) {
    const active = await countActiveByPhone(phone)
    if (active > 0) {
      throw new OrderError(`Bu raqamda ${active} ta faol buyurtma bor. Yana mashina qo‘shilsinmi?`, 'DUPLICATE_ACTIVE')
    }
  }

  const p = await priceFor(tariffConfig, pickup, dropoff, surge)
  return insertOrder(
    {
      passenger_id: null,
      source: 'phone',
      customer_phone: phone,
      customer_name: cleanText(i.customerName, 80),
      pickup_note: pickupNote,
      created_by: user.id,
      tariff: tariffConfig.id,
      pickup: pickup ? ewkt(pickup) : null,
      dropoff: dropoff ? ewkt(dropoff) : null,
      pickup_address: pickup ? pickupAddress : null,
      dropoff_address: dropoff ? cleanText(i.dropoffAddress) : null,
      distance_km: p.distanceKm,
      duration_min: p.durationMin,
      price: p.price,
      price_is_estimate: p.priceIsEstimate,
      ...withSurge(surge),
    },
    'Buyurtma saqlanmadi (takroriy)',
  )
}

export interface CustomerHistory {
  phone: string
  name: string | null
  /** Oldingi A nuqtalar (takrorlanmasdan, eng yangisi birinchi) */
  /** lat/lng null — avval faqat mo'ljal matni bilan berilgan */
  pickups: { lat: number | null; lng: number | null; address: string | null; note: string | null }[]
  dropoffs: { lat: number; lng: number; address: string | null }[]
  /** Shu raqamdagi hozirgi faol buyurtmalar soni */
  activeCount: number
}

/** Qayta qo'ng'iroq qilgan mijoz: ismi va oldingi manzillari */
export async function lookupCustomer(user: SocketUser, rawPhone: unknown): Promise<CustomerHistory | null> {
  if (user.role !== 'dispatcher' && user.role !== 'admin') throw new OrderError('Faqat dispetcher uchun')
  const phone = normalizePhone(rawPhone)
  if (!phone) return null

  const { data, error } = await db()
    .from('orders_view')
    .select('*')
    .eq('passenger_phone', phone)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw dbError(error)
  const orders = (data as OrderRow[]).map(toOrder)

  const near = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lng - b.lng) < 0.0005
  const pickups: CustomerHistory['pickups'] = []
  const dropoffs: CustomerHistory['dropoffs'] = []
  for (const o of orders) {
    const same = (p: CustomerHistory['pickups'][number]) =>
      o.pickup && p.lat != null && p.lng != null ? near({ lat: p.lat, lng: p.lng }, o.pickup) : !o.pickup && p.lat == null && p.note === o.pickupNote
    if (pickups.length < 5 && !pickups.some(same)) {
      pickups.push({ lat: o.pickup?.lat ?? null, lng: o.pickup?.lng ?? null, address: o.pickupAddress, note: o.pickupNote })
    }
    if (o.dropoff && dropoffs.length < 5 && !dropoffs.some((d) => near(d, o.dropoff!))) {
      dropoffs.push({ ...o.dropoff, address: o.dropoffAddress })
    }
  }
  return {
    phone,
    name: orders.find((o) => o.passengerName)?.passengerName ?? null,
    pickups,
    dropoffs,
    activeCount: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
  }
}

/** Atomar: faqat hali hech kim olmagan buyurtmani haydovchiga berish */
async function takeOrder(orderId: string, driverId: string): Promise<Order> {
  const { data, error } = await db()
    .from('orders')
    .update({ driver_id: driverId, status: 'accepted' })
    .eq('id', orderId)
    .eq('status', 'created')
    .is('driver_id', null)
    .select('id')

  if (error) {
    if (error.code === '23505') throw new OrderError('Haydovchida allaqachon faol buyurtma bor')
    throw dbError(error)
  }
  if (!data.length) throw new OrderError('Buyurtmani boshqa haydovchi olgan yoki u bekor qilingan')
  return (await getOrder(orderId))!
}

export async function acceptOrder(user: SocketUser, orderId: string): Promise<Order> {
  if (user.role !== 'driver') throw new OrderError('Faqat haydovchi buyurtma qabul qila oladi')
  if (!user.isApproved) throw new OrderError('Hisobingiz hali admin tomonidan tasdiqlanmagan')
  return takeOrder(orderId, user.id)
}

/** Dispetcher buyurtmani aniq haydovchiga biriktiradi */
export async function assignOrder(user: SocketUser, orderId: string, driverId: unknown): Promise<Order> {
  if (user.role !== 'dispatcher' && user.role !== 'admin') throw new OrderError('Faqat dispetcher uchun')
  if (typeof driverId !== 'string') throw new OrderError('Haydovchini tanlang')

  const { data: driver, error } = await db()
    .from('users')
    .select('*')
    .eq('id', driverId)
    .maybeSingle()
  if (error) throw dbError(error)
  if (!driver || driver.role !== 'driver' || !driver.is_approved || driver.is_blocked) {
    throw new OrderError('Haydovchi topilmadi, tasdiqlanmagan yoki bloklangan')
  }

  return takeOrder(orderId, driverId)
}

export async function changeStatus(
  user: SocketUser,
  orderId: string,
  to: OrderStatus,
  extra: { finalPrice?: unknown; reason?: unknown } = {},
): Promise<Order> {
  const order = await getOrder(orderId)
  if (!order) throw new OrderError('Buyurtma topilmadi')

  const isParticipant =
    user.role === 'admin' ||
    user.role === 'dispatcher' ||
    (user.role === 'passenger' && order.passengerId === user.id) ||
    (user.role === 'driver' && order.driverId === user.id)
  if (!isParticipant) throw new OrderError('Bu buyurtma sizga tegishli emas')
  if (!canTransition(order.status, to, user.role)) {
    throw new OrderError(`"${order.status}" → "${to}" o'tishiga ruxsat yo'q`)
  }

  const tariff = getTariff(order.tariff)
  // Har bir bosqich vaqtini yozib boramiz; safar boshlanganda kutish haqi hisoblanadi
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: to }
  if (to === 'arrived') patch.arrived_at = now
  if (to === 'in_trip') {
    patch.started_at = now
    if (tariff && order.arrivedAt) patch.waiting_fee = waitingFeeFor(tariff, minutesBetween(order.arrivedAt, now))
  }
  if (to === 'cancelled') {
    Object.assign(patch, withReason(cancelReasonFor(user, order, extra.reason, tariff, now)))
  }
  if (to === 'completed') {
    patch.completed_at = now
    // "Qayerga" noma'lum bo'lgan buyurtmada yakuniy narxni haydovchi kiritadi
    if (order.priceIsEstimate) {
      const min = tariff?.minFare ?? 0
      const finalPrice = extra.finalPrice
      if (typeof finalPrice !== 'number' || !Number.isInteger(finalPrice) || finalPrice < min || finalPrice > MAX_FINAL_PRICE) {
        throw new OrderError(`Yakuniy narxni kiriting (kamida ${min} so'm)`)
      }
      patch.price = finalPrice
      patch.price_is_estimate = false
    }
  }

  // Status oraliqda o'zgarmagan bo'lsagina yangilanadi
  const { data, error } = await db()
    .from('orders')
    .update(patch)
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')
  if (error) throw dbError(error)
  if (!data.length) throw new OrderError("Buyurtma holati o'zgargan, qayta urinib ko'ring")
  return (await getOrder(orderId))!
}

/** Kim bekor qilyapti va nega; "mijoz chiqmadi" faqat bepul kutish tugagach */
function cancelReasonFor(
  user: SocketUser,
  order: Order,
  requested: unknown,
  tariff: TariffConfig | undefined,
  now: string,
): CancelReason {
  if (user.role === 'passenger') return 'passenger'
  if (user.role === 'admin' || user.role === 'dispatcher') return 'staff'
  if (requested === 'no_show') {
    if (order.status !== 'arrived' || !order.arrivedAt) throw new OrderError('"Mijoz chiqmadi" faqat yetib kelgandan keyin')
    if (tariff && !freeWaitIsOver(tariff, minutesBetween(order.arrivedAt, now))) {
      throw new OrderError(`Avval ${tariff.freeWaitMin} daqiqa bepul kutish kerak`)
    }
    return 'no_show'
  }
  return 'driver'
}

/** Haydovchi shu vaqt ichida topilmasa — buyurtma bekor qilinadi */
const SEARCH_TIMEOUT_MIN = 15
/** Qabul qilingan / yetib kelgan buyurtma shuncha vaqt o'zgarmasa — osilib qolgan */
const STALE_ACTIVE_MIN = 180

/** Osilib qolgan buyurtmalarni avtomatik bekor qilish; bekor qilinganlarini qaytaradi */
export async function cancelStaleOrders(): Promise<Order[]> {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const batches = await Promise.all([
    db()
      .from('orders')
      .update({ status: 'cancelled', ...withReason('timeout') })
      .eq('status', 'created')
      .lt('created_at', ago(SEARCH_TIMEOUT_MIN))
      .select('id'),
    db()
      .from('orders')
      .update({ status: 'cancelled', ...withReason('stale') })
      .in('status', ['accepted', 'arrived'])
      .lt('updated_at', ago(STALE_ACTIVE_MIN))
      .select('id'),
  ])
  const ids: string[] = []
  for (const b of batches) {
    if (b.error) throw dbError(b.error)
    ids.push(...b.data.map((r) => r.id))
  }
  const orders = await Promise.all(ids.map(getOrder))
  return orders.filter((o): o is Order => o !== null)
}

export async function findNearbyDriverIds(point: LatLng): Promise<string[]> {
  const { data, error } = await db().rpc('nearby_drivers', { lat: point.lat, lng: point.lng, radius_m: 5000 })
  if (error) {
    console.warn('[orders] nearby_drivers xatosi:', error.message)
    return []
  }
  return (data as { driver_id: string }[]).map((d) => d.driver_id)
}

/** Yo'lovchi yakunlangan safarga baho qo'yadi (bir marta) */
export async function rateOrder(user: SocketUser, input: unknown): Promise<Order> {
  if (user.role !== 'passenger') throw new OrderError("Faqat yo'lovchi baho qo'ya oladi")
  if (!hasFeatures) throw new OrderError('Baholash hali yoqilmagan (011_features.sql)')
  const { orderId, rating, comment } = (input ?? {}) as Record<string, unknown>
  if (typeof orderId !== 'string') throw new OrderError('Buyurtma topilmadi')
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new OrderError('Baho 1 dan 5 gacha bo‘lishi kerak')
  }
  const { data, error } = await db()
    .from('orders')
    .update({ rating, rating_comment: cleanText(comment, 300) })
    .eq('id', orderId)
    .eq('passenger_id', user.id)
    .eq('status', 'completed')
    .is('rating', null)
    .select('id')
  if (error) throw dbError(error)
  if (!data.length) throw new OrderError('Bu safarga baho qo‘yib bo‘lmaydi (allaqachon baholangan yoki yakunlanmagan)')
  return (await getOrder(orderId))!
}
