/**
 * Telegram orqali kirish:
 *  1) ilovada telefon → raqam botga ulangan bo'lsa, kod darhol Telegram'ga yuboriladi;
 *     ulanmagan bo'lsa — botni ochish havolasi (t.me/bot?start=<nonce>) qaytadi;
 *  2) botda "📱 Raqamni yuborish" → Telegram raqamni tasdiqlaydi → kod yuboriladi;
 *  3) ilovada kod → mavjud hisobga sessiya, yangi raqam bo'lsa — ism/rol so'raladi va hisob yaratiladi.
 */
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { isValidPlate, normalizePlate } from '../../../shared/types'
import { BLOCKED_MESSAGE } from '../auth.js'
import { db } from '../supabase.js'
import { CodeStore } from './otp.js'
import { dbError } from './orders.service.js'
import { getBotUsername, isBotConfigured, sendMessage, type ReplyMarkup, type TgMessage } from './telegram.bot.js'

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export type TgSession = { access_token: string; refresh_token: string }
export type StartResult = { status: 'code_sent'; resendIn: number } | { status: 'need_bot'; nonce: string; botUrl: string }
export type PendingStatus = 'waiting' | 'code_sent' | 'mismatch' | 'expired'
export type VerifyResult = { status: 'ok'; session: TgSession } | { status: 'new'; ticket: string }

const PENDING_TTL_MS = 15 * 60_000
const TICKET_TTL_MS = 15 * 60_000

type Pending = { phone: string; status: PendingStatus; createdAt: number; chatId?: number }
const pending = new Map<string, Pending>() // nonce → kutilayotgan kirish
const tickets = new Map<string, { phone: string; expiresAt: number }>() // kod tasdiqlangan, hisob yaratilmagan
const codes = new CodeStore()

let tableReady = false
export function setTelegramReady(v: boolean) {
  tableReady = v
}
export const telegramEnabled = () => isBotConfigured && tableReady && Boolean(getBotUsername())

/** Faqat O'zbekiston mobil raqamlari: "+998XXXXXXXXX" */
export function normalizeUzPhone(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const d = v.replace(/\D/g, '')
  if (d.length === 9) return `+998${d}`
  if (d.length === 12 && d.startsWith('998')) return `+${d}`
  return null
}

const prettyPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4')

function ensureEnabled() {
  if (!telegramEnabled()) throw new AuthError('Telegram orqali kirish hozircha ishlamayapti. Email bilan kiring.', 503)
}

function prune() {
  const t = Date.now()
  for (const [k, p] of pending) if (t - p.createdAt > PENDING_TTL_MS) pending.delete(k)
  for (const [k, x] of tickets) if (t > x.expiresAt) tickets.delete(k)
}

async function findLink(phone: string): Promise<{ chat_id: number } | null> {
  const { data, error } = await db().from('telegram_links').select('chat_id').eq('phone', phone).maybeSingle()
  if (error) throw new AuthError(error.message, 500)
  return data
}

async function findProfileByPhone(phone: string) {
  const { data, error } = await db().from('users').select('*').eq('phone', phone).maybeSingle()
  if (error) throw new AuthError(error.message, 500)
  return data as { id: string; is_blocked?: boolean } | null
}

const codeText = (code: string) =>
  `🚕 Kirish kodi: <code>${code}</code>\n\nKodni hech kimga bermang — xodimlarimiz ham uni so‘ramaydi. 5 daqiqa amal qiladi.`

/** Kod yuboradi; 60 soniya ichida qayta so'ralsa — yangisini yubormaydi */
async function sendCode(phone: string, chatId: number): Promise<number> {
  const r = codes.issue(phone)
  if ('retryInMs' in r) return Math.ceil(r.retryInMs / 1000)
  try {
    await sendMessage(chatId, codeText(r.code), { remove_keyboard: true })
  } catch (e) {
    // Foydalanuvchi botni bloklagan bo'lishi mumkin
    console.warn('[telegram] kod yuborilmadi:', e instanceof Error ? e.message : e)
    throw new AuthError('Kodni Telegram’ga yuborib bo‘lmadi. Botni bloklamaganingizni tekshiring va qayta urining.', 502)
  }
  return Math.ceil(codes.resendInMs(phone) / 1000)
}

// ---------------------------------------------------------------- 1. Boshlash

export async function startLogin(rawPhone: unknown): Promise<StartResult> {
  ensureEnabled()
  prune()
  const phone = normalizeUzPhone(rawPhone)
  if (!phone) throw new AuthError('Telefon raqami noto‘g‘ri. Masalan: 90 123 45 67')
  const profile = await findProfileByPhone(phone)
  if (profile?.is_blocked) throw new AuthError(BLOCKED_MESSAGE, 403)

  const link = await findLink(phone)
  if (link) return { status: 'code_sent', resendIn: await sendCode(phone, link.chat_id) }

  const nonce = randomBytes(12).toString('base64url')
  pending.set(nonce, { phone, status: 'waiting', createdAt: Date.now() })
  return { status: 'need_bot', nonce, botUrl: `https://t.me/${getBotUsername()}?start=${nonce}` }
}

