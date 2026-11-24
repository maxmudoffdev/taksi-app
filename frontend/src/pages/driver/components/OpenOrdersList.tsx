import { MapPin, PhoneCall, Pin, Radar } from 'lucide-react'
import { useState } from 'react'
import { TariffIcon } from '../../../components/tariffs/tariffIcon'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import { distanceM, formatDistance } from '../../../maps/geo'
import { formatSum } from '../../../services/pricing'
import { useTariffs } from '../../../store/tariffStore'
import type { LatLng, Order } from '../../../types'

type Props = {
  orders: Order[]
  position: LatLng | null
  onAccept: (orderId: string) => Promise<unknown>
}

/** Onlayn haydovchi uchun ochiq buyurtmalar (eng yaqini birinchi) */
export default function OpenOrdersList({ orders, position, onAccept }: Props) {
  const tariffs = useTariffs()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = orders
    .map((o) => ({ order: o, away: position && o.pickup ? distanceM(position, o.pickup) : null }))
    // Joyi belgilanmaganlar ro'yxat oxirida
    .sort((a, b) => (a.away ?? Infinity) - (b.away ?? Infinity))

  const accept = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await onAccept(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="relative flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
          <span className="relative flex size-16 items-center justify-center rounded-full bg-brand-soft text-amber-700 dark:text-brand">
            <Radar className="size-7" />
          </span>
        </span>
        <p className="font-semibold">Buyurtmalar kutilmoqda</p>
        <p className="max-w-[16rem] text-sm text-muted">Yangi buyurtma kelganda ovozli signal chalinadi</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
      {sorted.map(({ order, away }) => {
        const tariff = tariffs.find((t) => t.id === order.tariff)
        return (
          <div key={order.id} className="animate-sheet-in rounded-3xl border border-line bg-surface p-3.5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge icon={<TariffIcon id={order.tariff} />}>{tariff?.name}</Badge>
                {order.source === 'phone' && (
                  <Badge tone="info" icon={<PhoneCall />}>
                    telefon
                  </Badge>
                )}
                {away !== null && (
                  <Badge tone="brand" icon={<MapPin />}>
                    {formatDistance(away)}
                  </Badge>
                )}
              </div>
              <p className="text-xl font-extrabold tracking-tight">
                {order.priceIsEstimate ? `≥ ${formatSum(order.price)}` : formatSum(order.price)}
              </p>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <p className="flex items-center gap-2 truncate">
                <span className="size-2 shrink-0 rounded-full bg-ink" />
                {order.pickup ? (order.pickupAddress ?? 'Xaritadagi nuqta') : <span className="text-sky-600">xaritada belgilanmagan</span>}
              </p>
              {order.pickupNote && (
                <p className="flex items-center gap-2 truncate text-amber-700 dark:text-amber-400">
                  <Pin className="size-3 shrink-0" /> {order.pickupNote}
                </p>
              )}
              <p className="flex items-center gap-2 truncate text-muted">
                <span className="size-2 shrink-0 rounded-full bg-red-500" />
                {order.dropoff ? (order.dropoffAddress ?? 'Xaritadagi nuqta') : 'manzil — yo‘lda'}
                {order.distanceKm != null && <span className="ml-auto shrink-0 text-xs">{order.distanceKm.toFixed(1)} km</span>}
              </p>
            </div>
            <Button block className="mt-3" loading={busyId === order.id} disabled={busyId !== null && busyId !== order.id} onClick={() => accept(order.id)}>
              Qabul qilish
            </Button>
          </div>
        )
      })}
    </div>
  )
}
