import type { LatLng } from '../types'

const R = 6371000 // Yer radiusi, m
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Ikki nuqta orasidagi masofa (metr) */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** a dan b ga yo'nalish (0 = shimol, 90 = sharq) */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  return (deg(Math.atan2(y, x)) + 360) % 360
}

export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

/** Yo'l bo'ylab `meters` masofa yurgandan keyingi nuqta va yo'nalish */
export function advanceAlongPath(path: LatLng[], meters: number): { point: LatLng; heading: number; done: boolean } {
  let left = meters
  for (let i = 0; i < path.length - 1; i++) {
    const seg = distanceM(path[i], path[i + 1])
    if (left <= seg) {
      return { point: lerp(path[i], path[i + 1], seg ? left / seg : 1), heading: bearing(path[i], path[i + 1]), done: false }
    }
    left -= seg
  }
  const last = path[path.length - 1]
  const prev = path[path.length - 2] ?? last
  return { point: last, heading: bearing(prev, last), done: true }
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}
