import { CheckCircle2, CircleSlash, Loader2, MapPin, Navigation, Timer, Zap } from 'lucide-react'
import { useState } from 'react'
import { canTransition, STATUS_LABEL } from '../../../../shared/orderStatus'
import { formatSum, formatSurge } from '../../services/pricing'
import { useTariff } from '../../store/tariffStore'
import type { CancelReason, Order, OrderStatus } from '../../types'
import { TariffIcon } from '../tariffs/tariffIcon'
import Button from '../ui/Button'
import { cn } from '../ui/cn'
import { RatingBadge, StarInput, StarsRow } from '../ui/Stars'
import CarDetails from './CarDetails'
import PersonRow from './PersonRow'
import WaitingTimer from './WaitingTimer'

const STEPS: OrderStatus[] = ['created', 'accepted', 'arrived', 'in_trip', 'completed']

const CANCEL_TEXT: Partial<Record<CancelReason, string>> = {
  passenger: 'Siz buyurtmani bekor qildingiz.',
  driver: 'Haydovchi buyurtmani bekor qildi.',
  staff: 'Buyurtma dispetcher tomonidan bekor qilindi.',
  no_show: 'Haydovchi yetib kelib, sizni kutdi — buyurtma bekor qilindi.',
  timeout: 'Hozir bo‘sh haydovchi topilmadi. Birozdan keyin qayta urinib ko‘ring.',
  stale: 'Buyurtma uzoq vaqt yangilanmagani uchun yopildi.',
}

const HEADLINE: Record<OrderStatus, { icon: typeof MapPin; sub: string; tone: string }> = {
  created: { icon: Loader2, sub: 'Yaqin atrofdagi haydovchilarga yuborildi', tone: 'bg-brand text-on-brand' },
  accepted: { icon: Navigation, sub: 'Haydovchi siz tomonga kelmoqda', tone: 'bg-sky-500 text-white' },
  arrived: { icon: MapPin, sub: 'Haydovchi sizni kutmoqda', tone: 'bg-violet-500 text-white' },
  in_trip: { icon: Navigation, sub: 'Yaxshi yo‘l!', tone: 'bg-emerald-500 text-white' },
  completed: { icon: CheckCircle2, sub: 'Safaringiz uchun rahmat', tone: 'bg-emerald-500 text-white' },
  cancelled: { icon: CircleSlash, sub: '', tone: 'bg-subtle text-muted' },
}

type Props = {
  order: Order
  onCancel?: () => Promise<unknown>
  onClose?: () => void
  /** Haydovchi yetib kelishiga qolgan taxminiy vaqt (daqiqa) */
  etaMin?: number | null
  onRate?: (rating: number, comment?: string) => Promise<unknown>
}

/** Baholashdan keyin tez tanlanadigan izohlar */
const QUICK_COMMENTS: Record<'good' | 'bad', string[]> = {
  good: ['Toza mashina', 'Xushmuomala', 'Ehtiyotkor haydadi', 'Tez yetib keldi'],
  bad: ['Kechikdi', 'Mashina iflos', 'Qo‘pol muomala', 'Xavfli haydadi'],
}

function RateTrip({ onRate }: { onRate: (rating: number, comment?: string) => Promise<unknown> }) {
  const [rating, setRating] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chips = rating ? QUICK_COMMENTS[rating >= 4 ? 'good' : 'bad'] : []

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRate(rating, picked.join(', ') || undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line p-4 text-center">
      <p className="font-semibold">Safar qanday o‘tdi?</p>
      <StarInput
        value={rating}
        disabled={busy}
        onChange={(v) => {
          setRating(v)
          setPicked([])
        }}
      />
      {!!chips.length && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {chips.map((c) => {
            const on = picked.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c) : [...p, c]))}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  on ? 'border-ink bg-ink text-on-ink' : 'border-line hover:bg-subtle',
                )}
              >
                {c}
              </button>
            )
          })}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rating > 0 && (
        <Button variant="dark" block loading={busy} onClick={send}>
          Baholash
        </Button>
      )}
    </div>
  )
}

