import { BACKEND_URL } from './backendUrl'
import { supabase } from './supabase'

const BASE = `${BACKEND_URL}/api/auth/tg`

export type TgConfig = { enabled: boolean; bot: string | null }
export type StartResult = { status: 'code_sent'; resendIn: number } | { status: 'need_bot'; nonce: string; botUrl: string }
export type PendingStatus = { status: 'waiting' | 'code_sent' | 'mismatch' | 'expired'; resendIn?: number }
type Session = { access_token: string; refresh_token: string }
type VerifyResult = { status: 'ok'; session: Session } | { status: 'new'; ticket: string }

async function request<T>(path: string, body?: object): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Server bilan aloqa yo‘q. Internetni tekshiring.')
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Xato (${res.status})`)
  return data
}

export const tgConfig = () => request<TgConfig>('/config')
export const tgStart = (phone: string) => request<StartResult>('/start', { phone })
export const tgStatus = (nonce: string) => request<PendingStatus>(`/status/${encodeURIComponent(nonce)}`)
export const tgResend = (phone: string) => request<{ resendIn: number }>('/resend', { phone })

async function applySession(s: Session) {
  const { error } = await supabase.auth.setSession(s)
  if (error) throw error
}

/** Kod to'g'ri bo'lsa — tizimga kiradi ('ok') yoki yangi hisob uchun chipta qaytaradi ('new') */
export async function tgVerify(phone: string, code: string): Promise<{ status: 'ok' } | { status: 'new'; ticket: string }> {
  const r = await request<VerifyResult>('/verify', { phone, code })
  if (r.status === 'new') return r
  await applySession(r.session)
  return { status: 'ok' }
}

export type TgRegisterInput = {
  ticket: string
  fullName: string
  role: 'passenger' | 'driver'
  car?: { model: string; color: string; plate: string }
}

export async function tgRegister(input: TgRegisterInput) {
  await applySession(await request<Session>('/register', input))
}
