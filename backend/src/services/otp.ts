import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

export const CODE_LENGTH = 6
export const CODE_TTL_MS = 5 * 60_000
export const RESEND_MS = 60_000
export const MAX_ATTEMPTS = 5

type Entry = { hash: Buffer; expiresAt: number; sentAt: number; attempts: number }

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing' | 'expired' | 'locked' | 'wrong'; attemptsLeft?: number }

const hashOf = (key: string, code: string) => createHash('sha256').update(`${key}:${code}`).digest()

/**
 * Bir martalik kirish kodlari (xotirada, faqat xeshi saqlanadi).
 * Kod 5 daqiqa amal qiladi, 60 soniyada bir marta yuboriladi, 5 marta xato kiritilsa — bekor bo'ladi.
 */
export class CodeStore {
  private entries = new Map<string, Entry>()

  constructor(private readonly now: () => number = Date.now) {}

  /** Yangi kod. Oldingisi yaqinda yuborilgan bo'lsa — qancha kutish kerakligi (ms) */
  issue(key: string): { code: string } | { retryInMs: number } {
    this.prune()
    const t = this.now()
    const prev = this.entries.get(key)
    if (prev && t - prev.sentAt < RESEND_MS) return { retryInMs: RESEND_MS - (t - prev.sentAt) }
    const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
    this.entries.set(key, { hash: hashOf(key, code), expiresAt: t + CODE_TTL_MS, sentAt: t, attempts: 0 })
    return { code }
  }

  /** Qayta yuborishgacha qolgan vaqt (ms); kod bo'lmasa — 0 */
  resendInMs(key: string): number {
    const e = this.entries.get(key)
    return e ? Math.max(0, RESEND_MS - (this.now() - e.sentAt)) : 0
  }

  verify(key: string, code: string): VerifyResult {
    const e = this.entries.get(key)
    if (!e) return { ok: false, reason: 'missing' }
    if (this.now() > e.expiresAt) {
      this.entries.delete(key)
      return { ok: false, reason: 'expired' }
    }
    if (e.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' }
    const given = hashOf(key, code.trim())
    if (timingSafeEqual(given, e.hash)) {
      this.entries.delete(key)
      return { ok: true }
    }
    e.attempts++
    if (e.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' }
    return { ok: false, reason: 'wrong', attemptsLeft: MAX_ATTEMPTS - e.attempts }
  }

  private prune() {
    const t = this.now()
    for (const [k, e] of this.entries) if (t > e.expiresAt) this.entries.delete(k)
  }
}

/** Oddiy oynali cheklov: `limit` ta urinish `windowMs` ichida */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(t)
    this.hits.set(key, recent)
    if (this.hits.size > 10_000) this.hits.clear()
    return true
  }
}
