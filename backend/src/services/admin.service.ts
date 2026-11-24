import { ACTIVE_STATUSES } from '../../../shared/orderStatus'
import type { CarInfo, DriverLocation } from '../../../shared/types'
import { db } from '../supabase.js'
import { dbError, OrderError } from './orders.service.js'

/** Xaritada ko'rsatiladigan haydovchi (oxirgi joylashuvi bilan) */
export interface AdminDriverMarker extends DriverLocation {
  fullName: string | null
  phone: string | null
}

export interface AdminDriverRow {
  id: string
  fullName: string | null
  phone: string | null
  isApproved: boolean
  isBlocked: boolean
  isOnline: boolean
  lastSeenAt: string | null
  createdAt: string
  car: CarInfo | null
  rating: number | null
  ratingCount: number
  /** 013 qo'llanmagan bo'lsa — null */
  balance: number | null
  score: number | null
  redUntil: string | null
}

export interface AdminStats {
  onlineDrivers: number
  activeOrders: number
  searchingOrders: number
  completedToday: number
  revenueToday: number
}

/** Shu muddatdan eski joylashuv "oflayn" hisoblanadi */
const STALE_MS = 3 * 60_000

export async function listOnlineDrivers(): Promise<AdminDriverMarker[]> {
  const since = new Date(Date.now() - STALE_MS).toISOString()
  const { data, error } = await db()
    .from('driver_locations_view')
    .select('*')
    .eq('is_online', true)
    .gt('updated_at', since)
  if (error) throw dbError(error)
  return data.map((d) => ({
    driverId: d.driver_id,
    lat: d.lat,
    lng: d.lng,
    heading: d.heading,
    updatedAt: d.updated_at,
    fullName: d.full_name,
    phone: d.phone,
  }))
}

export async function listDrivers(): Promise<AdminDriverRow[]> {
  const [{ data: users, error }, { data: locs, error: lErr }, ratings] = await Promise.all([
    db().from('users').select('*').eq('role', 'driver').order('created_at', { ascending: false }),
    db().from('driver_locations').select('driver_id, is_online, updated_at'),
    db().from('driver_ratings').select('driver_id, rating_avg, rating_count'),
  ])
  if (error) throw dbError(error)
  if (lErr) throw dbError(lErr)
  const byId = new Map(locs.map((l) => [l.driver_id, l]))
  // 011 qo'llanmagan bo'lsa — reytingsiz
  const ratingById = new Map((ratings.data ?? []).map((r) => [r.driver_id, r]))
  const since = Date.now() - STALE_MS
  return users.map((u) => {
    const loc = byId.get(u.id)
    return {
      id: u.id,
      fullName: u.full_name,
      phone: u.phone,
      isApproved: u.is_approved,
      isBlocked: Boolean(u.is_blocked),
      isOnline: Boolean(loc?.is_online && new Date(loc.updated_at).getTime() > since),
      lastSeenAt: loc?.updated_at ?? null,
      createdAt: u.created_at,
      car: u.car_plate ? { model: u.car_model ?? '', color: u.car_color ?? '', plate: u.car_plate } : null,
      rating: ratingById.has(u.id) ? Number(ratingById.get(u.id)!.rating_avg) : null,
      ratingCount: Number(ratingById.get(u.id)?.rating_count ?? 0),
      balance: typeof u.balance === 'number' ? u.balance : null,
      score: typeof u.score === 'number' ? u.score : null,
      redUntil: u.red_until && new Date(u.red_until).getTime() > Date.now() ? u.red_until : null,
    }
  })
}

export async function setDriverApproved(driverId: string, approved: boolean): Promise<void> {
  if (approved) {
    const { data: u, error: e } = await db().from('users').select('*').eq('id', driverId).maybeSingle()
    if (e) throw dbError(e)
    if (u && 'car_plate' in u && !u.car_plate) throw new OrderError('Haydovchi hali mashina ma’lumotini (rusum, rang, raqam) kiritmagan')
  }
  const { data, error } = await db()
    .from('users')
    .update({ is_approved: approved })
    .eq('id', driverId)
    .eq('role', 'driver')
    .select('id')
  if (error) throw dbError(error)
  if (!data.length) throw new OrderError('Haydovchi topilmadi')
  if (!approved) await db().from('driver_locations').update({ is_online: false }).eq('driver_id', driverId)
}

