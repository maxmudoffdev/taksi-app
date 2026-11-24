import { LayoutDashboard, PhoneCall, Radio } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import StaffLayout, { type NavItem } from '../../components/layout/StaffLayout'
import Badge from '../../components/ui/Badge'
import Card, { SectionTitle } from '../../components/ui/Card'
import { usePlacePoint } from '../../hooks/usePlacePoint'
import AnimatedCarMarker from '../../maps/AnimatedCarMarker'
import RouteMap from '../../maps/RouteMap'
import { useRoute } from '../../maps/useRoute'
import { useAdminStore } from '../../store/adminStore'
import { useAuthStore } from '../../store/authStore'
import { useDispatchStore } from '../../store/dispatchStore'
import type { LatLng } from '../../types'
import ActiveOrders from '../admin/components/ActiveOrders'
import NewCallForm from './components/NewCallForm'

export default function DispatcherDashboard() {
  const role = useAuthStore((s) => s.profile?.role)
  const { drivers, orders, error, bind, cancelOrder } = useAdminStore()
  const assign = useDispatchStore((s) => s.assign)
  useEffect(() => bind(), [bind])

  const from = usePlacePoint()
  const to = usePlacePoint()
  const [mapMode, setMapMode] = useState<'A' | 'B'>('A')
  const [focus, setFocus] = useState<LatLng | null>(null)

  const pickupPoint = useMemo(() => (from.place ? { lat: from.place.lat, lng: from.place.lng } : null), [from.place?.lat, from.place?.lng])
  const dropoffPoint = useMemo(() => (to.place ? { lat: to.place.lat, lng: to.place.lng } : null), [to.place?.lat, to.place?.lng])
  const { route } = useRoute(pickupPoint, dropoffPoint)

  // Faol buyurtmasi bor haydovchilar band hisoblanadi
  const busy = new Set(orders.map((o) => o.driverId).filter(Boolean))
  const allDrivers = Object.values(drivers)
  const freeDrivers = allDrivers.filter((d) => !busy.has(d.driverId))
  const searching = orders.filter((o) => o.status === 'created').length

  const onMapClick = (p: LatLng) => {
    if (mapMode === 'A') {
      from.setPoint(p)
      setMapMode('B')
    } else {
      to.setPoint(p)
    }
  }

  const nav: NavItem[] = [
    { key: 'call', label: 'Qo‘ng‘iroqlar', icon: <PhoneCall />, active: true, badge: searching || undefined },
    ...(role === 'admin' ? [{ key: 'admin', label: 'Admin panel', icon: <LayoutDashboard />, to: '/admin' }] : []),
  ]

  return (
    <StaffLayout
      nav={nav}
      title="Dispetcher"
      actions={
        <div className="hidden gap-1.5 sm:flex">
          <Badge tone="success" icon={<Radio />}>
            {allDrivers.length} onlayn
          </Badge>
          <Badge tone="neutral">{freeDrivers.length} bo‘sh</Badge>
        </div>
      }
    >
      {error && <p className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
        <Card className="p-5">
          <SectionTitle>Yangi qo‘ng‘iroq</SectionTitle>
          <NewCallForm from={from} to={to} route={route} mapMode={mapMode} onMapModeChange={setMapMode} onFocus={setFocus} freeDrivers={freeDrivers} />
        </Card>

        <div className="space-y-5">
          <div className="relative h-[50vh] min-h-[380px] overflow-hidden rounded-3xl border border-line/70 shadow-card">
            <RouteMap
              pickup={from.place}
              dropoff={to.place}
              route={route}
              focus={focus}
              onMapClick={onMapClick}
              onPickupMove={from.setPoint}
              onDropoffMove={to.setPoint}
            >
              {allDrivers.map((d) => (
                <AnimatedCarMarker key={d.driverId} position={d} heading={d.heading} />
              ))}
            </RouteMap>
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
              <span className="rounded-full bg-surface/95 px-4 py-2 text-xs font-semibold shadow-card backdrop-blur">
                Bosish → {mapMode === 'A' ? 'A · mijoz turgan joy' : 'B · manzil'}
              </span>
            </div>
          </div>

          <Card>
            <SectionTitle>Faol buyurtmalar · {orders.length}</SectionTitle>
            <ActiveOrders orders={orders} onCancel={cancelOrder} freeDrivers={freeDrivers} onAssign={async (o, d) => void (await assign(o, d))} />
          </Card>
        </div>
      </div>
    </StaffLayout>
  )
}
