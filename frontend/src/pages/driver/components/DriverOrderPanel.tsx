import { CheckCircle2, CircleSlash, Flag, MapPin, Navigation, PhoneCall, Pin, Play, UserX, Zap } from 'lucide-react'
import { useState } from 'react'
import { STATUS_LABEL } from '../../../../../shared/orderStatus'
import PersonRow from '../../../components/orders/PersonRow'
import WaitingTimer from '../../../components/orders/WaitingTimer'
import { TariffIcon } from '../../../components/tariffs/tariffIcon'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import { cn } from '../../../components/ui/cn'
import { Field } from '../../../components/ui/Field'
import { useEta } from '../../../hooks/useEta'
import { useNow } from '../../../hooks/useNow'
import { distanceM, formatDistance } from '../../../maps/geo'
import { formatSum, formatSurge, freeWaitIsOver, minutesBetween } from '../../../services/pricing'
import { useTariff } from '../../../store/tariffStore'
import type { LatLng, Order, OrderStatus } from '../../../types'

type Action = { to: OrderStatus; label: string; icon: typeof MapPin }

/** Haydovchi nuqtai nazaridan holat */
const DRIVER_LABEL: Partial<Record<OrderStatus, string>> = {
  accepted: 'Yo‘lovchiga boring',
  arrived: 'Yo‘lovchini kuting',
  in_trip: 'Safarda',
}

const PRIMARY: Partial<Record<OrderStatus, Action>> = {
  accepted: { to: 'arrived', label: 'Yetib keldim', icon: MapPin },
  arrived: { to: 'in_trip', label: 'Safarni boshlash', icon: Play },
  in_trip: { to: 'completed', label: 'Safarni yakunlash', icon: Flag },
}

/** Tashqi navigator ilovasida yo'lni ochish */
const navigatorUrl = (p: LatLng) => `https://yandex.uz/maps/?rtext=~${p.lat},${p.lng}&rtt=auto`

type Props = {
  order: Order
  position: LatLng | null
  onStatus: (to: OrderStatus, extra?: { finalPrice?: number; reason?: 'no_show' }) => Promise<unknown>
}

