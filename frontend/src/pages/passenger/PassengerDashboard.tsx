import { ArrowRight, Clock, LocateFixed, Loader2, Route as RouteIcon, WifiOff, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import MapShell from '../../components/layout/MapShell'
import OrderStatusCard from '../../components/orders/OrderStatusCard'
import AddressInput, { RouteInputs } from '../../components/places/AddressInput'
import PriceSummary from '../../components/tariffs/PriceSummary'
import TariffSelector from '../../components/tariffs/TariffSelector'
import Button, { IconButton } from '../../components/ui/Button'
import { useEta } from '../../hooks/useEta'
import { usePlacePoint } from '../../hooks/usePlacePoint'
import { useSurge } from '../../hooks/useSurge'
import AnimatedCarMarker from '../../maps/AnimatedCarMarker'
import RouteMap from '../../maps/RouteMap'
import { useRoute } from '../../maps/useRoute'
import type { Place } from '../../services/geocoding'
import { calculatePrice, formatSum, formatSurge, LONG_ROUTE_KM } from '../../services/pricing'
import { RequestError } from '../../services/socket'
import { useAuthStore } from '../../store/authStore'
import { useOrderStore } from '../../store/orderStore'
import { useTariffs } from '../../store/tariffStore'
import type { LatLng, Tariff } from '../../types'

export default function PassengerDashboard() {
  const name = useAuthStore((s) => s.profile?.full_name)
  const { activeOrder, finishedOrder, driverLocation, connected, createOrder, setStatus, rateOrder, dismissFinished } = useOrderStore()
  const shownOrder = activeOrder ?? finishedOrder

  const from = usePlacePoint()
  const to = usePlacePoint()
  const [focus, setFocus] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  // Buyurtma bor bo'lsa, xaritada uning nuqtalari ko'rsatiladi
  const mapPickup = shownOrder?.pickup ?? from.place
  const mapDropoff = shownOrder?.dropoff ?? to.place
  // useRoute nuqta obyektini taqqoslaydi — label o'zgarganda qayta hisoblamasin
  const pickupPoint = useMemo(() => (mapPickup ? { lat: mapPickup.lat, lng: mapPickup.lng } : null), [mapPickup?.lat, mapPickup?.lng])
  const dropoffPoint = useMemo(() => (mapDropoff ? { lat: mapDropoff.lat, lng: mapDropoff.lng } : null), [mapDropoff?.lat, mapDropoff?.lng])
  const { route, loading, error } = useRoute(pickupPoint, dropoffPoint)

  const [tariffId, setTariffId] = useState<Tariff>('economy')
  const tariffs = useTariffs()
  const selectedTariff = tariffs.find((t) => t.id === tariffId) ?? tariffs[0]
  const { surge, refresh: refreshSurge } = useSurge(shownOrder ? null : from.place)
  const total = route ? calculatePrice(selectedTariff, route.distanceKm, route.durationMin, 0, surge).total : null

  // Haydovchi kelayotganda — yo'l bo'yicha qolgan vaqt
  const coming = activeOrder?.status === 'accepted' ? activeOrder.pickup : null
  const eta = useEta(coming && driverLocation, coming)

  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  // Xaritada bosish: avval bo'sh maydonni to'ldiradi; ikkalasi to'la bo'lsa — yangi A
  const handleMapClick = (p: LatLng) => {
    if (!from.place || to.place) {
      from.setPoint(p)
      to.clear()
    } else {
      to.setPoint(p)
    }
  }

  const pick = (target: typeof from) => (place: Place) => {
    target.select(place)
    setFocus({ lat: place.lat, lng: place.lng })
  }

  const locateMe = () => {
    if (!('geolocation' in navigator)) return setLocateError('Bu qurilmada geolokatsiya yo‘q')
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (!shownOrder) from.setPoint(p)
        setFocus(p)
        setLocating(false)
      },
      (e) => {
        setLocateError(e.code === e.PERMISSION_DENIED ? 'Joylashuvga ruxsat berilmadi' : 'Joylashuv aniqlanmadi')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const reset = () => {
    from.clear()
    to.clear()
  }

  const placeOrder = async () => {
    if (!from.place || !to.place) return
    if (route && route.distanceKm > LONG_ROUTE_KM && !confirm(`Marshrut ${Math.round(route.distanceKm)} km — juda uzoq. Manzillar to‘g‘rimi?`)) return
    setOrdering(true)
    setOrderError(null)
    try {
      await createOrder({
        pickup: { lat: from.place.lat, lng: from.place.lng },
        dropoff: { lat: to.place.lat, lng: to.place.lng },
        pickupAddress: from.place.label || null,
        dropoffAddress: to.place.label || null,
        tariff: tariffId,
        expectedSurge: surge,
      })
    } catch (e) {
      // Talab oshib, narx o'zgargan — yangi koeffitsiyentni olib, yo'lovchiga ko'rsatamiz
      if (e instanceof RequestError && e.code === 'SURGE_CHANGED') refreshSurge()
      setOrderError(e instanceof Error ? e.message : String(e))
    } finally {
      setOrdering(false)
    }
  }

  const startOver = () => {
    dismissFinished()
    reset()
  }

  const map = (
    <RouteMap
      pickup={mapPickup}
      dropoff={mapDropoff}
      route={route}
      focus={focus}
      onMapClick={shownOrder ? undefined : handleMapClick}
      onPickupMove={shownOrder ? undefined : from.setPoint}
      onDropoffMove={shownOrder ? undefined : to.setPoint}
    >
      {activeOrder && driverLocation && <AnimatedCarMarker position={driverLocation} heading={driverLocation.heading} />}
    </RouteMap>
  )

  return (
    <MapShell
      map={map}
      mapActions={
        <IconButton label="Mening joylashuvim" onClick={locateMe} disabled={locating}>
          {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
        </IconButton>
      }
    >
      {!connected && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <WifiOff className="size-4" /> Server bilan aloqa yo‘q — qayta ulanmoqda…
        </p>
      )}

      {shownOrder ? (
        <>
          {(shownOrder.pickupAddress || shownOrder.dropoffAddress) && (
            <div className="mb-4 space-y-1.5 text-sm">
              <p className="flex items-center gap-2 truncate">
                <span className="size-2 shrink-0 rounded-full bg-ink" /> {shownOrder.pickupAddress ?? 'Xaritadagi nuqta'}
              </p>
              <p className="flex items-center gap-2 truncate text-muted">
                <span className="size-2 shrink-0 rounded-full bg-red-500" /> {shownOrder.dropoffAddress ?? 'Xaritadagi nuqta'}
              </p>
            </div>
          )}
          <OrderStatusCard
            order={shownOrder}
            etaMin={eta?.min}
            onCancel={activeOrder ? () => setStatus(activeOrder.id, 'cancelled') : undefined}
            onRate={(rating, comment) => rateOrder(shownOrder.id, rating, comment)}
            onClose={startOver}
          />
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted">Salom{name ? `, ${name.split(' ')[0]}` : ''} 👋</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Qayerga boramiz?</h1>
          </div>

          <RouteInputs>
            <AddressInput
              marker="A"
              placeholder="Qayerdan?"
              value={from.place}
              resolving={from.resolving}
              onSelect={pick(from)}
              onClear={from.clear}
            />
            <AddressInput marker="B" placeholder="Qayerga?" value={to.place} resolving={to.resolving} onSelect={pick(to)} onClear={to.clear} />
          </RouteInputs>
          {locateError && <p className="text-sm text-red-600">{locateError}</p>}

          {!from.place && !to.place && (
            <button
              onClick={locateMe}
              className="flex w-full items-center gap-3 rounded-2xl p-2 text-left text-sm font-medium transition hover:bg-subtle"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-amber-700 dark:text-brand">
                <LocateFixed className="size-5" />
              </span>
              <span>
                Mening joylashuvim
                <span className="block text-xs font-normal text-muted">A nuqtani GPS orqali belgilash</span>
              </span>
            </button>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Marshrut hisoblanmoqda…
            </p>
          )}
          {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

          {route && !loading && (
            <>
              <div className="flex gap-2 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 font-semibold">
                  <RouteIcon className="size-4 text-muted" /> {route.distanceKm.toFixed(1)} km
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 font-semibold">
                  <Clock className="size-4 text-muted" /> {route.durationMin} daq
                </span>
              </div>
              {surge > 1 && (
                <p className="flex items-center gap-2 rounded-2xl bg-amber-500/12 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  <Zap className="size-4 shrink-0" />
                  <span>
                    <b>Talab yuqori</b> — narx {formatSurge(surge)}. Atrofda bo‘sh haydovchi kam.
                  </span>
                </p>
              )}
              <TariffSelector tariffs={tariffs} route={route} selected={tariffId} onSelect={setTariffId} surge={surge} />
              <PriceSummary tariff={selectedTariff} route={route} surge={surge} />
              {orderError && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{orderError}</p>}
              <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-surface via-surface to-transparent px-1 pt-3">
                <Button size="lg" block onClick={placeOrder} loading={ordering} disabled={!connected}>
                  <span className="flex-1 text-left">Buyurtma berish</span>
                  {total !== null && <span className="font-extrabold">{formatSum(total)}</span>}
                  <ArrowRight className="size-5" />
                </Button>
              </div>
            </>
          )}

          {!route && !loading && !error && (from.place || to.place) && (
            <p className="text-sm text-muted">{from.place ? 'Endi B nuqtani tanlang — yozing yoki xaritada bosing.' : 'A nuqtani tanlang.'}</p>
          )}
          {!from.place && !to.place && <p className="text-xs text-muted">Manzilni yozing yoki xaritada bosing: birinchi bosish — A, ikkinchisi — B.</p>}
          {(from.place || to.place) && !route && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Tozalash
            </Button>
          )}
        </div>
      )}
    </MapShell>
  )
}
