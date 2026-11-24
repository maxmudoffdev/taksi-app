import { useEffect, useState } from 'react'
import { fetchRoute } from '../services/osrm'
import type { LatLng, RouteInfo } from '../types'

type Result = { key: string; route: RouteInfo | null; error: string | null }

const keyOf = (a: LatLng | null, b: LatLng | null) =>
  a && b ? `${a.lat},${a.lng};${b.lat},${b.lng}` : null

/** A va B nuqtalar o'zgarganda OSRM'dan marshrutni oladi; eski so'rovlar bekor qilinadi */
export function useRoute(pickup: LatLng | null, dropoff: LatLng | null) {
  const [result, setResult] = useState<Result | null>(null)
  const key = keyOf(pickup, dropoff)

  useEffect(() => {
    if (!key || !pickup || !dropoff) return
    const controller = new AbortController()
    fetchRoute(pickup, dropoff, controller.signal)
      .then((route) => setResult({ key, route, error: null }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key, route: null, error: e instanceof Error ? e.message : String(e) })
        }
      })
    return () => controller.abort()
  }, [key, pickup, dropoff])

  // Natija faqat joriy A/B juftligiga tegishli bo'lsa ko'rsatiladi
  const current = result && result.key === key ? result : null
  return {
    route: current?.route ?? null,
    error: current?.error ?? null,
    loading: key !== null && current === null,
  }
}
