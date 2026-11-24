import { BACKEND_URL } from './backendUrl'

export type HealthResult = { ok: true; supabase: boolean } | { ok: false; error: string }

export async function checkBackendHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = (await res.json()) as { supabase: boolean }
    return { ok: true, supabase: data.supabase }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
