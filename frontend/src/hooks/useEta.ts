import { useEffect, useRef, useState } from 'react'
import { distanceM } from '../maps/geo'
import { fetchRoute } from '../services/osrm'
import type { LatLng } from '../types'

/** Mashina shuncha yursa yoki shuncha vaqt o'tsa — vaqt qayta hisoblanadi */
const MOVE_M = 150
const MAX_AGE_MS = 30_000

/**
 * `from` dan `to` gacha yo'l bo'yicha taxminiy vaqt (daqiqa), OSRM orqali.
 * Har GPS nuqtada emas — faqat sezilarli siljishda (bepul serverni ortiqcha yuklamaslik uchun).
 */
export function useEta(from: LatLng | null, to: LatLng | null) {
  const [eta, setEta] = useState<{ min: number; km: number; key: string } | null>(null)
  const last = useRef<{ from: LatLng; key: string; at: number } | null>(null)
  const inflight = useRef<AbortController | null>(null)
  const key = to ? `${to.lat},${to.lng}` : null

  // Manzil o'zgarsa yoki komponent yopilsa — eski so'rov bekor qilinadi
  // (GPS har soniya o'zgaradi — shuning uchun har yangilanishda emas)
  useEffect(() => () => inflight.current?.abort(), [key])

  useEffect(() => {
    if (!from || !to || !key) return
    const prev = last.current
    const fresh = prev && prev.key === key && distanceM(prev.from, from) < MOVE_M && Date.now() - prev.at < MAX_AGE_MS
    if (fresh) return
    last.current = { from, key, at: Date.now() }
    inflight.current?.abort()
    const controller = new AbortController()
    inflight.current = controller
    fetchRoute(from, to, controller.signal)
      .then((r) => setEta({ min: r.durationMin, km: r.distanceKm, key }))
      .catch(() => {
        // Keyingi siljishda qayta urinsin
        if (!controller.signal.aborted) last.current = null
      })
  }, [from, to, key])

  // Juda yaqin bo'lsa — "hozir yetib keladi"
  const close = from && to ? distanceM(from, to) < 120 : false
  if (!key || !eta || eta.key !== key) return null
  return { min: close ? 0 : eta.min, km: eta.km }
}
