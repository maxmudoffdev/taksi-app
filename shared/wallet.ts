/**
 * Haydovchi balansi (komissiya) va ball tizimi — backend va frontend uchun umumiy qoidalar.
 *  - Har bir yakunlangan safardan komissiya olinadi (standart 10%, admin o'zgartiradi).
 *  - Balans 0 dan kam bo'lsa — yangi buyurtma berilmaydi (oxirgi safar minusga tushirishi mumkin).
 *  - Ball 0–100: yashil ≥ 70 (darhol), sariq 40–69 (15 s kechikib), qizil < 40 (1 soat pauza).
 */

export const SCORE_START = 80
export const SCORE_MAX = 100
export const SCORE_GREEN = 70
export const SCORE_YELLOW = 40
/** Sariq zonadagi haydovchiga yangi buyurtma shuncha kechikib ko'rinadi */
export const YELLOW_DELAY_MS = 15_000
/** Qizilga tushganda pauza */
export const RED_PAUSE_MIN = 60
/** Har kuni o'z-o'zidan tiklanish */
export const SCORE_DAILY_RECOVERY = 3

export const SCORE_DELTA = {
  completed: 2,
  rating_5: 1,
  rating_low: -5,
  driver_cancel: -10,
} as const

export type ScoreReason = keyof typeof SCORE_DELTA | 'daily' | 'admin' | 'red_reset'

export const SCORE_REASON_LABEL: Record<ScoreReason, string> = {
  completed: 'Safar yakunlandi',
  rating_5: 'Yo‘lovchi 5★ qo‘ydi',
  rating_low: 'Past baho (1–2★)',
  driver_cancel: 'Buyurtmani bekor qildingiz',
  daily: 'Kunlik tiklanish',
  admin: 'Admin tuzatdi',
  red_reset: 'Pauza tugadi',
}

export type ScoreZone = 'green' | 'yellow' | 'red'

export function scoreZone(score: number): ScoreZone {
  if (score >= SCORE_GREEN) return 'green'
  if (score >= SCORE_YELLOW) return 'yellow'
  return 'red'
}

export const clampScore = (s: number) => Math.min(SCORE_MAX, Math.max(0, Math.round(s)))

export const COMMISSION_DEFAULT_PCT = 10
export const COMMISSION_MAX_PCT = 30

/** Komissiya: safar umumiy narxidan (narx + kutish haqi) foiz, 100 so'mgacha yaxlitlanadi */
export function commissionFor(total: number, pct: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(pct) || pct <= 0) return 0
  return Math.round((total * pct) / 100 / 100) * 100
}

export type TxKind = 'commission' | 'topup' | 'adjust'

export const TX_KIND_LABEL: Record<TxKind, string> = {
  commission: 'Komissiya',
  topup: 'Balans to‘ldirildi',
  adjust: 'Tuzatish',
}

export interface WalletTx {
  id: string
  amount: number
  kind: TxKind
  orderId: string | null
  note: string | null
  balanceAfter: number
  createdAt: string
}

export interface ScoreEvent {
  id: string
  delta: number
  reason: ScoreReason
  orderId: string | null
  note: string | null
  scoreAfter: number
  createdAt: string
}

/** Haydovchining hozirgi holati */
export interface DriverStanding {
  balance: number
  score: number
  zone: ScoreZone
  /** Qizil pauza tugaydigan vaqt (pauza bo'lmasa — null) */
  redUntil: string | null
  commissionPct: number
}

export type DispatchBlock = { reason: 'balance'; balance: number } | { reason: 'red'; until: string }

/** Haydovchiga hozir buyurtma berish mumkinmi; yo'q bo'lsa — nega */
export function dispatchBlock(s: Pick<DriverStanding, 'balance' | 'redUntil'>, now = Date.now()): DispatchBlock | null {
  if (s.balance < 0) return { reason: 'balance', balance: s.balance }
  if (s.redUntil && new Date(s.redUntil).getTime() > now) return { reason: 'red', until: s.redUntil }
  return null
}