/** Yo'lovchi uchun buyurtma holati */
export default function OrderStatusCard({ order, onCancel, onClose, etaMin, onRate }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tariff = useTariff(order.tariff)
  const stepIndex = STEPS.indexOf(order.status)
  const finished = order.status === 'completed' || order.status === 'cancelled'
  const total = order.price + order.waitingFee
  const head = HEADLINE[order.status]
  const HeadIcon = head.icon

  const cancel = async () => {
    if (!onCancel) return
    setBusy(true)
    setError(null)
    try {
      await onCancel()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', head.tone)}>
          <HeadIcon className={cn('size-6', order.status === 'created' && 'animate-spin')} />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-extrabold tracking-tight">{STATUS_LABEL[order.status]}</p>
          <p className="text-sm text-muted">
            {order.status === 'cancelled'
              ? ((order.cancelReason && CANCEL_TEXT[order.cancelReason]) ?? '')
              : order.status === 'accepted' && etaMin != null
                ? etaMin <= 1
                  ? 'Haydovchi hozir yetib keladi'
                  : `Haydovchi ~${etaMin} daqiqada yetib keladi`
                : head.sub}
          </p>
        </div>
      </div>

      {order.status !== 'cancelled' && (
        <ol className="flex gap-1.5" aria-label="Buyurtma bosqichlari">
          {STEPS.map((s, i) => (
            <li key={s} title={STATUS_LABEL[s]} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= stepIndex ? 'bg-brand' : 'bg-line')} />
          ))}
        </ol>
      )}

      {order.driverName && order.status !== 'cancelled' && (
        <PersonRow
          label="Haydovchingiz"
          name={order.driverName}
          phone={finished ? null : order.driverPhone}
          meta={<RatingBadge rating={order.driverRating} count={order.driverRatingCount || undefined} />}
        >
          {order.driverCar && <CarDetails car={order.driverCar} />}
        </PersonRow>
      )}

      {order.status === 'arrived' && order.arrivedAt && tariff && <WaitingTimer arrivedAt={order.arrivedAt} tariff={tariff} />}

      <div className="rounded-2xl border border-line p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-muted">
            <TariffIcon id={order.tariff} className="size-4" />
            {tariff?.name}
            {order.distanceKm != null && (
              <>
                {' · '}
                {order.distanceKm.toFixed(1)} km · {order.durationMin} daq
              </>
            )}
          </span>
          {!order.waitingFee && <span className="text-lg font-extrabold">{formatSum(order.price)}</span>}
        </div>
        {order.surge > 1 && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Zap className="size-3.5" /> Yuqori talab · narx {formatSurge(order.surge)}
          </p>
        )}
        {order.waitingFee > 0 && (
          <div className="mt-2 space-y-1 border-t border-line pt-2">
            <div className="flex justify-between text-muted">
              <span>Safar</span>
              <span>{formatSum(order.price)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span className="flex items-center gap-1">
                <Timer className="size-3.5" /> Kutish
              </span>
              <span>+ {formatSum(order.waitingFee)}</span>
            </div>
            <div className="flex justify-between pt-1 text-base">
              <span className="font-semibold">Jami</span>
              <span className="font-extrabold">{formatSum(total)}</span>
            </div>
          </div>
        )}
      </div>

      {order.status === 'completed' &&
        (order.rating ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-subtle p-3 text-sm text-muted">
            Bahoingiz: <StarsRow value={order.rating} /> · Rahmat!
          </p>
        ) : (
          onRate && order.source === 'app' && <RateTrip onRate={onRate} />
        ))}

      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      {!finished && onCancel && canTransition(order.status, 'cancelled', 'passenger') && (
        <Button variant="secondary" block onClick={cancel} loading={busy}>
          Buyurtmani bekor qilish
        </Button>
      )}
      {finished && onClose && (
        <Button size="lg" block onClick={onClose}>
          Yangi buyurtma
        </Button>
      )}
    </div>
  )
}
