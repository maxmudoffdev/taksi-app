import 'leaflet/dist/leaflet.css'
import { useEffect, type ReactNode } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import { useDarkMode, useIsDesktop } from '../hooks/useMedia'
import type { LatLng, RouteInfo } from '../types'
import { useMapInsetsContext } from './mapInsets'
import { dropoffIcon, pickupIcon } from './markerIcons'

const TASHKENT: [number, number] = [41.2995, 69.2401]

/**
 * OpenStreetMap plitkalari (bepul, kalitsiz). Zamonaviy ko'rinish CSS filtr bilan beriladi
 * (index.css: .map-tiles / .map-tiles-dark). Ishlab chiqarishda o'z tile-serveri yoki
 * provayder (MapTiler, Stadia) tavsiya etiladi — OSM serverlari katta yuklama uchun emas.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Xarita ustidagi panellar egallagan joy (px) — marshrut ular ostida qolmasin */
export type MapInsets = { top?: number; right?: number; bottom?: number; left?: number }

type Props = {
  pickup: LatLng | null
  dropoff: LatLng | null
  route: RouteInfo | null
  onMapClick?: (point: LatLng) => void
  /** Berilmasa — marker surib bo'lmaydi */
  onPickupMove?: (point: LatLng) => void
  onDropoffMove?: (point: LatLng) => void
  /** Shu nuqtaga xaritani surish (qidiruvdan joy tanlanganda) */
  focus?: LatLng | null
  insets?: MapInsets
  /** Qo'shimcha qatlamlar (masalan, haydovchi markeri) */
  children?: ReactNode
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

const pad = (i: MapInsets = {}) => ({
  paddingTopLeft: [(i.left ?? 0) + 40, (i.top ?? 0) + 40] as [number, number],
  paddingBottomRight: [(i.right ?? 0) + 40, (i.bottom ?? 0) + 40] as [number, number],
})

function FitToRoute({ route, insets }: { route: RouteInfo | null; insets?: MapInsets }) {
  const map = useMap()
  // Panel balandligi o'zgarsa ham (masalan, tariflar chiqqanda) marshrut ko'rinadigan qismga qayta joylanadi
  const key = `${insets?.top ?? 0},${insets?.bottom ?? 0},${insets?.left ?? 0},${insets?.right ?? 0}`
  useEffect(() => {
    if (route && route.path.length > 1) map.fitBounds(route.path, { ...pad(insets), animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route, key])
  return null
}

function FlyTo({ point, insets }: { point: LatLng | null | undefined; insets?: MapInsets }) {
  const map = useMap()
  useEffect(() => {
    if (!point) return
    // Panellar hisobga olingan holda nuqtani ko'rinadigan qism markaziga keltirish
    const zoom = Math.max(map.getZoom(), 15)
    const i = insets ?? {}
    const offset = L.point(((i.left ?? 0) - (i.right ?? 0)) / 2, ((i.top ?? 0) - (i.bottom ?? 0)) / 2)
    const target = map.unproject(map.project(point, zoom).subtract(offset), zoom)
    map.flyTo(target, zoom, { duration: 0.8 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, point])
  return null
}

export default function RouteMap({ pickup, dropoff, route, onMapClick, onPickupMove, onDropoffMove, focus, insets: insetsProp, children }: Props) {
  const insetsFromShell = useMapInsetsContext()
  const insets = insetsProp ?? insetsFromShell
  const dark = useDarkMode()
  const desktop = useIsDesktop()
  return (
    <MapContainer center={TASHKENT} zoom={13} zoomControl={false} className="h-full w-full">
      <TileLayer key={dark ? 'dark' : 'light'} attribution={ATTRIBUTION} url={TILE_URL} className={dark ? 'map-tiles-dark' : 'map-tiles'} maxZoom={19} />
      {desktop && <ZoomControl position="bottomright" />}
      {onMapClick && <ClickHandler onClick={onMapClick} />}
      <FitToRoute route={route} insets={insets} />
      <FlyTo point={focus} insets={insets} />
      {route && (
        <>
          <Polyline positions={route.path} pathOptions={{ color: dark ? '#000' : '#fff', weight: 9, opacity: 0.9 }} />
          <Polyline positions={route.path} pathOptions={{ color: dark ? '#ffcc00' : '#18181b', weight: 5, opacity: 1 }} />
        </>
      )}
      {pickup && (
        <Marker
          position={pickup}
          icon={pickupIcon}
          draggable={Boolean(onPickupMove)}
          eventHandlers={{ dragend: (e) => onPickupMove?.(e.target.getLatLng()) }}
        />
      )}
      {dropoff && (
        <Marker
          position={dropoff}
          icon={dropoffIcon}
          draggable={Boolean(onDropoffMove)}
          eventHandlers={{ dragend: (e) => onDropoffMove?.(e.target.getLatLng()) }}
        />
      )}
      {children}
    </MapContainer>
  )
}
