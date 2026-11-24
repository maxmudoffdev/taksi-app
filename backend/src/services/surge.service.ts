import { SURGE_MAX_OPTIONS, SURGE_RADIUS_M, surgeMultiplier } from '../../../shared/pricing'
import type { LatLng } from '../../../shared/types'
import { db } from '../supabase.js'
import { dbError, OrderError } from './orders.service.js'

export interface SurgeSettings {
  enabled: boolean
  /** Eng yuqori koeffitsiyent */
  max: number
}

let settings: SurgeSettings = { enabled: false, max: 2 }

export const getSurgeSettings = () => settings

/** Bazadan o'qish (011 qo'llanmagan bo'lsa — surge o'chiq qoladi) */
export async function loadSurgeSettings(): Promise<SurgeSettings> {
  const { data, error } = await db().from('app_settings').select('surge_enabled, surge_max').eq('id', 1).maybeSingle()
  if (!error && data) settings = { enabled: data.surge_enabled, max: Number(data.surge_max) }
  return settings
}

export async function updateSurgeSettings(patch: unknown): Promise<SurgeSettings> {
  const p = (patch ?? {}) as Partial<SurgeSettings>
  const next = { ...settings }
  if (p.enabled !== undefined) next.enabled = Boolean(p.enabled)
  if (p.max !== undefined) {
    if (!SURGE_MAX_OPTIONS.includes(p.max as (typeof SURGE_MAX_OPTIONS)[number])) {
      throw new OrderError(`Eng yuqori koeffitsiyent: ${SURGE_MAX_OPTIONS.join(', ')}`)
    }
    next.max = p.max
  }
  const { error } = await db()
    .from('app_settings')
    .upsert({ id: 1, surge_enabled: next.enabled, surge_max: next.max, updated_at: new Date().toISOString() })
  if (error) throw dbError(error)
  settings = next
  return settings
}

/** Ikki nuqta orasidagi masofa (m) */
function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface SurgeQuote {
  surge: number
  /** Atrofdagi haydovchi kutayotgan buyurtmalar (yangisisiz) */
  demand: number
  /** Atrofdagi bo'sh haydovchilar */
  supply: number
}

/**
 * A nuqta atrofidagi talab/taklif bo'yicha koeffitsiyent.
 * @param isBusy haydovchi hozir buyurtmada bo'lsa true (u "bo'sh" hisoblanmaydi)
 */
export async function quoteSurge(point: LatLng, isBusy: (driverId: string) => boolean): Promise<SurgeQuote> {
  if (!settings.enabled) return { surge: 1, demand: 0, supply: 0 }
  const [orders, drivers] = await Promise.all([
    db().from('orders_view').select('pickup_lat, pickup_lng').eq('status', 'created').limit(500),
    db().rpc('nearby_drivers', { lat: point.lat, lng: point.lng, radius_m: SURGE_RADIUS_M }),
  ])
  if (orders.error || drivers.error) {
    console.warn('[surge] hisoblanmadi:', orders.error?.message ?? drivers.error?.message)
    return { surge: 1, demand: 0, supply: 0 }
  }
  const demand = orders.data.filter(
    (o) => o.pickup_lat != null && distanceM(point, { lat: o.pickup_lat, lng: o.pickup_lng }) <= SURGE_RADIUS_M,
  ).length
  const supply = (drivers.data as { driver_id: string }[]).filter((d) => !isBusy(d.driver_id)).length
  return { surge: surgeMultiplier(demand + 1, supply, settings.max), demand, supply }
}
