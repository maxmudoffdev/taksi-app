import { Marker, Popup, Tooltip } from 'react-leaflet'
import { STATUS_LABEL } from '../../../../../shared/orderStatus'
import AnimatedCarMarker from '../../../maps/AnimatedCarMarker'
import { orderDotIcon } from '../../../maps/markerIcons'
import RouteMap from '../../../maps/RouteMap'
import type { DriverMarker } from '../../../store/adminStore'
import type { Order } from '../../../types'

const searchingIcon = orderDotIcon(true)
const activeIcon = orderDotIcon(false)

/** Barcha onlayn haydovchilar va faol buyurtmalarning A nuqtalari */
export default function LiveMap({ drivers, orders }: { drivers: DriverMarker[]; orders: Order[] }) {
  return (
    <RouteMap pickup={null} dropoff={null} route={null}>
      {orders.map(
        (o) =>
          o.pickup && (
            <Marker key={o.id} position={o.pickup} icon={o.status === 'created' ? searchingIcon : activeIcon}>
              <Popup>
                <b>{STATUS_LABEL[o.status]}</b>
                <br />
                {o.pickupAddress ?? 'A nuqta'} → {o.dropoffAddress ?? 'B nuqta'}
                <br />
                {o.passengerName ?? "Yo'lovchi"}
                {o.driverName && <> · {o.driverName}</>}
              </Popup>
            </Marker>
          ),
      )}
      {drivers.map((d) => (
        <AnimatedCarMarker key={d.driverId} position={d} heading={d.heading}>
          <Tooltip direction="top" offset={[0, -18]}>
            {d.fullName ?? 'Haydovchi'}
          </Tooltip>
        </AnimatedCarMarker>
      ))}
    </RouteMap>
  )
}
