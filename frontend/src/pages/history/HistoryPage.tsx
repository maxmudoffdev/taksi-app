import { ArrowLeft, CircleSlash, Loader2, MessageSquareQuote, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Notices from '../../components/Notices'
import UserMenu from '../../components/layout/UserMenu'
import { TariffIcon } from '../../components/tariffs/tariffIcon'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Plate from '../../components/ui/Plate'
import { StarInput, StarsRow } from '../../components/ui/Stars'
import { dashboardPath } from '../../services/auth'
import { formatSum } from '../../services/pricing'
import { useAuthStore } from '../../store/authStore'
import { useEarningsStore, type EarningsPeriod } from '../../store/earningsStore'
import { useHistoryStore } from '../../store/historyStore'
import { useOrderStore } from '../../store/orderStore'
import type { Order } from '../../types'

const dayFormat = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'long', weekday: 'long' })
const timeFormat = new Intl.DateTimeFormat('uz-UZ', { hour: '2-digit', minute: '2-digit' })

/** "Bugun" / "Kecha" / "23-noyabr, yakshanba" */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Bugun'
  if (d.toDateString() === yesterday.toDateString()) return 'Kecha'
  return dayFormat.format(d)
}

function groupByDay(orders: Order[]): [string, Order[]][] {
  const groups = new Map<string, Order[]>()
  for (const o of orders) {
    const key = dayLabel(o.createdAt)
    groups.set(key, [...(groups.get(key) ?? []), o])
  }
  return [...groups]
}

function StatTile({ label, period }: { label: string; period?: EarningsPeriod }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold tracking-tight">{period ? formatSum(period.amount) : '—'}</p>
      <p className="text-xs text-muted">{period ? `${period.trips} ta safar` : ''}</p>
    </Card>
  )
}

function RateInline({ order }: { order: Order }) {
  const rateOrder = useOrderStore((s) => s.rateOrder)
  const replace = useHistoryStore((s) => s.replace)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rate = async (rating: number) => {
    setBusy(true)
    setError(null)
    try {
      replace(await rateOrder(order.id, rating))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" icon={<Star className="size-4" />} onClick={() => setOpen(true)}>
        Baholash
      </Button>
    )
  }
  return (
    <div className="w-full">
      <StarInput value={0} onChange={rate} disabled={busy} />
      {error && <p className="mt-1 text-center text-xs text-red-600">{error}</p>}
    </div>
  )
}

function TripRow({ order, asDriver }: { order: Order; asDriver: boolean }) {
  const cancelled = order.status === 'cancelled'
  const total = order.price + order.waitingFee
  const counterpart = asDriver ? order.passengerName : order.driverName
  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5 text-sm">
          <p className="flex items-center gap-2 truncate">
            <span className="size-2 shrink-0 rounded-full bg-ink" />
            <span className="truncate">{order.pickupAddress ?? order.pickupNote ?? 'Xaritadagi nuqta'}</span>
          </p>
          <p className="flex items-center gap-2 truncate text-muted">
            <span className="size-2 shrink-0 rounded-full bg-red-500" />
            <span className="truncate">{order.dropoffAddress ?? (order.dropoff ? 'Xaritadagi nuqta' : 'Manzil yo‘lda aytilgan')}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cancelled ? 'font-semibold text-muted line-through' : 'text-lg font-extrabold tracking-tight'}>{formatSum(total)}</p>
          <p className="text-xs text-muted">{timeFormat.format(new Date(order.createdAt))}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge icon={<TariffIcon id={order.tariff} />}>{order.distanceKm != null ? `${order.distanceKm.toFixed(1)} km` : 'Telefon'}</Badge>
        {cancelled && (
          <Badge tone="danger" icon={<CircleSlash />}>
            Bekor qilingan
          </Badge>
        )}
        {counterpart && <span className="text-muted">{asDriver ? 'Yo‘lovchi' : 'Haydovchi'}: <b className="font-semibold text-fg">{counterpart}</b></span>}
        {!asDriver && order.driverCar && <Plate plate={order.driverCar.plate} className="h-6 text-xs" />}
      </div>

      {order.status === 'completed' && (
        <div className="flex flex-wrap items-center gap-2">
          {order.rating ? (
            <>
              <StarsRow value={order.rating} />
              {order.ratingComment && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <MessageSquareQuote className="size-3.5" /> {order.ratingComment}
                </span>
              )}
            </>
          ) : asDriver ? (
            <span className="text-xs text-muted">Baholanmagan</span>
          ) : (
            order.source === 'app' && <RateInline order={order} />
          )}
        </div>
      )}
    </li>
  )
}

/** Yo'lovchi: "Mening safarlarim"; haydovchi: daromad va safarlar */
export default function HistoryPage() {
  const profile = useAuthStore((s) => s.profile)
  const connected = useOrderStore((s) => s.connected)
  const { orders, hasMore, loading, error, reload, loadMore } = useHistoryStore()
  const { summary, load: loadSummary } = useEarningsStore()
  const asDriver = profile?.role === 'driver'

  useEffect(() => {
    if (!connected) return
    reload()
    if (asDriver) loadSummary()
  }, [connected, asDriver, reload, loadSummary])

  return (
    <div className="min-h-full bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to={profile ? dashboardPath[profile.role] : '/'}
              aria-label="Orqaga"
              className="flex size-10 items-center justify-center rounded-full hover:bg-subtle"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="truncate text-xl font-bold tracking-tight">{asDriver ? 'Daromad va safarlar' : 'Mening safarlarim'}</h1>
          </div>
          <UserMenu />
        </div>
      </header>
      <Notices />

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {asDriver && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Bugun" period={summary?.today} />
            <StatTile label="7 kun" period={summary?.week} />
            <StatTile label="30 kun" period={summary?.month} />
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">Reyting</p>
              <p className="mt-1 flex items-center gap-1 text-xl font-extrabold tracking-tight">
                <Star className="size-5 fill-amber-400 text-amber-400" />
                {summary?.rating != null ? summary.rating.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-muted">{summary ? `${summary.ratingCount} ta baho` : ''}</p>
            </Card>
          </div>
        )}

        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

        {!orders.length && !loading && !error && (
          <Card className="py-12 text-center">
            <p className="text-lg font-bold">Hali safarlar yo‘q</p>
            <p className="mt-1 text-sm text-muted">{asDriver ? 'Yakunlangan safarlaringiz shu yerda chiqadi.' : 'Birinchi safaringizdan keyin shu yerda chiqadi.'}</p>
          </Card>
        )}

        {groupByDay(orders).map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted first-letter:uppercase">{day}</h2>
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {list.map((o) => (
                  <TripRow key={o.id} order={o} asDriver={asDriver} />
                ))}
              </ul>
            </Card>
          </section>
        ))}

        {loading && (
          <p className="flex justify-center py-4 text-muted">
            <Loader2 className="size-5 animate-spin" />
          </p>
        )}
        {hasMore && !loading && (
          <Button variant="secondary" block onClick={loadMore}>
            Yana ko‘rsatish
          </Button>
        )}
      </main>
    </div>
  )
}