export function pendingStatus(nonce: unknown): { status: PendingStatus; resendIn?: number } {
  const p = typeof nonce === 'string' ? pending.get(nonce) : undefined
  if (!p || Date.now() - p.createdAt > PENDING_TTL_MS) return { status: 'expired' }
  return p.status === 'code_sent' ? { status: p.status, resendIn: Math.ceil(codes.resendInMs(p.phone) / 1000) } : { status: p.status }
}

/** Kodni qayta yuborish (raqam botga ulangan bo'lishi kerak) */
export async function resendCode(rawPhone: unknown): Promise<{ resendIn: number }> {
  ensureEnabled()
  const phone = normalizeUzPhone(rawPhone)
  if (!phone) throw new AuthError('Telefon raqami noto‘g‘ri')
  const link = await findLink(phone)
  if (!link) throw new AuthError('Avval Telegram botda raqamingizni ulang')
  return { resendIn: await sendCode(phone, link.chat_id) }
}

// ---------------------------------------------------------------- 2. Bot

const contactKeyboard: ReplyMarkup = {
  keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

export async function handleBotMessage(m: TgMessage): Promise<void> {
  if (m.chat.type !== 'private' || !m.from) return
  const chatId = m.chat.id

  if (m.text?.startsWith('/start')) {
    const nonce = m.text.split(' ')[1]?.trim()
    const p = nonce ? pending.get(nonce) : undefined
    if (p) p.chatId = chatId
    await sendMessage(
      chatId,
      p
        ? `Salom! Ilovaga <b>${prettyPhone(p.phone)}</b> raqami bilan kirmoqdasiz.\n\nPastdagi <b>«📱 Raqamni yuborish»</b> tugmasini bosing — kirish kodi shu yerga keladi.`
        : 'Salom! Bu bot taksi ilovasiga kirish kodlarini yuboradi.\n\nRaqamingizni ulash uchun pastdagi <b>«📱 Raqamni yuborish»</b> tugmasini bosing.',
      contactKeyboard,
    )
    return
  }

  if (m.contact) {
    // Faqat o'z raqami (Telegram tasdiqlagan): boshqaning kontaktini yuborish rad etiladi
    if (m.contact.user_id !== m.from.id) {
      await sendMessage(chatId, 'Iltimos, boshqa kontakt emas, <b>o‘z raqamingizni</b> pastdagi tugma orqali yuboring.', contactKeyboard)
      return
    }
    const phone = normalizeUzPhone(m.contact.phone_number)
    if (!phone) {
      await sendMessage(chatId, 'Kechirasiz, hozircha faqat O‘zbekiston (+998) raqamlari qo‘llab-quvvatlanadi.', { remove_keyboard: true })
      return
    }
    await db().from('telegram_links').delete().eq('tg_user_id', m.from.id).neq('phone', phone)
    const { error } = await db().from('telegram_links').upsert({
      phone,
      chat_id: chatId,
      tg_user_id: m.from.id,
      username: m.from.username ?? null,
      first_name: m.from.first_name ?? null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw dbError(error)

    // Shu chatdan boshlangan kirish boshqa raqamga bo'lsa — aytamiz
    const mine = [...pending.values()].filter((p) => p.chatId === chatId && p.status === 'waiting')
    const mismatched = mine.filter((p) => p.phone !== phone)
    for (const p of mismatched) p.status = 'mismatch'

    const waiting = [...pending.values()].filter((p) => p.phone === phone && p.status === 'waiting')
    if (waiting.length) {
      for (const p of waiting) p.status = 'code_sent'
      await sendCode(phone, chatId).catch(() => undefined)
      return
    }
    if (mismatched.length) {
      await sendMessage(
        chatId,
        `Telegram hisobingiz raqami — <b>${prettyPhone(phone)}</b>, ilovada esa <b>${prettyPhone(mismatched[0].phone)}</b> kiritilgan.\n\nIlovada shu Telegram raqamingizni kiriting.`,
        { remove_keyboard: true },
      )
      return
    }
    await sendMessage(chatId, `✅ <b>${prettyPhone(phone)}</b> raqami ulandi. Endi ilovada shu raqam bilan kiring — kod shu yerga keladi.`, {
      remove_keyboard: true,
    })
    return
  }

  await sendMessage(chatId, 'Kirish kodini olish uchun ilovada telefon raqamingizni kiriting. Raqamni ulash: /start', contactKeyboard)
}

// ---------------------------------------------------------------- 3. Kodni tekshirish va sessiya

/** Supabase sessiyasini backendda yaratadi (email yuborilmaydi): magic link xeshi → verifyOtp */
async function issueSession(userId: string): Promise<TgSession> {
  const { data: u, error } = await db().auth.admin.getUserById(userId)
  if (error || !u.user?.email) throw new AuthError('Hisob topilmadi', 500)
  const link = await db().auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
  if (link.error) throw new AuthError(link.error.message, 500)
  // Alohida mijoz: asosiy (maxfiy kalitli) mijozning holatiga foydalanuvchi sessiyasi yozilmasin
  const temp = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error: vErr } = await temp.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token })
  if (vErr || !data.session) throw new AuthError(vErr?.message ?? 'Sessiya yaratilmadi', 500)
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
}

