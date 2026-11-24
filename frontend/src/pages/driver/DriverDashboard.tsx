import { ChevronRight, Clock3, FlaskConical, Pencil, RefreshCw, Satellite, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CarForm from '../../components/driver/CarForm'
import SoundBar from '../../components/driver/SoundBar'
import StandingStrip from '../../components/driver/StandingStrip'
import MapShell from '../../components/layout/MapShell'
import CarDetails from '../../components/orders/CarDetails'
import Button from '../../components/ui/Button'
import { RatingBadge } from '../../components/ui/Stars'
import Segmented from '../../components/ui/Segmented'
import Switch from '../../components/ui/Switch'
import { cn } from '../../components/ui/cn'
import AnimatedCarMarker from '../../maps/AnimatedCarMarker'
import RouteMap from '../../maps/RouteMap'
import { useDriverPosition, type PositionSource } from '../../maps/useDriverPosition'
import { useRoute } from '../../maps/useRoute'
import { useAuthStore } from '../../store/authStore'
import { formatSum } from '../../services/pricing'
import { useDriverStore } from '../../store/driverStore'
import { useEarningsStore } from '../../store/earningsStore'
import { useOrderStore } from '../../store/orderStore'
import { useWalletStore } from '../../store/walletStore'
import { stopRinging } from '../../utils/sound'
import DriverOrderPanel, { FinishedCard } from './components/DriverOrderPanel'
import OpenOrdersList from './components/OpenOrdersList'

function PendingApproval({ onEditCar }: { onEditCar: () => void }) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const car = useCar()
  return (
    <div className="space-y-4 py-4 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-soft text-amber-700 dark:text-brand">
        <Clock3 className="size-8" />
      </span>
      <div>
        <p className="text-xl font-extrabold tracking-tight">Tasdiqlash kutilmoqda</p>
        <p className="mt-1 text-sm text-muted">Admin hisobingizni tekshirgach, buyurtmalarni qabul qila olasiz.</p>
      </div>
      {car && (
        <div className="rounded-2xl bg-subtle p-3 text-left">
          <CarDetails car={car} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" icon={<Pencil className="size-4" />} onClick={onEditCar}>
          Mashina
        </Button>
        <Button variant="secondary" className="flex-1" icon={<RefreshCw className="size-4" />} onClick={() => refreshProfile()}>
          Yangilash
        </Button>
      </div>
    </div>
  )
}

/** Profildagi mashina (kiritilmagan bo'lsa null) */
function useCar() {
  const p = useAuthStore((s) => s.profile)
  return p?.car_plate ? { model: p.car_model ?? '', color: p.car_color ?? '', plate: p.car_plate } : null
}

/** Bugungi daromad — bosilsa tarix sahifasi */
function EarningsStrip() {
  const { summary, load } = useEarningsStore()
  const connected = useOrderStore((s) => s.connected)
  const finishedId = useOrderStore((s) => s.finishedOrder?.id)
  // Ulanganda va har safar tugaganda yangilanadi
  useEffect(() => {
    if (connected) load()
  }, [connected, finishedId, load])
  return (
    <Link to="/history" className="mb-4 flex items-center gap-3 rounded-3xl border border-line p-3.5 transition hover:bg-subtle">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Bugungi daromad</p>
        <p className="text-lg font-extrabold tracking-tight">
          {summary ? formatSum(summary.today.amount) : '—'}
          <span className="ml-2 text-sm font-medium text-muted">{summary ? `${summary.today.trips} ta safar` : ''}</span>
        </p>
      </div>
      {summary && <RatingBadge rating={summary.rating} count={summary.ratingCount || undefined} />}
      <ChevronRight className="size-5 text-muted" />
    </Link>
  )
}

export default function DriverDashboard() {
  const approved = useAuthStore((s) => s.profile?.is_approved)
  const car = useCar()
  const [editingCar, setEditingCar] = useState(false)
  const { activeOrder, finishedOrder, connected, acceptOrder, setStatus, dismissFinished } = useOrderStore()
  const { online, wantsOnline, openOrders, error: driverError, bind, setOnline, sendLocation } = useDriverStore()
  const [source, setSource] = useState<PositionSource>('sim')
  const standing = useWalletStore((s) => s.standing)
  const loadWallet = useWalletStore((s) => s.loadDetails)
  // Oflayn bo'lsa ham balans/ball ko'rinsin
  useEffect(() => {
    if (connected && approved) void loadWallet()
  }, [connected, approved, loadWallet])

  useEffect(() => (approved ? bind() : undefined), [bind, approved])

  // Simulyatsiyada mashina: qabul qilinganda → yo'lovchiga, safarda → manzilga
  const simTarget =
    activeOrder?.status === 'accepted' ? activeOrder.pickup : activeOrder?.status === 'in_trip' ? activeOrder.dropoff : null
  const { position, error: gpsError } = useDriverPosition({ enabled: online, source, simTarget })

  // Har yangi koordinatani serverga yuborish (server o'zi ham 1 soniyada 1 tadan ko'p qabul qilmaydi)
  useEffect(() => {
    if (!online || !position) return
    sendLocation(position)
    // Joyida turganda ham "tirik"likni bildirish: yaqin haydovchilar faqat oxirgi 2 daqiqadagilar
    const heartbeat = setInterval(() => sendLocation(position), 30_000)
    return () => clearInterval(heartbeat)
  }, [online, position, sendLocation])

  const { route } = useRoute(activeOrder?.pickup ?? null, activeOrder?.dropoff ?? null)
  const isOnline = wantsOnline && online
  const blocked = Boolean(standing?.blockMessage)

  // Signal: buyurtma olindi / ro'yxat bo'shadi / oflayn / buyurtma berilmaydigan holat — to'xtaydi
  useEffect(() => {
    if (!isOnline || activeOrder || !openOrders.length || blocked) stopRinging()
  }, [isOnline, activeOrder, openOrders.length, blocked])
  useEffect(() => stopRinging, [])

  const map = (
    <RouteMap pickup={activeOrder?.pickup ?? null} dropoff={activeOrder?.dropoff ?? null} route={route}>
      {position && <AnimatedCarMarker position={position} heading={position.heading} />}
    </RouteMap>
  )

  // Mashinasiz ishlab bo'lmaydi: yo'lovchi qaysi mashinaga o'tirishini bilishi kerak
  if (!car || (editingCar && !activeOrder)) {
    return (
      <MapShell map={map}>
        <CarForm onDone={() => setEditingCar(false)} onCancel={car ? () => setEditingCar(false) : undefined} />
      </MapShell>
    )
  }

  if (!approved) {
    return (
      <MapShell map={map}>
        <PendingApproval onEditCar={() => setEditingCar(true)} />
      </MapShell>
    )
  }

  return (
    <MapShell map={map}>
      {!connected && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <WifiOff className="size-4" /> Server bilan aloqa yo‘q — qayta ulanmoqda…
        </p>
      )}

      {/* Onlayn holati */}
      <div
        className={cn(
          'mb-4 flex items-center justify-between gap-3 rounded-3xl p-4 transition-colors',
          isOnline ? 'bg-emerald-500/12' : 'bg-subtle',
        )}
      >
        <div>
          <p className="text-lg font-extrabold tracking-tight">{isOnline ? 'Siz onlaynsiz' : 'Siz oflaynsiz'}</p>
          <p className="text-sm text-muted">{isOnline ? `${openOrders.length} ta ochiq buyurtma` : 'Buyurtma olish uchun yoqing'}</p>
        </div>
        <Switch checked={isOnline} onChange={setOnline} disabled={!connected} label="Onlayn" />
      </div>

      {isOnline && !activeOrder && <SoundBar />}
      {!activeOrder && standing && <StandingStrip standing={standing} />}
      {!activeOrder && <EarningsStrip />}

      {(driverError || gpsError) && <p className="mb-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{driverError ?? gpsError}</p>}

      {activeOrder ? (
        <DriverOrderPanel order={activeOrder} position={position} onStatus={(to, extra) => setStatus(activeOrder.id, to, extra)} />
      ) : finishedOrder ? (
        <FinishedCard order={finishedOrder} onNext={dismissFinished} />
      ) : isOnline && blocked ? (
        <p className="py-6 text-center text-sm text-muted">Hozir sizga yangi buyurtma yuborilmaydi. Sababi yuqorida ko‘rsatilgan.</p>
      ) : isOnline ? (
        <OpenOrdersList orders={openOrders} position={position} onAccept={acceptOrder} />
      ) : (
        <p className="py-6 text-center text-sm text-muted">Onlayn bo‘lganingizda yaqin atrofdagi buyurtmalar shu yerda chiqadi.</p>
      )}

      {!activeOrder && (
        <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
          <div className="min-w-0 flex-1">
            <CarDetails car={car} />
          </div>
          <button
            onClick={() => setEditingCar(true)}
            aria-label="Mashinani o‘zgartirish"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-xs font-medium text-muted">Joylashuv manbai</p>
        <Segmented
          value={source}
          onChange={setSource}
          options={[
            { value: 'sim', label: <><FlaskConical /> Simulyatsiya</> },
            { value: 'gps', label: <><Satellite /> GPS</> },
          ]}
        />
      </div>
    </MapShell>
  )
}
