/**
 * Haydovchi balansi (komissiya) va ball tizimi. Qoidalar: shared/wallet.ts
 * Balans va ball faqat bazadagi atomar funksiyalar orqali o'zgaradi (013_wallet_score.sql).
 */
import {
  COMMISSION_DEFAULT_PCT,
  COMMISSION_MAX_PCT,
  SCORE_DELTA,
  YELLOW_DELAY_MS,
  commissionFor,
  dispatchBlock,
  scoreZone,
  type DriverStanding,
  type ScoreEvent,
  type ScoreReason,
  type WalletTx,
} from '../../../shared/wallet'
import type { LatLng, Order } from '../../../shared/types'
import type { SocketUser } from '../auth.js'
import { db } from '../supabase.js'
import { dbError, OrderError } from './orders.service.js'

let ready = false
export function setWalletReady(v: boolean) {
  ready = v
}
export const walletReady = () => ready

let commissionPct = COMMISSION_DEFAULT_PCT
export const getCommissionPct = () => commissionPct

export async function loadCommission(): Promise<number> {
  const { data, error } = await db().from('app_settings').select('commission_pct').eq('id', 1).maybeSingle()
  if (!error && data) commissionPct = Number(data.commission_pct)
  return commissionPct
}

export async function updateCommission(value: unknown): Promise<number> {
  const pct = Number(value)
  if (!Number.isFinite(pct) || pct < 0 || pct > COMMISSION_MAX_PCT) throw new OrderError(`Komissiya 0–${COMMISSION_MAX_PCT}% bo‘lishi kerak`)
  const rounded = Math.round(pct * 100) / 100
  const { error } = await db().from('app_settings').update({ commission_pct: rounded, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw dbError(error)
  commissionPct = rounded
  return commissionPct
}

const som = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ru-RU').replace(/ /g, ' ')} so‘m`
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })

type StandingRow = { balance: number; score: number; red_until: string | null }

const toStanding = (r: StandingRow): DriverStanding => ({
  balance: r.balance,
  score: r.score,
  zone: scoreZone(r.score),
  redUntil: r.red_until && new Date(r.red_until).getTime() > Date.now() ? r.red_until : null,
  commissionPct,
})

export async function getStanding(driverId: string): Promise<DriverStanding> {
  const { data, error } = await db().from('users').select('balance, score, red_until').eq('id', driverId).maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new OrderError('Haydovchi topilmadi')
  return toStanding(data as StandingRow)
}

/** Nega buyurtma berilmaydi — haydovchiga ko'rsatiladigan matn */
export function blockMessage(s: DriverStanding): string | null {
  const b = dispatchBlock(s)
  if (!b) return null
  if (b.reason === 'balance') return `Balansingiz ${som(b.balance)}. Buyurtma olish uchun balansni to‘ldiring.`
  return `Ballingiz past — ${hhmm(b.until)} gacha yangi buyurtma berilmaydi.`
}

/** Buyurtma qabul qilish / biriktirishdan oldin */
export async function assertCanTakeOrders(driverId: string, forStaff = false): Promise<void> {
  if (!ready) return
  const msg = blockMessage(await getStanding(driverId))
  if (msg) throw new OrderError(forStaff ? `Bu haydovchiga buyurtma berib bo‘lmaydi: ${msg.toLowerCase()}` : msg)
}

/** Yangi buyurtma kimlarga: yashil — darhol, sariq — kechikib */
export async function dispatchTargets(pickup: LatLng | null): Promise<{ green: string[]; yellow: string[]; nearby: boolean }> {
  const split = (rows: { driver_id: string; score: number }[], nearby: boolean) => ({
    green: rows.filter((r) => scoreZone(r.score) === 'green').map((r) => r.driver_id),
    yellow: rows.filter((r) => scoreZone(r.score) !== 'green').map((r) => r.driver_id),
    nearby,
  })
  if (pickup) {
    const { data, error } = await db().rpc('nearby_drivers', { lat: pickup.lat, lng: pickup.lng, radius_m: 5000 })
    if (error) console.warn('[wallet] nearby_drivers xatosi:', error.message)
    else if (data.length) return split(data, true)
  }
  const { data, error } = await db().rpc('dispatchable_drivers')
  if (error) {
    console.warn('[wallet] dispatchable_drivers xatosi:', error.message)
    return { green: [], yellow: [], nearby: false }
  }
  return split(data, false)
}

export { YELLOW_DELAY_MS }

async function applyScore(driverId: string, delta: number, reason: ScoreReason, orderId: string | null, note?: string | null, by?: string) {
  const { error } = await db().rpc('apply_score', {
    p_driver: driverId,
    p_delta: delta,
    p_reason: reason,
    p_order: orderId,
    p_note: note ?? null,
    p_by: by ?? null,
  })
  if (error) throw dbError(error)
}

/**
 * Buyurtma holati o'zgargach: komissiya va ball.
 * Haydovchining yangi holati qaytadi (o'zgarish bo'lmasa — null).
 */
