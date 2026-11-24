import { PhoneCall, Pin, X } from 'lucide-react'
import { useState } from 'react'
import { STATUS_LABEL } from '../../../../../shared/orderStatus'
import Badge from '../../../components/ui/Badge'
import { formatSum } from '../../../services/pricing'
import type { DriverMarker } from '../../../store/adminStore'
import type { Order, OrderStatus } from '../../../types'

const statusTone: Partial<Record<OrderStatus, 'warning' | 'info' | 'violet' | 'success'>> = {
  created: 'warning',
  accepted: 'info',
  arrived: 'violet',
  in_trip: 'success',
}

const ago = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'hozir' : `${min} daq oldin`
}

type Props = {
  orders: Order[]
  onCancel: (id: string) => Promise<void>
  /** Berilsa — "haydovchi qidirilmoqda" buyurtmani qo'lda biriktirish mumkin */
  freeDrivers?: DriverMarker[]
  onAssign?: (orderId: string, driverId: string) => Promise<void>
}

export default function ActiveOrders({ orders, onCancel, freeDrivers, onAssign }: Props) {
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!orders.length) return <p className="py-10 text-center text-sm text-muted">Hozir faol buyurtmalar yo‘q</p>

  return (
    <div className="space-y-2.5">
      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded-2xl border border-line bg-surface p-3.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={statusTone[o.status] ?? 'neutral'}>{STATUS_LABEL[o.status]}</Badge>
              {o.source === 'phone' && (
                <Badge tone="info" icon={<PhoneCall />}>
                  {o.passengerPhone}
                </Badge>
              )}
            </div>
            <span className="font-extrabold">{o.priceIsEstimate ? `≥ ${formatSum(o.price)}` : formatSum(o.price + o.waitingFee)}</span>
          </div>
          <div className="mt-2.5 space-y-1">
            <p className="flex items-center gap-2 truncate">
              <span className="size-2 shrink-0 rounded-full bg-ink" />
              {o.pickup ? (o.pickupAddress ?? 'Xaritadagi nuqta') : 'Xaritada belgilanmagan'}
            </p>
            {o.pickupNote && (
              <p className="flex items-center gap-2 truncate text-amber-700 dark:text-amber-400">
                <Pin className="size-3 shrink-0" /> {o.pickupNote}
              </p>
            )}
            <p className="flex items-center gap-2 truncate text-muted">
              <span className="size-2 shrink-0 rounded-full bg-red-500" />
              {o.dropoff ? (o.dropoffAddress ?? 'Xaritadagi nuqta') : 'Manzil — yo‘lda'}
            </p>
          </div>
          {o.status === 'created' && onAssign && freeDrivers && freeDrivers.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => e.target.value && run(() => onAssign(o.id, e.target.value))}
              className="mt-3 h-10 w-full rounded-xl border border-line bg-subtle px-3 text-sm font-medium"
              aria-label="Haydovchiga berish"
            >
              <option value="" disabled>
                Haydovchiga berish…
              </option>
              {freeDrivers.map((d) => (
                <option key={d.driverId} value={d.driverId}>
                  {d.fullName ?? 'Haydovchi'}
                </option>
              ))}
            </select>
          )}
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate">
              {o.passengerName ?? '—'}
              {o.driverName && <> → {o.driverName}</>} · {ago(o.createdAt)}
            </span>
            {o.status !== 'in_trip' && (
              <button
                onClick={() => confirm('Buyurtmani bekor qilasizmi?') && run(() => onCancel(o.id))}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-medium text-red-600 hover:bg-red-500/10"
              >
                <X className="size-3.5" /> Bekor qilish
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
