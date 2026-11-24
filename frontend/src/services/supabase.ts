import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured =
  Boolean(url && anonKey) && !url.includes('your-project')

export const supabase = createClient(
  isSupabaseConfigured ? url : 'http://localhost',
  isSupabaseConfigured ? anonKey : 'placeholder',
)

export type ConnectionResult = { ok: true } | { ok: false; error: string }

export async function checkSupabaseConnection(): Promise<ConnectionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: '.env faylida Supabase URL va anon key kiritilmagan' }
  }
  const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' })
  return error ? { ok: false, error: error.message } : { ok: true }
}
