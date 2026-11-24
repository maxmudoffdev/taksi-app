import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Notices from '../../components/Notices'
import { ZONE_STYLE } from '../../components/driver/zoneStyle'
import UserMenu from '../../components/layout/UserMenu'
import Card from '../../components/ui/Card'
import { cn } from '../../components/ui/cn'
import Segmented from '../../components/ui/Segmented'
import { formatSum } from '../../services/pricing'
import {
  RED_PAUSE_MIN,
  SCORE_DAILY_RECOVERY,
  SCORE_DELTA,
  SCORE_GREEN,
  SCORE_REASON_LABEL,
  SCORE_YELLOW,
  TX_KIND_LABEL,
  YELLOW_DELAY_MS,
} from '../../services/wallet'
import { useOrderStore } from '../../store/orderStore'
import { useWalletStore } from '../../store/walletStore'

const when = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** Haydovchi: balans, komissiya, ball va ularning tarixi */
export default function WalletPage() {
  const connected = useOrderStore((s) => s.connected)
  const { details, standing, loading, error, loadDetails } = useWalletStore()
  const [tab, setTab] = useState<'balance' | 'score'>('balance')

  useEffect(() => {
    if (connected) void loadDetails()
  }, [connected, loadDetails])

  const zone = standing ? ZONE_STYLE[standing.zone] : null

  return (
    <div className="min-h-full bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/driver" aria-label="Orqaga" className="flex size-10 items-center justify-center rounded-full hover:bg-subtle">
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="truncate text-xl font-bold tracking-tight">Balans va ball</h1>
          </div>
          <UserMenu />
        </div>
      </header>
      <Notices />

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted">Balans</p>
            <p className={cn('mt-1 text-2xl font-extrabold tracking-tight tabular-nums', standing && standing.balance < 0 && 'text-red-600 dark:text-red-400')}>
              {standing ? formatSum(standing.balance) : '—'}
            </p>
            <p className="text-xs text-muted">{standing ? `Komissiya: ${standing.commissionPct}%` : ''}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted">Ball</p>
            <p className={cn('mt-1 flex items-center gap-2 text-2xl font-extrabold tabular-nums', zone?.text)}>
              {zone && <span className={cn('size-2.5 rounded-full', zone.dot)} />}
              {standing?.score ?? '—'}
              <span className="text-sm font-medium text-muted">/ 100</span>
            </p>
            <p className="text-xs text-muted">{zone ? `${zone.label} zona` : ''}</p>
          </Card>
        </div>

        {standing?.blockMessage && (
          <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">⛔ {standing.blockMessage}</p>
        )}

        <Card className="space-y-2 p-4 text-sm">
          <p className="font-semibold">Qanday ishlaydi</p>
          <p className="text-muted">
            Har bir yakunlangan safardan <b className="text-fg">{standing?.commissionPct ?? 10}%</b> komissiya balansdan yechiladi. Balans 0 dan kam bo‘lsa, yangi
            buyurtma kelmaydi — balansni to‘ldirish uchun admin (ofis) bilan bog‘laning.
          </p>
          <ul className="grid gap-1.5 pt-1 sm:grid-cols-3">
            <li className="rounded-2xl bg-emerald-500/10 p-2.5">
              🟢 <b>{SCORE_GREEN}–100</b>
              <span className="block text-xs text-muted">buyurtma darhol keladi</span>
            </li>
            <li className="rounded-2xl bg-amber-500/10 p-2.5">
              🟡 <b>
                {SCORE_YELLOW}–{SCORE_GREEN - 1}
              </b>
              <span className="block text-xs text-muted">{YELLOW_DELAY_MS / 1000} soniya kechikib</span>
            </li>
            <li className="rounded-2xl bg-red-500/10 p-2.5">
              🔴 <b>0–{SCORE_YELLOW - 1}</b>
              <span className="block text-xs text-muted">{RED_PAUSE_MIN} daqiqa pauza</span>
            </li>
          </ul>
          <p className="pt-1 text-xs text-muted">
            Safar: {signed(SCORE_DELTA.completed)} · 5★: {signed(SCORE_DELTA.rating_5)} · 1–2★: {SCORE_DELTA.rating_low} · bekor qilish:{' '}
            {SCORE_DELTA.driver_cancel} · har kuni: +{SCORE_DAILY_RECOVERY}. “Yo‘lovchi chiqmadi” uchun ball ayrilmaydi.
          </p>
        </Card>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'balance', label: 'Balans tarixi' },
            { value: 'score', label: 'Ball tarixi' },
          ]}
        />

        {loading && !details && (
          <p className="flex justify-center py-8 text-muted">
            <Loader2 className="size-5 animate-spin" />
          </p>
        )}

        {details && tab === 'balance' && (
          <History
            empty="Hali balans harakati yo‘q"
            rows={details.transactions.map((t) => ({
              id: t.id,
              title: TX_KIND_LABEL[t.kind],
              note: t.note,
              at: t.createdAt,
              value: `${t.amount > 0 ? '+' : '−'}${formatSum(Math.abs(t.amount))}`,
              positive: t.amount > 0,
              after: formatSum(t.balanceAfter),
            }))}
          />
        )}
        {details && tab === 'score' && (
          <History
            empty="Hali ball o‘zgarmagan"
            rows={details.scoreEvents.map((e) => ({
              id: e.id,
              title: SCORE_REASON_LABEL[e.reason] ?? e.reason,
              note: e.note,
              at: e.createdAt,
              value: signed(e.delta),
              positive: e.delta > 0,
              after: `${e.scoreAfter} ball`,
            }))}
          />
        )}
      </main>
    </div>
  )
}

type Row = { id: string; title: string; note: string | null; at: string; value: string; positive: boolean; after: string }

function History({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">{empty}</p>
  return (
    <Card className="divide-y divide-line p-0">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.title}</p>
            <p className="truncate text-xs text-muted">
              {when.format(new Date(r.at))}
              {r.note && ` · ${r.note}`}
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-sm font-bold tabular-nums', r.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{r.value}</p>
            <p className="text-xs text-muted tabular-nums">{r.after}</p>
          </div>
        </div>
      ))}
    </Card>
  )
}
