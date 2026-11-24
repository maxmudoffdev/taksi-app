import { Percent } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { commissionFor, COMMISSION_MAX_PCT } from '../../../services/wallet'
import { formatSum } from '../../../services/pricing'
import { useAdminStore } from '../../../store/adminStore'

/** Har bir safardan olinadigan komissiya (%) — SurgeSettings bilan birga yuklanadi */
export default function CommissionSettings() {
  const { commissionPct, updateCommission } = useAdminStore()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (commissionPct == null) {
    return (
      <div className="rounded-3xl border border-dashed border-line p-5 text-sm text-muted">
        Komissiya va haydovchi balansi o‘chiq — <b>013_wallet_score.sql</b> ni Supabase’da ishga tushiring.
      </div>
    )
  }

  const value = draft ?? String(commissionPct)
  const pct = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= COMMISSION_MAX_PCT

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setMessage(null)
    try {
      await updateCommission(pct)
      setDraft(null)
      setMessage({ ok: true, text: 'Saqlandi — keyingi yakunlangan safarlardan qo‘llanadi' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-line/70 bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-subtle text-muted">
            <Percent className="size-5" />
          </span>
          <div>
            <p className="text-lg font-bold">Komissiya</p>
            <p className="text-sm text-muted">
              Har bir yakunlangan safardan haydovchi balansidan yechiladi. Masalan, 30 000 so‘mlik safardan —{' '}
              <b className="text-fg">{valid ? formatSum(commissionFor(30_000, pct)) : '—'}</b>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-11 w-24 items-center rounded-xl border border-line bg-surface px-3 focus-within:border-brand">
            <input
              inputMode="decimal"
              aria-label="Komissiya foizi"
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-w-0 bg-transparent font-semibold outline-none tabular-nums"
            />
            <span className="text-muted">%</span>
          </label>
          <button
            disabled={!valid || busy || draft === null || pct === commissionPct}
            className="h-11 rounded-xl bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-40"
          >
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
      {!valid && <p className="mt-2 text-sm text-red-600">0 dan {COMMISSION_MAX_PCT} gacha son kiriting</p>}
      {message && <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
    </form>
  )
}
