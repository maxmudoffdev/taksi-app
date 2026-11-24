import type { Tariff } from './types'

export interface TariffConfig {
  id: Tariff
  name: string
  icon: string
  description: string
  /** Boshlang'ich narx (so'm) */
  baseFare: number
  /** Har bir km uchun (so'm) */
  perKm: number
  /** Har bir daqiqa uchun (so'm) */
  perMin: number
  /** Eng kam narx (so'm) */
  minFare: number
  /** Haydovchi yetib kelgach bepul kutish (daqiqa) */
  freeWaitMin: number
  /** Bepul vaqtdan keyin har daqiqa kutish uchun (so'm) */
  waitPerMin: number
  /** Pullik kutishning eng ko'p daqiqasi — undan keyin haq oshmaydi */
  maxPaidWaitMin: number
}

/** Standart tariflar. 7-bosqichda admin paneldan boshqariladigan bo'ladi. */
export const DEFAULT_TARIFFS: TariffConfig[] = [
  { id: 'economy', name: 'Ekonom', icon: '🚗', description: 'Arzon va qulay', baseFare: 5000, perKm: 1800, perMin: 300, minFare: 9000, freeWaitMin: 3, waitPerMin: 500, maxPaidWaitMin: 15 },
  { id: 'comfort', name: 'Komfort', icon: '🚙', description: 'Yangi va keng avtomobillar', baseFare: 8000, perKm: 2500, perMin: 400, minFare: 14000, freeWaitMin: 5, waitPerMin: 700, maxPaidWaitMin: 15 },
  { id: 'delivery', name: 'Yetkazib berish', icon: '📦', description: 'Posilka va hujjatlar', baseFare: 7000, perKm: 2000, perMin: 200, minFare: 12000, freeWaitMin: 5, waitPerMin: 400, maxPaidWaitMin: 15 },
]

/** Admin o'zgartira oladigan narx maydonlari va ularning chegaralari (so'm / daqiqa) */
export const TARIFF_NUMBER_FIELDS = {
  baseFare: { label: "Boshlang'ich narx", unit: "so'm", max: 1_000_000 },
  perKm: { label: '1 km narxi', unit: "so'm", max: 100_000 },
  perMin: { label: '1 daqiqa narxi', unit: "so'm", max: 100_000 },
  minFare: { label: 'Eng kam narx', unit: "so'm", max: 1_000_000 },
  freeWaitMin: { label: 'Bepul kutish', unit: 'daqiqa', max: 60 },
  waitPerMin: { label: 'Kutish (1 daqiqa)', unit: "so'm", max: 100_000 },
  maxPaidWaitMin: { label: 'Pullik kutish chegarasi', unit: 'daqiqa', max: 120 },
} as const satisfies Partial<Record<keyof TariffConfig, { label: string; unit: string; max: number }>>

export type TariffNumberField = keyof typeof TARIFF_NUMBER_FIELDS
export type TariffPatch = Partial<Pick<TariffConfig, TariffNumberField | 'name' | 'description'>>

/** Admin yuborgan o'zgarishlarni tekshiradi; xato bo'lsa matnini qaytaradi */
export function validateTariffPatch(patch: unknown): { ok: true; value: TariffPatch } | { ok: false; error: string } {
  if (typeof patch !== 'object' || patch === null) return { ok: false, error: "Ma'lumot noto'g'ri" }
  const input = patch as Record<string, unknown>
  const value: TariffPatch = {}
  for (const [key, rule] of Object.entries(TARIFF_NUMBER_FIELDS) as [TariffNumberField, { label: string; max: number }][]) {
    if (input[key] === undefined) continue
    const n = input[key]
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > rule.max) {
      return { ok: false, error: `${rule.label}: 0 dan ${rule.max} gacha butun son kiriting` }
    }
    value[key] = n
  }
  for (const key of ['name', 'description'] as const) {
    if (input[key] === undefined) continue
    const v = input[key]
    if (typeof v !== 'string' || (key === 'name' && !v.trim()) || v.length > 80) {
      return { ok: false, error: key === 'name' ? "Tarif nomi bo'sh bo'lmasin (80 belgigacha)" : 'Tavsif 80 belgigacha' }
    }
    value[key] = v.trim()
  }
  if (!Object.keys(value).length) return { ok: false, error: "O'zgarish yo'q" }
  return { ok: true, value }
}

/** Bepul kutish tugaganmi — "Mijoz chiqmadi" tugmasi shundan keyin chiqadi */
export function freeWaitIsOver(tariff: TariffConfig, waitingMin: number): boolean {
  return waitingMin >= tariff.freeWaitMin
}

/** Marshrut shundan uzun bo'lsa — buyurtmadan oldin tasdiq so'raladi (km) */
export const LONG_ROUTE_KM = 100

