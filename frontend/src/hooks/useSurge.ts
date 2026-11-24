import { useEffect, useState } from 'react'
import { request } from '../services/socket'
import { useOrderStore } from '../store/orderStore'
import type { LatLng } from '../types'

/** Koeffitsiyent har shuncha vaqtda yangilanadi */
const REFRESH_MS = 30_000

/**
 * A nuqta uchun joriy "yuqori talab" koeffitsiyenti (1 — oddiy narx).
 * `refresh()` — darhol qayta so'rash (masalan, server "narx o'zgardi" desa).
 */
export function useSurge(pickup: LatLng | null) {
  const connected = useOrderStore((s) => s.connected)
  const [surge, setSurge] = useState(1)
  const [tick, setTick] = useState(0)
  const lat = pickup?.lat
  const lng = pickup?.lng

  useEffect(() => {
    if (lat == null || lng == null || !connected) return
    let cancelled = false
    const load = () =>
      request<{ surge: number }>('surge:quote', { pickup: { lat, lng } })
        .then((r) => !cancelled && setSurge(r.surge))
        .catch(() => {
          /* hisoblanmasa — oddiy narx */
        })
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [lat, lng, connected, tick])

  return { surge: lat == null ? 1 : surge, refresh: () => setTick((t) => t + 1) }
}