export async function verifyCode(rawPhone: unknown, rawCode: unknown): Promise<VerifyResult> {
  ensureEnabled()
  prune()
  const phone = normalizeUzPhone(rawPhone)
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : ''
  if (!phone || code.length !== 6) throw new AuthError('6 xonali kodni kiriting')

  const r = codes.verify(phone, code)
  if (!r.ok) {
    const msg = {
      missing: 'Kod topilmadi. Yangi kod so‘rang.',
      expired: 'Kod muddati o‘tgan. Yangi kod so‘rang.',
      locked: 'Ko‘p marta xato kiritildi. Yangi kod so‘rang.',
      wrong: `Kod noto‘g‘ri. Yana ${r.attemptsLeft} ta urinish qoldi.`,
    }[r.reason]
    throw new AuthError(msg)
  }
  for (const [k, p] of pending) if (p.phone === phone) pending.delete(k)

  const profile = await findProfileByPhone(phone)
  if (profile) {
    if (profile.is_blocked) throw new AuthError(BLOCKED_MESSAGE, 403)
    return { status: 'ok', session: await issueSession(profile.id) }
  }
  const ticket = randomBytes(18).toString('base64url')
  tickets.set(ticket, { phone, expiresAt: Date.now() + TICKET_TTL_MS })
  return { status: 'new', ticket }
}

// ---------------------------------------------------------------- 4. Yangi hisob

export async function registerWithTicket(input: unknown): Promise<TgSession> {
  ensureEnabled()
  prune()
  const p = (input ?? {}) as Record<string, unknown>
  const t = typeof p.ticket === 'string' ? tickets.get(p.ticket) : undefined
  if (!t) throw new AuthError('Sessiya muddati o‘tdi. Qaytadan kiring.', 401)

  const fullName = typeof p.fullName === 'string' ? p.fullName.trim().replace(/\s+/g, ' ').slice(0, 80) : ''
  if (fullName.length < 2) throw new AuthError('Ismingizni yozing')
  const role = p.role === 'driver' ? 'driver' : 'passenger'

  let carMeta = {}
  if (role === 'driver') {
    const car = (p.car ?? {}) as Record<string, unknown>
    const model = typeof car.model === 'string' ? car.model.trim().slice(0, 60) : ''
    const color = typeof car.color === 'string' ? car.color.trim().slice(0, 30) : ''
    const plate = normalizePlate(typeof car.plate === 'string' ? car.plate : '')
    if (model.length < 2) throw new AuthError('Mashina rusumini yozing')
    if (color.length < 2) throw new AuthError('Mashina rangini tanlang')
    if (!isValidPlate(plate)) throw new AuthError('Davlat raqami noto‘g‘ri. Masalan: 01 A 123 BC')
    const { data: taken } = await db().from('users').select('id').eq('car_plate', plate).maybeSingle()
    if (taken) throw new AuthError('Bu davlat raqami boshqa haydovchida ro‘yxatdan o‘tgan')
    carMeta = { car_model: model, car_color: color, car_plate: plate }
  }

  if (await findProfileByPhone(t.phone)) throw new AuthError('Bu raqam bilan hisob allaqachon bor. Qaytadan kiring.', 409)

  // Telegram foydalanuvchisining texnik emaili (xat yuborilmaydi, faqat Supabase Auth uchun)
  const email = `${t.phone.slice(1)}@tg.taksi.local`
  const { data, error } = await db().auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: t.phone, role, ...carMeta },
    app_metadata: { signup: 'telegram' },
  })
  if (error || !data.user) {
    console.error('[tg-auth] hisob yaratilmadi:', error?.message)
    throw new AuthError(error?.message.includes('already') ? 'Bu raqam bilan hisob allaqachon bor' : 'Hisob yaratilmadi. Qayta urining.', 500)
  }
  tickets.delete(p.ticket as string)
  return issueSession(data.user.id)
}