/** Narxlar shu qadamga yaxlitlanadi (so'm) */
export const ROUNDING_STEP = 500

export interface PriceBreakdown {
  base: number
  distance: number
  time: number
  /** Pullik kutish daqiqalari (bepul vaqtdan keyingi) */
  paidWaitMin: number
  /** Kutish haqi (so'm) */
  waiting: number
  /** Eng kam narxga yetkazish uchun qo'shilgan summa */
  minFareTopUp: number
  /** Yuqori talab tufayli qo'shilgan summa (surge > 1 bo'lsa) */
  surgeAmount: number
  total: number
}

/**
 * @param waitingMin haydovchi yetib kelgandan (arrived) safar boshlanguncha (in_trip) o'tgan vaqt.
 *   Buyurtma berishda 0 — oldindan ko'rsatiladigan narx.
 */
export function calculatePrice(
  tariff: TariffConfig,
  distanceKm: number,
  durationMin: number,
  waitingMin = 0,
  surge = 1,
): PriceBreakdown {
  for (const v of [distanceKm, durationMin, waitingMin]) {
    if (!Number.isFinite(v) || v < 0) {
      throw new RangeError("Masofa, vaqt va kutish manfiy bo'lmagan son bo'lishi kerak")
    }
  }
  if (!Number.isFinite(surge) || surge < 1) throw new RangeError("Koeffitsiyent 1 dan kichik bo'lmasligi kerak")
  const base = tariff.baseFare
  const distance = tariff.perKm * distanceKm
  const time = tariff.perMin * durationMin
  // Boshlangan har pullik daqiqa to'liq; lekin chegaradan oshmaydi
  const paidWaitMin = Math.min(Math.ceil(Math.max(0, waitingMin - tariff.freeWaitMin)), tariff.maxPaidWaitMin)
  const waiting = paidWaitMin * tariff.waitPerMin

  // Eng kam narx safar uchun; kutish haqi uning ustiga qo'shiladi
  const trip = Math.ceil((base + distance + time) / ROUNDING_STEP) * ROUNDING_STEP
  const tripTotal = Math.max(trip, tariff.minFare)
  // Koeffitsiyent faqat safar narxiga; kutish haqi o'zgarmaydi
  const surged = applySurge(tripTotal, surge)

  return {
    base,
    distance: Math.round(distance),
    time: Math.round(time),
    paidWaitMin,
    waiting,
    minFareTopUp: tripTotal - trip,
    surgeAmount: surged - tripTotal,
    total: surged + waiting,
  }
}

/** Narxni koeffitsiyentga ko'paytirib, 500 so'mga yuqoriga yaxlitlaydi */
export function applySurge(amount: number, surge: number): number {
  if (!(surge > 1)) return amount
  return Math.ceil((amount * surge) / ROUNDING_STEP) * ROUNDING_STEP
}

/** Talab/taklif nisbati → koeffitsiyent (nisbat shu qiymatgacha bo'lsa) */
export const SURGE_STEPS: [ratio: number, multiplier: number][] = [
  [1, 1],
  [1.5, 1.2],
  [2, 1.4],
  [3, 1.7],
]
export const SURGE_TOP = 2
/** Admin tanlay oladigan eng yuqori koeffitsiyentlar */
export const SURGE_MAX_OPTIONS = [1.5, 2, 2.5, 3] as const
/** Talab shu radiusda hisoblanadi (m) */
export const SURGE_RADIUS_M = 3000

/**
 * Yuqori talab koeffitsiyenti.
 * @param demand atrofdagi ochiq buyurtmalar (yangisi bilan birga)
 * @param supply atrofdagi bo'sh onlayn haydovchilar
 * Haydovchi umuman bo'lmasa ham bitta buyurtmaga narx oshmaydi (nisbat = buyurtmalar soni).
 */
export function surgeMultiplier(demand: number, supply: number, max: number): number {
  if (demand <= 0 || max <= 1) return 1
  const ratio = demand / Math.max(supply, 1)
  const step = SURGE_STEPS.find(([limit]) => ratio <= limit)
  return Math.min(step ? step[1] : SURGE_TOP, max)
}

/** 1.4 → "×1.4" */
export function formatSurge(surge: number): string {
  return `×${Number(surge.toFixed(2))}`
}

/** Ikki vaqt orasidagi daqiqalar (kutish uchun) */
export function minutesBetween(from: string | Date, to: string | Date): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, ms / 60000)
}

/** Haydovchi kutgan vaqt uchun haq (bepul daqiqalardan keyin) */
export function waitingFeeFor(tariff: TariffConfig, waitingMin: number): number {
  return calculatePrice(tariff, 0, 0, waitingMin).waiting
}

const sumFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** 18500 → "18 500 so'm" */
export function formatSum(amount: number): string {
  return `${sumFormatter.format(amount).replace(/\s/g, ' ')} so'm`
}
