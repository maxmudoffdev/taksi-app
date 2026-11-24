import { useEffect, useState } from 'react'
import { checkSupabaseConnection, type ConnectionResult } from '../services/supabase'
import { checkBackendHealth, type HealthResult } from '../services/backend'

type Status = { state: 'loading' } | { state: 'ok'; detail?: string } | { state: 'error'; detail: string }

function StatusRow({ label, status }: { label: string; status: Status }) {
  const color =
    status.state === 'ok' ? 'bg-green-500' : status.state === 'error' ? 'bg-red-500' : 'bg-line animate-pulse'
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      <div>
        <p className="font-medium">{label}</p>
        {'detail' in status && status.detail && <p className="text-sm text-muted">{status.detail}</p>}
      </div>
    </li>
  )
}

const toStatus = (r: ConnectionResult): Status => (r.ok ? { state: 'ok' } : { state: 'error', detail: r.error })

export default function StatusPage() {
  const [db, setDb] = useState<Status>({ state: 'loading' })
  const [api, setApi] = useState<Status>({ state: 'loading' })

  useEffect(() => {
    checkSupabaseConnection().then((r) => {
      console.log('[Supabase]', r.ok ? 'ulandi ✅' : `xato ❌ ${r.error}`)
      setDb(toStatus(r))
    })
    checkBackendHealth().then((r: HealthResult) => {
      console.log('[Backend]', r.ok ? 'ishlayapti ✅' : `xato ❌ ${r.error}`)
      setApi(r.ok ? { state: 'ok', detail: `Backend → Supabase: ${r.supabase ? 'ulandi' : 'ulanmadi'}` } : { state: 'error', detail: r.error })
    })
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-subtle p-4 text-fg">
      <div className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-bold">🚕 Taksi</h1>
        <p className="mt-1 text-sm text-muted">1-bosqich: tizim holati</p>
        <ul className="mt-4 divide-y divide-line">
          <StatusRow label="Frontend (Vite + Tailwind)" status={{ state: 'ok' }} />
          <StatusRow label="Supabase bazasi" status={db} />
          <StatusRow label="Backend server" status={api} />
        </ul>
      </div>
    </main>
  )
}
