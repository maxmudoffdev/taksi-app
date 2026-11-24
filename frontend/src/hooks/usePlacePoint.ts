import { useCallback, useRef, useState } from 'react'
import { reverseGeocode, type Place } from '../services/geocoding'
import type { LatLng } from '../types'

/**
 * Bitta nuqta (A yoki B) holati: qidiruvdan tanlangan joy yoki
 * xaritada bosilgan nuqta (manzili orqa fonda aniqlanadi).
 */
export function usePlacePoint() {
  const [place, setPlace] = useState<Place | null>(null)
  const [resolving, setResolving] = useState(false)
  const requestRef = useRef<AbortController | null>(null)

  const select = useCallback((p: Place) => {
    requestRef.current?.abort()
    setResolving(false)
    setPlace(p)
  }, [])

  const setPoint = useCallback((point: LatLng) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setPlace({ ...point, label: '', sublabel: '' })
    setResolving(true)
    reverseGeocode(point, controller.signal)
      .then((p) => !controller.signal.aborted && setPlace(p))
      .catch(() => {})
      .finally(() => !controller.signal.aborted && setResolving(false))
  }, [])

  const clear = useCallback(() => {
    requestRef.current?.abort()
    setResolving(false)
    setPlace(null)
  }, [])

  return { place, resolving, select, setPoint, clear }
}
