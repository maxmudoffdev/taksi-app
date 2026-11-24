import type { Order, OrderStatus } from '../../../shared/types'
import type { SocketUser } from '../auth.js'
import { db } from '../supabase.js'
import { dbError, OrderError, toOrder, type OrderRow } from './orders.service.js'

const FINISHED: OrderStatus[] = ['completed', 'cancelled']
const PAGE = 20

/** Toshkent vaqti (UTC+5) bo'yicha kun boshi, `daysAgo` kun oldin */
export function tashkentDayStart(daysAgo = 0, now = Date.now()): Date {
  const TZ_OFFSET_MS = 5 * 60 * 60_000
  const local = new Date(now + TZ_OFFSET_MS)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - TZ_OFFSET_MS - daysAgo * 24 * 60 * 60_000)
}

/** Yo'lovchi yoki haydovchining o'tgan safarlari (yangisi birinchi), `before` — sahifalash uchun */
export async function listMyHistory(user: SocketUser, input: unknown): Promise<{ orders: Order[]; hasMore: boolean }> {
  if (user.role !== 'passenger' && user.role !== 'driver') throw new OrderError('Faqat yo‘lovchi va haydovchi uchun')
  const before = (input as { before?: unknown } | null)?.before
  let q = db()
    .from('orders_view')
    .select('*')
    .eq(user.role === 'driver' ? 'driver_id' : 'passenger_id', user.id)
    .in('status', FINISHED)
    .order('created_at', { ascending: false })
    .limit(PAGE + 1)
  if (typeof before === 'string' && !Number.isNaN(Date.parse(before))) q = q.lt('created_at', before)
  const { data, error } = await q
  if (error) throw dbError(error)
  const rows = (data as OrderRow[]).map(toOrder)
  return { orders: rows.slice(0, PAGE), hasMore: rows.length > PAGE }
}

export interface EarningsPeriod {
  trips: number
  /** Safar narxi + kutish haqi */
  amount: number
}

export interface DriverSummary {
  today: EarningsPeriod
  week: EarningsPeriod
  month: EarningsPeriod
  rating: number | null
  ratingCount: number
}

/** Haydovchining daromadi: bugun, so'nggi 7 kun, so'nggi 30 kun va reytingi */
export async function driverSummary(user: SocketUser): Promise<DriverSummary> {
  if (user.role !== 'driver') throw new OrderError('Faqat haydovchi uchun')
  const monthStart = tashkentDayStart(29)
  const [{ data, error }, ratings] = await Promise.all([
    db()
      .from('orders')
      .select('price, waiting_fee, completed_at')
      .eq('driver_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', monthStart.toISOString()),
    db().from('driver_ratings').select('rating_avg, rating_count').eq('driver_id', user.id).maybeSingle(),
  ])
  if (error) throw dbError(error)

  const sum = (since: Date): EarningsPeriod => {
    const rows = data.filter((r) => new Date(r.completed_at).getTime() >= since.getTime())
    return { trips: rows.length, amount: rows.reduce((s, r) => s + Number(r.price) + Number(r.waiting_fee), 0) }
  }
  return {
    today: sum(tashkentDayStart(0)),
    week: sum(tashkentDayStart(6)),
    month: sum(monthStart),
    // 011 qo'llanmagan bo'lsa ko'rinish yo'q — reytingsiz davom etamiz
    rating: ratings.data ? Number(ratings.data.rating_avg) : null,
    ratingCount: ratings.data ? Number(ratings.data.rating_count) : 0,
  }
}

export interface OrderSearch {
  /** Telefon, ism, manzil yoki mo'ljal bo'yicha */
  q?: string
  status?: OrderStatus | 'active' | 'all'
  source?: 'app' | 'phone' | 'all'
  /** ISO vaqt: shu paytdan (yaratilgan) */
  from?: string
  /** ISO vaqt: shu paytgacha (yaratilgan) */
  to?: string
  page?: number
  pageSize?: number
}

/** Bitta so'rovda eng ko'p (Excel'ga yuklash uchun) */
export const SEARCH_MAX_ROWS = 5000

/** PostgREST `or()` sintaksisini buzadigan belgilarni olib tashlash */
const safeTerm = (q: string) => q.replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 80)

/** Admin: buyurtmalar tarixi — qidiruv, filtr, sahifalash */
export async function searchOrders(user: SocketUser, input: unknown): Promise<{ orders: Order[]; total: number }> {
  if (user.role !== 'admin') throw new OrderError('Faqat admin uchun')
  const f = (input ?? {}) as OrderSearch
  const pageSize = Math.min(SEARCH_MAX_ROWS, Math.max(1, Math.floor(Number(f.pageSize) || 50)))
  const page = Math.max(0, Math.floor(Number(f.page) || 0))

  let q = db().from('orders_view').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (f.status === 'active') q = q.in('status', ['created', 'accepted', 'arrived', 'in_trip'])
  else if (f.status && f.status !== 'all') q = q.eq('status', f.status)
  if (f.source === 'app' || f.source === 'phone') q = q.eq('source', f.source)
  if (typeof f.from === 'string' && !Number.isNaN(Date.parse(f.from))) q = q.gte('created_at', f.from)
  if (typeof f.to === 'string' && !Number.isNaN(Date.parse(f.to))) q = q.lt('created_at', f.to)

  const term = typeof f.q === 'string' ? safeTerm(f.q) : ''
  if (term) {
    const digits = term.replace(/\D/g, '')
    const like = `%${term}%`
    const parts = [
      `passenger_name.ilike.${like}`,
      `driver_name.ilike.${like}`,
      `pickup_address.ilike.${like}`,
      `dropoff_address.ilike.${like}`,
      `pickup_note.ilike.${like}`,
    ]
    // Raqam: telefonning bir qismi yoki davlat raqami
    if (digits.length >= 3) parts.push(`passenger_phone.ilike.%${digits}%`, `driver_phone.ilike.%${digits}%`)
    const plate = term.replace(/[^0-9a-z]/gi, '').toUpperCase()
    if (plate.length >= 3) parts.push(`driver_car_plate.ilike.%${plate}%`)
    q = q.or(parts.join(','))
  }

  const { data, error, count } = await q.range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw dbError(error)
  return { orders: (data as OrderRow[]).map(toOrder), total: count ?? 0 }
}
