import { useEffect, useRef, useState } from 'react'
import { fetchRoute } from '../services/osrm'
import type { LatLng } from '../types'
import { advanceAlongPath } from './geo'

export type PositionSource = 'gps' | 'sim'
export type DriverPosition = LatLng & { heading: number | null }

/** Simulyatsiyada mashina tezligi (m/s). ~70 km/soat — sinovni tezlashtirish uchun */
const SIM_SPEED_MS = 20
const SIM_TICK_MS = 1000
const TASHKENT: LatLng = { lat: 41.2995, lng: 69.2401 }

type Options = {
  enabled: boolean
  source: PositionSource
  /** Simulyatsiyada mashina shu nuqtaga OSRM yo'li bo'ylab boradi (null — turgan joyida) */
  simTarget: LatLng | null
}

/**
 * Haydovchi joylashuvi:
 *  - 'gps' — brauzer/telefon geolokatsiyasi
 *  - 'sim' — mashina OSRM marshruti bo'ylab o'zi harakatlanadi (kompyuterda sinash uchun)
 */
export function useDriverPosition({ enabled, source, simTarget }: Options) {
  const [position, setPosition] = useState<DriverPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const positionRef = useRef<DriverPosition | null>(null)
  positionRef.current = position

  // --- Haqiqiy GPS ---
  useEffect(() => {
    if (!enabled || source !== 'gps') return
    if (!('geolocation' in navigator)) {
      setError('Bu qurilmada geolokatsiya yo‘q')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null)
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading })
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? 'Geolokatsiyaga ruxsat berilmadi' : e.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, source])

  // --- Simulyatsiya ---
  const targetKey = simTarget ? `${simTarget.lat},${simTarget.lng}` : null
  useEffect(() => {
    if (!enabled || source !== 'sim') return
    setError(null)
    // Boshlang'ich nuqta: oxirgi joylashuv yoki Toshkent markazi yaqinida tasodifiy nuqta
    const start: DriverPosition = positionRef.current ?? {
      lat: TASHKENT.lat + (Math.random() - 0.5) * 0.03,
      lng: TASHKENT.lng + (Math.random() - 0.5) * 0.03,
      heading: null,
    }
    setPosition(start)
    if (!simTarget) return

    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    fetchRoute(start, simTarget)
      .then((route) => {
        if (cancelled) return
        const path = route.path.map(([lat, lng]) => ({ lat, lng }))
        let travelled = 0
        timer = setInterval(() => {
          travelled += SIM_SPEED_MS * (SIM_TICK_MS / 1000)
          const { point, heading, done } = advanceAlongPath(path, travelled)
          setPosition({ ...point, heading })
          if (done) clearInterval(timer)
        }, SIM_TICK_MS)
      })
      .catch((e: Error) => !cancelled && setError(`Simulyatsiya yo‘li topilmadi: ${e.message}`))

    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // simTarget o'rniga targetKey: bir xil nuqta qayta yaratilganda simulyatsiya qayta boshlanmasin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, source, targetKey])

  return { position, error }
}