export async function afterOrderChange(order: Order): Promise<DriverStanding | null> {
  if (!ready || !order.driverId) return null
  if (order.status === 'completed') {
    const fee = commissionFor(order.price + order.waitingFee, commissionPct)
    if (fee > 0) {
      const { error } = await db().rpc('apply_wallet_tx', {
        p_driver: order.driverId,
        p_amount: -fee,
        p_kind: 'commission',
        p_order: order.id,
        p_note: `${commissionPct}%`,
      })
      // 23505 — shu safardan allaqachon olingan
      if (error && error.code !== '23505') throw dbError(error)
    }
    await applyScore(order.driverId, SCORE_DELTA.completed, 'completed', order.id)
    return getStanding(order.driverId)
  }
  if (order.status === 'cancelled' && order.cancelReason === 'driver') {
    await applyScore(order.driverId, SCORE_DELTA.driver_cancel, 'driver_cancel', order.id)
    return getStanding(order.driverId)
  }
  return null
}

/** Yo'lovchi bahosi: 5★ → +1, 1–2★ → −5 */
export async function afterRating(order: Order): Promise<DriverStanding | null> {
  if (!ready || !order.driverId || order.rating == null) return null
  if (order.rating === 5) await applyScore(order.driverId, SCORE_DELTA.rating_5, 'rating_5', order.id)
  else if (order.rating <= 2) await applyScore(order.driverId, SCORE_DELTA.rating_low, 'rating_low', order.id)
  else return null
  return getStanding(order.driverId)
}

// ---------------------------------------------------------------- Admin

function requireReady() {
  if (!ready) throw new OrderError('Balans tizimi yoqilmagan — avval 013_wallet_score.sql ni ishga tushiring')
}

const cleanNote = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 200) || null : null)

/** Admin balansni to'ldiradi (musbat) yoki tuzatadi (manfiy — izoh shart) */
export async function changeBalance(admin: SocketUser, input: unknown): Promise<DriverStanding> {
  requireReady()
  const p = (input ?? {}) as Record<string, unknown>
  if (typeof p.driverId !== 'string') throw new OrderError('Haydovchi tanlanmagan')
  const amount = Number(p.amount)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) throw new OrderError('Summani kiriting (so‘m)')
  const note = cleanNote(p.note)
  if (amount < 0 && !note) throw new OrderError('Balansdan ayirishda izoh yozing')
  const { error } = await db().rpc('apply_wallet_tx', {
    p_driver: p.driverId,
    p_amount: amount,
    p_kind: amount > 0 ? 'topup' : 'adjust',
    p_note: note,
    p_by: admin.id,
  })
  if (error) throw dbError(error)
  return getStanding(p.driverId)
}

/** Admin ballni qo'lda tuzatadi (izoh shart) */
export async function changeScore(admin: SocketUser, input: unknown): Promise<DriverStanding> {
  requireReady()
  const p = (input ?? {}) as Record<string, unknown>
  if (typeof p.driverId !== 'string') throw new OrderError('Haydovchi tanlanmagan')
  const delta = Number(p.delta)
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) throw new OrderError('Ball o‘zgarishini kiriting (−100…+100)')
  const note = cleanNote(p.note)
  if (!note) throw new OrderError('Sababini yozing')
  await applyScore(p.driverId, delta, 'admin', null, note, admin.id)
  // Admin ko'targan bo'lsa — pauzani ham olib tashlaymiz
  if (delta > 0) {
    const s = await getStanding(p.driverId)
    if (s.redUntil && s.zone !== 'red') await db().from('users').update({ red_until: null }).eq('id', p.driverId)
  }
  return getStanding(p.driverId)
}

export interface WalletDetails {
  standing: DriverStanding
  transactions: WalletTx[]
  scoreEvents: ScoreEvent[]
}

export async function walletDetails(driverId: string): Promise<WalletDetails> {
  requireReady()
  const [standing, tx, ev] = await Promise.all([
    getStanding(driverId),
    db().from('driver_transactions').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }).limit(50),
    db().from('driver_score_events').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }).limit(50),
  ])
  if (tx.error) throw dbError(tx.error)
  if (ev.error) throw dbError(ev.error)
  return {
    standing,
    transactions: tx.data.map((r) => ({
      id: r.id,
      amount: r.amount,
      kind: r.kind,
      orderId: r.order_id,
      note: r.note,
      balanceAfter: r.balance_after,
      createdAt: r.created_at,
    })),
    scoreEvents: ev.data.map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      orderId: r.order_id,
      note: r.note,
      scoreAfter: r.score_after,
      createdAt: r.created_at,
    })),
  }
}

// ---------------------------------------------------------------- Davriy ishlar

/** Pauzasi tugagan haydovchilar (ID'lari) */
export async function releaseRedDrivers(): Promise<string[]> {
  if (!ready) return []
  const { data, error } = await db().rpc('release_red_drivers')
  if (error) throw dbError(error)
  return (data as unknown as string[]) ?? []
}

export async function dailyRecovery(): Promise<number> {
  if (!ready) return 0
  const { data, error } = await db().rpc('daily_score_recovery')
  if (error) throw dbError(error)
  return Number(data) || 0
}
