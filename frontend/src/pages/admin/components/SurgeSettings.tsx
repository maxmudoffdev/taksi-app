import { Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../../../components/ui/cn'
import Switch from '../../../components/ui/Switch'
import { formatSurge, SURGE_MAX_OPTIONS, SURGE_STEPS, SURGE_TOP } from '../../../services/pricing'
import { useAdminStore } from '../../../store/adminStore'

/** Yuqori talab narxi: yoqish/o'chirish va eng yuqori koeffitsiyent */
export default function SurgeSettings() {
  const { surge, loadSettings, updateSurge } = useAdminStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSettings().catch((e: Error) => setError(e.message))
  }, [loadSettings])

  const save = async (patch: Parameters<typeof updateSurge>[0]) => {
    setBusy(true)
    setError(null)
    try {
      await updateSurge(patch)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const enabled = surge?.enabled ?? false
  const steps = [...SURGE_STEPS.slice(1), [Infinity, SURGE_TOP] as const].filter(([, m]) => m <= (surge?.max ?? 2))

  return (
    <div className="rounded-3xl border border-line/70 bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', enabled ? 'bg-amber-500 text-white' : 'bg-subtle text-muted')}>
            <Zap className="size-5" />
          </span>
          <div>
            <p className="text-lg font-bold">Yuqori talab narxi</p>
            <p className="text-sm text-muted">
              Atrofda (3 km) buyurtma bo‘sh haydovchidan ko‘p bo‘lsa, narx avtomatik oshadi — haydovchilar shu hududga keladi.
            </p>
          </div>
        </div>
        <Switch checked={enabled} onChange={(v) => save({ enabled: v })} disabled={busy || !surge} label="Yuqori talab narxi" />
      </div>

      {enabled && (
        <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Eng ko‘pi bilan:</span>
            {SURGE_MAX_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => save({ max: m })}
                disabled={busy}
                className={cn(
                  'rounded-full px-3 py-1 font-semibold transition',
                  surge?.max === m ? 'bg-ink text-on-ink' : 'bg-subtle hover:bg-line',
                )}
              >
                {formatSurge(m)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            Buyurtma / bo‘sh haydovchi:{' '}
            {steps.map(([ratio, m], i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {Number.isFinite(ratio) ? `${ratio} gacha` : 'undan ko‘p'} → <b className="text-fg">{formatSurge(Math.min(m, surge?.max ?? m))}</b>
              </span>
            ))}
            . Kutish haqi oshmaydi.
          </p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
