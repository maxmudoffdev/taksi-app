/**
 * Suiiste'moldan himoya: IP aniqlash, so'rov/ulanish chegaralari, xavfsizlik sarlavhalari.
 * Qiymatlar O'zbekiston mobil tarmoqlarini hisobga oladi: ko'p foydalanuvchi bitta umumiy IP ortida (CGNAT).
 */
import type { NextFunction, Request, Response } from 'express'
import type { IncomingHttpHeaders } from 'node:http'
import { RateLimiter } from './services/otp.js'

/**
 * Proksi orqasida (Render, Cloudflare) nechta ishonchli bo'g'in bor.
 * 0 — proksisiz (lokal): X-Forwarded-For'ga ishonilmaydi, aks holda uni soxtalashtirib cheklovni chetlab o'tish mumkin.
 */
export const TRUST_PROXY_HOPS = Math.max(0, Math.floor(Number(process.env.TRUST_PROXY ?? 0)) || 0)

export function clientIp(headers: IncomingHttpHeaders, remote: string | undefined): string {
  if (TRUST_PROXY_HOPS > 0) {
    const raw = headers['x-forwarded-for']
    const list = (Array.isArray(raw) ? raw.join(',') : (raw ?? '')).split(',').map((s) => s.trim()).filter(Boolean)
    const ip = list[list.length - TRUST_PROXY_HOPS]
    if (ip) return ip
  }
  return remote ?? 'unknown'
}

/** Bitta IP'dan yangi socket ulanishlari: daqiqasiga 120 ta */
export const connectLimit = new RateLimiter(120, 60_000)
/** Bitta foydalanuvchining bir vaqtdagi ulanishlari (bir nechta tab/qurilma) */
export const MAX_SOCKETS_PER_USER = 5

/** Og'ir so'rovlar (bazani ko'p yuklaydi) */
const HEAVY_EVENTS = new Set([
  'surge:quote',
  'history:list',
  'driver:summary',
  'driver:wallet',
  'dispatch:lookup',
  'admin:orders',
  'admin:wallet',
  'admin:snapshot',
  'admin:drivers',
  'admin:dispatchers',
])
/** O'zining chegarasi bor (soniyasiga 1 ta) — umumiy hisobga kirmaydi */
const SELF_LIMITED = new Set(['driver:location'])

const generalLimit = new RateLimiter(40, 10_000) // har foydalanuvchiga 10 soniyada 40 ta
const heavyLimit = new RateLimiter(15, 10_000) // og'irlari — 15 ta
const abuseLimit = new RateLimiter(150, 10_000) // bundan oshsa — ulanish uziladi

export type EventVerdict = 'ok' | 'limited' | 'abuse'

export function checkEvent(userId: string, event: string): EventVerdict {
  if (!abuseLimit.allow(userId)) return 'abuse'
  if (SELF_LIMITED.has(event)) return 'ok'
  if (!generalLimit.allow(userId)) return 'limited'
  if (HEAVY_EVENTS.has(event) && !heavyLimit.allow(userId)) return 'limited'
  return 'ok'
}

export const RATE_LIMIT_MESSAGE = 'Juda tez-tez so‘rov yuborilmoqda. Bir necha soniya kuting.'

/**
 * Token tashqi ko'rinishini tekshirish (Supabase'ga so'rov yubormasdan):
 * axlat yoki muddati o'tgan tokenlar bilan bazani band qilishning oldini oladi.
 * Imzoni Supabase'ning o'zi tekshiradi (verifyToken).
 */
export function looksLikeValidJwt(token: string, supabaseUrl: string, now = Date.now()): boolean {
  if (token.length > 4096) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as { exp?: number; sub?: string; iss?: string }
    if (typeof p.exp !== 'number' || p.exp * 1000 < now) return false
    if (typeof p.sub !== 'string' || !p.sub) return false
    if (supabaseUrl && typeof p.iss === 'string' && !p.iss.startsWith(supabaseUrl.replace(/\/$/, ''))) return false
    return true
  } catch {
    return false
  }
}

/** API javoblari uchun asosiy xavfsizlik sarlavhalari */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader('Cache-Control', 'no-store')
  next()
}