/** Bugun 00:00 (Toshkent vaqti, UTC+5) — server qaysi zonada bo'lishidan qat'i nazar */
function startOfTodayInTashkent(): Date {
  const TZ_OFFSET_MS = 5 * 60 * 60_000
  const local = new Date(Date.now() + TZ_OFFSET_MS)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - TZ_OFFSET_MS)
}

export async function getStats(onlineDrivers: number): Promise<AdminStats> {
  const startOfDay = startOfTodayInTashkent()
  const [active, searching, completed] = await Promise.all([
    db().from('orders').select('id', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES),
    db().from('orders').select('id', { count: 'exact', head: true }).eq('status', 'created'),
    db().from('orders').select('price, waiting_fee').eq('status', 'completed').gte('completed_at', startOfDay.toISOString()),
  ])
  for (const r of [active, searching, completed]) if (r.error) throw dbError(r.error)
  const rows = completed.data ?? []
  return {
    onlineDrivers,
    activeOrders: active.count ?? 0,
    searchingOrders: searching.count ?? 0,
    completedToday: rows.length,
    revenueToday: rows.reduce((sum, r) => sum + Number(r.price) + Number(r.waiting_fee), 0),
  }
}

export interface StaffRow {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
}

/** Dispetcherlar ro'yxati (email bilan) */
export async function listDispatchers(): Promise<StaffRow[]> {
  const { data, error } = await db().from('users').select('id, full_name, phone').eq('role', 'dispatcher')
  if (error) throw dbError(error)
  const emails = await emailMap()
  return data.map((u) => ({ id: u.id, email: emails.get(u.id) ?? null, fullName: u.full_name, phone: u.phone }))
}

async function emailMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw dbError(error)
    for (const u of data.users) if (u.email) map.set(u.id, u.email)
    if (data.users.length < 200) break
  }
  return map
}

/**
 * Yo'lovchini dispetcher qilish yoki dispetcherni oddiy yo'lovchiga qaytarish.
 * Haydovchi va admin rollariga bu yerdan tegilmaydi.
 */
export async function setDispatcher(email: string, makeDispatcher: boolean): Promise<string> {
  const target = email.trim().toLowerCase()
  const emails = await emailMap()
  const userId = [...emails].find(([, e]) => e.toLowerCase() === target)?.[0]
  if (!userId) throw new OrderError('Bu email bilan foydalanuvchi topilmadi (avval saytda ro‘yxatdan o‘tishi kerak)')

  const { data: user, error } = await db().from('users').select('role').eq('id', userId).maybeSingle()
  if (error) throw dbError(error)
  if (!user) throw new OrderError('Profil topilmadi')
  const from = makeDispatcher ? 'passenger' : 'dispatcher'
  if (user.role !== from) {
    throw new OrderError(makeDispatcher ? `Bu foydalanuvchi "${user.role}" rolida — faqat yo'lovchini dispetcher qilish mumkin` : 'Bu foydalanuvchi dispetcher emas')
  }
  const { error: uErr } = await db()
    .from('users')
    .update({ role: makeDispatcher ? 'dispatcher' : 'passenger', is_approved: true })
    .eq('id', userId)
  if (uErr) throw dbError(uErr)
  return userId
}

/** Foydalanuvchini bloklash / blokdan chiqarish (admin'ni bloklab bo'lmaydi) */
export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const { data, error } = await db()
    .from('users')
    .update({ is_blocked: blocked })
    .eq('id', userId)
    .neq('role', 'admin')
    .select('id, role')
  if (error) throw dbError(error)
  if (!data.length) throw new OrderError('Foydalanuvchi topilmadi')
  if (blocked && data[0].role === 'driver') await db().from('driver_locations').update({ is_online: false }).eq('driver_id', userId)
}