/** Haydovchining faol buyurtmasi va keyingi qadam tugmalari */
export default function DriverOrderPanel({ order, position, onStatus }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalPrice, setFinalPrice] = useState('')
  const tariff = useTariff(order.tariff)
  const primary = PRIMARY[order.status]
  const canCancel = order.status === 'accepted' || order.status === 'arrived'
  const isPhone = order.source === 'phone'
  const target = order.status === 'in_trip' ? order.dropoff : order.pickup
  const toTarget = position && target ? distanceM(position, target) : null
  const eta = useEta(order.status === 'arrived' ? null : position, order.status === 'arrived' ? null : target)

  // "Qayerga" noma'lum bo'lgan safar: yakunlashda haydovchi narxni kiritadi
  const needsFinalPrice = order.status === 'in_trip' && order.priceIsEstimate
  const minFare = tariff?.minFare ?? order.price
  const finalPriceNum = Number(finalPrice)
  const finalPriceValid = Number.isInteger(finalPriceNum) && finalPriceNum >= minFare

  // "Mijoz chiqmadi" — bepul kutish tugagach chiqadi
  const now = useNow(order.status === 'arrived')
  const canNoShow =
    order.status === 'arrived' && !!order.arrivedAt && !!tariff && freeWaitIsOver(tariff, minutesBetween(order.arrivedAt, new Date(now)))

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const noShow = () => confirm('Mijoz chiqmadimi? Buyurtma bekor qilinadi.') && act(() => onStatus('cancelled', { reason: 'no_show' }))
  const cancel = () => confirm('Buyurtmani bekor qilasizmi?') && act(() => onStatus('cancelled'))
  const next = () => {
    if (!primary) return
    if (primary.to === 'completed' && needsFinalPrice && !finalPriceValid) return setError(`Yakuniy narxni kiriting (kamida ${formatSum(minFare)})`)
    act(() => onStatus(primary.to, needsFinalPrice ? { finalPrice: finalPriceNum } : undefined))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {isPhone && (
              <Badge tone="info" icon={<PhoneCall />}>
                Telefon buyurtma
              </Badge>
            )}
            <Badge tone="neutral" icon={<TariffIcon id={order.tariff} />}>
              {tariff?.name}
            </Badge>
            {order.surge > 1 && (
              <Badge tone="warning" icon={<Zap />}>
                {formatSurge(order.surge)}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xl font-extrabold tracking-tight">{DRIVER_LABEL[order.status] ?? STATUS_LABEL[order.status]}</p>
          {toTarget !== null && order.status !== 'arrived' && (
            <p className="text-sm text-muted">
              {order.status === 'in_trip' ? 'Manzilgacha' : 'Yo‘lovchigacha'} {formatDistance(toTarget)}
              {eta && eta.min > 0 && ` · ~${eta.min} daq`}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-xl font-extrabold tracking-tight">
            {order.priceIsEstimate ? `≥ ${formatSum(order.price)}` : formatSum(order.price + order.waitingFee)}
          </p>
          {order.distanceKm != null && <p className="text-xs text-muted">{order.distanceKm.toFixed(1)} km</p>}
        </div>
      </div>

      {!order.pickup && order.status === 'accepted' && (
        <p className="rounded-2xl bg-sky-500/10 p-3 text-sm text-sky-800 dark:text-sky-300">
          Mijoz turgan joy xaritada yo‘q. Mo‘ljal bo‘yicha boring yoki mijozga qo‘ng‘iroq qilib aniqlang.
        </p>
      )}

      <div className="relative space-y-3 rounded-2xl bg-subtle p-3 text-sm">
        <span className="absolute top-6 bottom-6 left-[19px] w-0.5 bg-line" />
        <p className={cn('relative flex items-center gap-3', order.status === 'in_trip' && 'text-muted')}>
          <span className="size-3 shrink-0 rounded-full bg-ink ring-4 ring-subtle" />
          <span className="truncate font-medium">{order.pickup ? (order.pickupAddress ?? 'Xaritadagi nuqta') : 'Mo‘ljal bo‘yicha'}</span>
        </p>
        <p className={cn('relative flex items-center gap-3', order.status !== 'in_trip' && 'text-muted')}>
          <span className="size-3 shrink-0 rounded-full bg-red-500 ring-4 ring-subtle" />
          <span className="truncate font-medium">{order.dropoff ? (order.dropoffAddress ?? 'Xaritadagi nuqta') : 'Manzilni mijoz yo‘lda aytadi'}</span>
        </p>
      </div>

      {order.pickupNote && order.status !== 'in_trip' && (
        <div className="flex gap-3 rounded-2xl border-2 border-amber-400/60 bg-amber-500/10 p-3">
          <Pin className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Mo‘ljal</p>
            <p className="font-semibold">{order.pickupNote}</p>
          </div>
        </div>
      )}

      <PersonRow label="Yo‘lovchi" name={order.passengerName} phone={order.passengerPhone} showPhone={isPhone} highlightCall={isPhone} />

      {order.status === 'arrived' && order.arrivedAt && tariff && <WaitingTimer arrivedAt={order.arrivedAt} tariff={tariff} />}
      {order.waitingFee > 0 && <p className="text-sm text-muted">Kutish haqi: + {formatSum(order.waitingFee)}</p>}

      {needsFinalPrice && (
        <Field
          label="Yakuniy narx"
          type="number"
          inputMode="numeric"
          min={minFare}
          step={500}
          value={finalPrice}
          onChange={(e) => setFinalPrice(e.target.value)}
          placeholder={String(minFare)}
          suffix="so‘m"
          hint={`Manzil oldindan noma’lum edi. Kamida ${formatSum(minFare)}${order.waitingFee > 0 ? `; kutish haqi alohida qo‘shiladi` : ''}.`}
        />
      )}

      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {primary && (
          <Button
            size="lg"
            block
            variant={primary.to === 'completed' ? 'success' : 'primary'}
            icon={<primary.icon className="size-5" />}
            loading={busy}
            disabled={needsFinalPrice && primary.to === 'completed' && !finalPriceValid}
            onClick={next}
          >
            {primary.label}
          </Button>
        )}
        <div className="flex gap-2">
          {target && (
            <a
              href={navigatorUrl(target)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-subtle text-sm font-semibold hover:bg-line"
            >
              <Navigation className="size-4" /> Navigator
            </a>
          )}
          {canNoShow && (
            <Button variant="danger" className="flex-1" icon={<UserX className="size-4" />} onClick={noShow} disabled={busy}>
              Mijoz chiqmadi
            </Button>
          )}
          {canCancel && !canNoShow && (
            <Button variant="secondary" className="flex-1" icon={<CircleSlash className="size-4" />} onClick={cancel} disabled={busy}>
              Bekor qilish
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function FinishedCard({ order, onNext }: { order: Order; onNext: () => void }) {
  const done = order.status === 'completed'
  const text = done
    ? 'Safar yakunlandi'
    : order.cancelReason === 'no_show'
      ? 'Mijoz chiqmadi — buyurtma yopildi'
      : order.cancelReason === 'passenger'
        ? 'Yo‘lovchi bekor qildi'
        : 'Buyurtma bekor qilindi'
  return (
    <div className="space-y-4 py-2 text-center">
      <span className={cn('mx-auto flex size-16 items-center justify-center rounded-full', done ? 'bg-emerald-500 text-white' : 'bg-subtle text-muted')}>
        {done ? <CheckCircle2 className="size-8" /> : <CircleSlash className="size-8" />}
      </span>
      <p className="text-xl font-extrabold tracking-tight">{text}</p>
      {done && <p className="text-4xl font-extrabold tracking-tight">{formatSum(order.price + order.waitingFee)}</p>}
      <Button size="lg" block onClick={onNext}>
        Yangi buyurtmalar
      </Button>
    </div>
  )
}
