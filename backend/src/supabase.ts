import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const isSupabaseConfigured = Boolean(url && key) && !url.includes('your-project')

/** Backend RLS'ni chetlab o'tishi uchun maxfiy (secret / service_role) kalit kerak */
export const isSecretKey = key.startsWith('sb_secret_') || jwtRole(key) === 'service_role'

function jwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    return payload ? (JSON.parse(Buffer.from(payload, 'base64url').toString()).role ?? null) : null
  } catch {
    return null
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

export function db() {
  if (!supabase) throw new Error('Supabase sozlanmagan (.env)')
  return supabase
}

export async function checkSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: '.env faylida Supabase sozlanmagan' }
  const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' })
  return error ? { ok: false, error: error.message } : { ok: true }
}
