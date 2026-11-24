import type { LatLng, RouteInfo } from './types'

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

type OsrmResponse = {
  code: string
  message?: string
  routes: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[]
}

export async function fetchRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteInfo> {
  // OSRM koordinatalarni "lng,lat" tartibida qabul qiladi
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const res = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=geojson`, { signal })
  if (!res.ok) throw new Error(`OSRM xatosi: HTTP ${res.status}`)

  const data = (await res.json()) as OsrmResponse
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !route) throw new Error(data.message ?? "Bu nuqtalar orasida yo'l topilmadi")

  return {
    distanceKm: Math.round(route.distance / 100) / 10,
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  }
}
