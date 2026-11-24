import { DEFAULT_TARIFFS, type TariffConfig, type TariffPatch } from '../../../shared/pricing'
import type { Tariff } from '../../../shared/types'
import { db } from '../supabase.js'
import { dbError, OrderError } from './orders.service.js'

type TariffRow = {
  id: Tariff
  name: string
  icon: string
  description: string
  base_fare: number
  per_km: number
  per_min: number
  min_fare: number
  free_wait_min: number
  wait_per_min: number
  max_paid_wait_min?: number
}

const toConfig = (r: TariffRow): TariffConfig => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  description: r.description,
  baseFare: r.base_fare,
  perKm: r.per_km,
  perMin: r.per_min,
  minFare: r.min_fare,
  freeWaitMin: r.free_wait_min,
  waitPerMin: r.wait_per_min,
  // 010 bajarilmagan bo'lsa ham ishlasin
  maxPaidWaitMin: r.max_paid_wait_min ?? 15,
})

const COLUMN: Record<keyof TariffPatch, keyof TariffRow> = {
  name: 'name',
  description: 'description',
  baseFare: 'base_fare',
  perKm: 'per_km',
  perMin: 'per_min',
  minFare: 'min_fare',
  freeWaitMin: 'free_wait_min',
  waitPerMin: 'wait_per_min',
  maxPaidWaitMin: 'max_paid_wait_min',
}

/** Xotiradagi nusxa: har buyurtmada bazaga murojaat qilmaslik uchun */
let cache: TariffConfig[] = DEFAULT_TARIFFS

export async function loadTariffs(): Promise<TariffConfig[]> {
  const { data, error } = await db().from('tariffs').select('*').order('sort_order')
  if (error) {
    console.warn(`[tariffs] bazadan o'qilmadi (${error.message}) — standart tariflar ishlatiladi`)
    return cache
  }
  if (data.length) cache = (data as TariffRow[]).map(toConfig)
  return cache
}

export const getTariffs = () => cache
export const getTariff = (id: unknown) => cache.find((t) => t.id === id)

export async function updateTariff(id: Tariff, patch: TariffPatch): Promise<TariffConfig[]> {
  if (!getTariff(id)) throw new OrderError('Tarif topilmadi')
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch) as [keyof TariffPatch, unknown][]) row[COLUMN[key]] = value

  const { data, error } = await db().from('tariffs').update(row).eq('id', id).select('id')
  if (error) throw dbError(error)
  if (!data.length) throw new OrderError('Tarif bazada topilmadi — 006_admin.sql bajarilganmi?')
  return loadTariffs()
}
