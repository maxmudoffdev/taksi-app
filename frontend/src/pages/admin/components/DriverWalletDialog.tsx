import { Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ZONE_STYLE } from '../../../components/driver/zoneStyle'
import Button from '../../../components/ui/Button'
import { cn } from '../../../components/ui/cn'
import Segmented from '../../../components/ui/Segmented'
import { formatSum } from '../../../services/pricing'
import { SCORE_REASON_LABEL, TX_KIND_LABEL } from '../../../services/wallet'
import { useAdminStore, type DriverRow } from '../../../store/adminStore'
import type { WalletDetails } from '../../../store/walletStore'

const QUICK_TOPUPS = [50_000, 100_000, 200_000]
const when = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** Admin: haydovchi balansini to'ldirish, ballni tuzatish va tarixini ko'rish */
export default function DriverWalletDialog({ driver, onClose }: { driver: DriverRow; onClose: () => void }) {
  const { driverWallet, changeBalance, changeScore } = useAdminStore()
  const [details, setDetails] = useState<WalletDetails | null>(null)
  const [tab, setTab] = useState<'balance' | 'score'>('balance')
  const [amount, setAmount] = useState('')
  const [scoreDelta, setScoreDelta] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const reload = useCallback(() => driverWallet(driver.id).then(setDetails, (e: Error) => setError(e.message)), [driverWallet, driver.id])
  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(null)
    const raw = tab === 'balance' ? amount : scoreDelta
    const n = Number(raw.replace(/\s/g, ''))
    if (!Number.isInteger(n) || n === 0) return setError(tab === 'balance' ? 'Summani kiriting (masalan: 50000 yoki −5000)' : 'Ball o‘zgarishini kiriting (masalan: 10 yoki −10)')
    if (tab === 'score' && !note.trim()) return setError('Sababini yozing')
    if (tab === 'balance' && n < 0 && !note.trim()) return setError('Balansdan ayirishda izoh yozing')
    setBusy(true)
    try {
      if (tab === 'balance') await changeBalance(driver.id, n, note)
      else await changeScore(driver.id, n, note)
      setDone(tab === 'balance' ? `${n > 0 ? '+' : '−'}${formatSum(Math.abs(n))} yozildi` : `${signed(n)} ball yozildi`)
      setAmount('')
      setScoreDelta('')
      setNote('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const st = details?.standing
  const zone = st ? ZONE_STYLE[st.zone] : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${driver.fullName ?? 'Haydovchi'} hisobi`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-card sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{driver.fullName ?? 'Haydovchi'}</p>
            <p className="text-xs text-muted">{driver.phone ?? ''}</p>
          </div>
          <button onClick={onClose} aria-label="Yopish" className="flex size-10 items-center justify-center rounded-full hover:bg-subtle">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-subtle p-3">
              <p className="text-xs text-muted">Balans</p>
              <p className={cn('text-xl font-extrabold tabular-nums', st && st.balance < 0 && 'text-red-600 dark:text-red-400')}>{st ? formatSum(st.balance) : '—'}</p>
            </div>
            <div className="rounded-2xl bg-subtle p-3">
              <p className="text-xs text-muted">Ball</p>
              <p className={cn('flex items-center gap-1.5 text-xl font-extrabold tabular-nums', zone?.text)}>
                {zone && <span className={cn('size-2 rounded-full', zone.dot)} />}
                {st?.score ?? '—'}
              </p>
            </div>
          </div>
          {details?.blockMessage && <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">⛔ {details.blockMessage}</p>}

          <Segmented
            value={tab}
            onChange={(v) => {
              setTab(v)
              setError(null)
              setDone(null)
            }}
            options={[
              { value: 'balance', label: 'Balans' },
              { value: 'score', label: 'Ball' },
            ]}
          />

          <form onSubmit={submit} className="space-y-3">
            {tab === 'balance' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TOPUPS.map((v) => (
                    <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full bg-subtle px-3 py-1.5 text-sm font-semibold hover:bg-line">
                      +{formatSum(v)}
                    </button>
                  ))}
                </div>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder="Summa, so‘m (ayirish uchun: -5000)"
                  aria-label="Summa"
                  className="h-11 w-full rounded-xl border border-line bg-surface px-3 tabular-nums outline-none focus:border-brand"
                />
              </>
            ) : (
              <input
                inputMode="numeric"
                value={scoreDelta}
                onChange={(e) => setScoreDelta(e.target.value.replace(/[^\d-]/g, ''))}
                placeholder="Ball: 10 yoki -10"
                aria-label="Ball o‘zgarishi"
                className="h-11 w-full rounded-xl border border-line bg-surface px-3 tabular-nums outline-none focus:border-brand"
              />
            )}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder={tab === 'balance' ? 'Izoh (masalan: naqd, ofisda)' : 'Sabab (shart)'}
              aria-label="Izoh"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {done && <p className="text-sm text-emerald-600">✅ {done}</p>}
            <Button type="submit" block loading={busy}>
              {tab === 'balance' ? 'Balansga yozish' : 'Ballni o‘zgartirish'}
            </Button>
          </form>

          <div>
            <p className="mb-2 text-sm font-semibold">Tarix</p>
            {!details ? (
              <p className="flex justify-center py-4 text-muted">
                <Loader2 className="size-5 animate-spin" />
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {(tab === 'balance'
                  ? details.transactions.map((t) => ({
                      id: t.id,
                      title: TX_KIND_LABEL[t.kind],
                      note: t.note,
                      at: t.createdAt,
                      value: `${t.amount > 0 ? '+' : '−'}${formatSum(Math.abs(t.amount))}`,
                      positive: t.amount > 0,
                    }))
                  : details.scoreEvents.map((e) => ({
                      id: e.id,
                      title: SCORE_REASON_LABEL[e.reason] ?? e.reason,
                      note: e.note,
                      at: e.createdAt,
                      value: `${signed(e.delta)} → ${e.scoreAfter}`,
                      positive: e.delta > 0,
                    }))
                ).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted">
                        {when.format(new Date(r.at))}
                        {r.note && ` · ${r.note}`}
                      </p>
                    </div>
                    <span className={cn('font-semibold tabular-nums', r.positive ? 'text-emerald-600' : 'text-red-600')}>{r.value}</span>
                  </li>
                ))}
                {!(tab === 'balance' ? details.transactions : details.scoreEvents).length && <li className="px-3 py-4 text-center text-sm text-muted">Hali yozuv yo‘q</li>}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
